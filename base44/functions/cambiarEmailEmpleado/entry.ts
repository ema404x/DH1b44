import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveCallerSector, isValidEmail, linkOrInvitePlatformUser } from "../../shared/empleadoLink.ts";

// Cambio de email de empleado PREMIUM y atómico — resuelve de raíz el bug
// "cambié el correo y ahora solo le figuran 3 OT y nada más de todo lo que tenía".
//
// ROOT CAUSE: las OTs/Pendientes históricas guardan `jefe_sitio_email`
// (denormalizado) con el email VIEJO del jefe. La RLS de visibilidad de
// WorkOrder/Pendiente usa `data.jefe_sitio_email = {{user.email}}`, así que
// al cambiar el email sin propagar ese campo, el jefe pierde TODA su carga
// histórica (RLS mismatch). El re-vincular solo arregla la ficha+plataforma,
// no los registros que lo referencian por email.
//
// REGLA DE ORO — cambio de email atómico en un solo lugar:
//   1. Capturar old_email (de la ficha, o pasado explícito para reparar).
//   2. Actualizar emp.email = new_email (si cambió).
//   3. Propagar jefe_sitio_email old→new en WorkOrder y Pendiente del sector.
//      Seguro: el filtro es { sector_id, jefe_sitio_email: oldEmail } — solo
//      pega los registros que efectivamente tenían el email viejo del jefe.
//   4. Re-vincular usuario de plataforma por new_email (o auto-invitar) +
//      sincronizar nombre/sector/rol.
//   5. Sector guard fail-closed. Admin-only.
//
// `old_email` opcional sirve para REPARACIÓN: cuando el email ya fue cambiado
// (como Juan) y los registros quedaron con el email viejo, se pasa old_email
// para que la propagación rescate esos registros huérfanos.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ ok: false, error: 'Se requiere rol admin' }, { status: 403 });
    }

    const callerSector = await resolveCallerSector(base44, user);
    if (!callerSector) {
      return Response.json({ ok: false, error: 'Sin sector asignado' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { employee_id, new_email, old_email } = body;
    if (!employee_id) {
      return Response.json({ ok: false, error: 'Falta employee_id' }, { status: 400 });
    }
    const newEmail = (new_email || '').toLowerCase().trim();
    if (!isValidEmail(newEmail)) {
      return Response.json({ ok: false, error: 'Email nuevo inválido' }, { status: 400 });
    }

    const sb = base44.asServiceRole;

    // ── Cargar ficha (service role) ──
    let emp = null;
    try {
      emp = await sb.entities.Employee.get(employee_id);
    } catch (_) {
      return Response.json({ ok: false, error: 'Empleado no encontrado' }, { status: 404 });
    }
    if (!emp) return Response.json({ ok: false, error: 'Empleado no encontrado' }, { status: 404 });
    if (emp.sector_id !== callerSector) {
      return Response.json({ ok: false, error: 'Forbidden: empleado de otro sector' }, { status: 403 });
    }

    // old_email: explícito (reparación) o el actual de la ficha (cambio normal)
    const oldEmail = (old_email || emp.email || '').toLowerCase().trim();
    if (!oldEmail) {
      return Response.json({ ok: false, error: 'No se pudo determinar el email anterior' }, { status: 400 });
    }

    // Unicidad dentro del sector
    if (newEmail !== oldEmail) {
      const dup = await sb.entities.Employee.filter({ email: newEmail }).catch(() => []);
      const dupOther = (dup || []).find(e => e.id !== emp.id && (e.sector_id || '') === (emp.sector_id || ''));
      if (dupOther) {
        return Response.json({ ok: false, error: 'Ya existe otro empleado con ese email en el sector' }, { status: 409 });
      }
    }

    const tasks = [];
    const empEmailNorm = (emp.email || '').toLowerCase().trim();

    // ── 1) Actualizar email de la ficha (si cambió) ──
    if (empEmailNorm !== newEmail) {
      tasks.push(sb.entities.Employee.update(emp.id, { email: newEmail }).catch(() => {}));
    }

    // ── 2) Propagar jefe_sitio_email: old → new en WorkOrder y Pendiente ──
    const wResult = { matched: 0, updated: 0, remaining: 0 };
    const pResult = { matched: 0, updated: 0, remaining: 0 };
    if (oldEmail && oldEmail !== newEmail) {
      // WorkOrder
      try {
        const wMatch = await sb.entities.WorkOrder.filter({
          sector_id: emp.sector_id, jefe_sitio_email: oldEmail,
        });
        wResult.matched = (wMatch || []).length;
        if (wResult.matched > 0) {
          await sb.entities.WorkOrder.updateMany(
            { sector_id: emp.sector_id, jefe_sitio_email: oldEmail },
            { $set: { jefe_sitio_email: newEmail } }
          ).catch((e) => { wResult.error = e.message; });
          const wLeft = await sb.entities.WorkOrder.filter({
            sector_id: emp.sector_id, jefe_sitio_email: oldEmail,
          }).catch(() => []);
          wResult.remaining = (wLeft || []).length;
          wResult.updated = wResult.matched - wResult.remaining;
        }
      } catch (e) { wResult.error = e.message; }

      // Pendiente
      try {
        const pMatch = await sb.entities.Pendiente.filter({
          sector_id: emp.sector_id, jefe_sitio_email: oldEmail,
        });
        pResult.matched = (pMatch || []).length;
        if (pResult.matched > 0) {
          await sb.entities.Pendiente.updateMany(
            { sector_id: emp.sector_id, jefe_sitio_email: oldEmail },
            { $set: { jefe_sitio_email: newEmail } }
          ).catch((e) => { pResult.error = e.message; });
          const pLeft = await sb.entities.Pendiente.filter({
            sector_id: emp.sector_id, jefe_sitio_email: oldEmail,
          }).catch(() => []);
          pResult.remaining = (pLeft || []).length;
          pResult.updated = pResult.matched - pResult.remaining;
        }
      } catch (e) { pResult.error = e.message; }
    }

    // ── 3) Re-vincular usuario de plataforma por newEmail (o invitar) ──
    const linkInfo = await linkOrInvitePlatformUser(sb, base44, emp, newEmail, tasks);
    await Promise.allSettled(tasks);

    return Response.json({
      ok: true,
      employee_id: emp.id,
      employee_name: emp.full_name,
      old_email: oldEmail,
      new_email: newEmail,
      email_changed: empEmailNorm !== newEmail,
      workorders: wResult,
      pendientes: pResult,
      link: linkInfo,
    });
  } catch (error) {
    return Response.json({ ok: false, error: error.message || 'Error inesperado' }, { status: 500 });
  }
});