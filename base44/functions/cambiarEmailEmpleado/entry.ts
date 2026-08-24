import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveCallerSector, isValidEmail, linkOrInvitePlatformUser } from "../../shared/empleadoLink.ts";

// Cambio de email de empleado PREMIUM y atómico — traslada TODA la información
// del empleado referenciada por email, hasta el mínimo detalle.
//
// ROOT CAUSE: las entidades operativas guardan el email del jefe/autor/aprobador
// desnormalizado (jefe_sitio_email, creado_por_email, aprobado_por_email,
// email_destinatarios). La RLS de visibilidad usa esos campos contra
// {{user.email}}, así que al cambiar el correo sin propagarlos el empleado
// pierde TODA su carga histórica (RLS mismatch).
//
// NOTA DE PLATAFORMA: created_by_id es un campo system inmutable (el SDK ignora
// silenciosamente cualquier intento de setearlo — verificado). Por eso el
// traslado se hace por los campos desnormalizados por EMAIL, que son los que
// la RLS usa para identificar al empleado. Esa propagación cubre todo lo que
// el empleado "es dueño" operativamente.
//
// REGLA DE ORO — cambio de email atómico en un solo lugar:
//   1. Capturar old_email (de la ficha, o pasado explícito para reparar).
//   2. Actualizar emp.email = new_email (si cambió).
//   3. Propagar email old→new en TODAS las entidades con campos de email:
//        - WorkOrder.jefe_sitio_email
//        - Pendiente.jefe_sitio_email
//        - Certificado.creado_por_email + aprobado_por_email
//        - SolicitudCertificado.jefe_sitio_email + aprobado_por_email
//        - AlertaConfig.email_destinatarios[] (array — reemplaza el elemento)
//      Seguro: el filtro es { sector_id, [campo]: oldEmail } — solo pega los
//      registros que efectivamente tenían el email viejo del empleado.
//   4. Re-vincular usuario de plataforma por new_email (o auto-invitar) +
//      sincronizar nombre/sector/rol.
//   5. Sector guard fail-closed. Admin-only.
//
// `old_email` opcional sirve para REPARACIÓN: cuando el email ya fue cambiado
// y los registros quedaron con el email viejo, se pasa old_email para que la
// propagación rescate esos registros huérfanos.

// Tabla de propagación de email — data-driven para mantenerse fácilmente.
// array: true → el campo es un array de emails (reemplazo de elemento).
const EMAIL_PROPAGATION = [
  { entity: "WorkOrder", fields: [{ key: "jefe_sitio_email", array: false }] },
  { entity: "Pendiente", fields: [{ key: "jefe_sitio_email", array: false }] },
  {
    entity: "Certificado",
    fields: [
      { key: "creado_por_email", array: false },
      { key: "aprobado_por_email", array: false },
    ],
  },
  {
    entity: "SolicitudCertificado",
    fields: [
      { key: "jefe_sitio_email", array: false },
      { key: "aprobado_por_email", array: false },
    ],
  },
  { entity: "AlertaConfig", fields: [{ key: "email_destinatarios", array: true }] },
];

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

    // ── 2) Propagar email old→new en TODAS las entidades con campos de email ──
    const propagation = {};
    if (oldEmail && oldEmail !== newEmail) {
      for (const spec of EMAIL_PROPAGATION) {
        const entityApi = sb.entities[spec.entity];
        if (!entityApi) {
          propagation[spec.entity] = { error: 'entidad no disponible en el SDK' };
          continue;
        }
        const perField = {};
        for (const f of spec.fields) {
          const fieldResult = { matched: 0, updated: 0, remaining: 0 };
          try {
            if (f.array) {
              // Array de emails: filtrar por sector, filtrar client-side los que
              // contienen oldEmail, y reemplazar el elemento en cada uno.
              const all = await entityApi.filter({ sector_id: emp.sector_id });
              const hits = (all || []).filter(r =>
                Array.isArray(r[f.key]) &&
                r[f.key].some(e => (e || '').toLowerCase().trim() === oldEmail)
              );
              fieldResult.matched = hits.length;
              if (hits.length > 0) {
                const updates = hits.map(r => {
                  const newArr = r[f.key].map(e =>
                    (e || '').toLowerCase().trim() === oldEmail ? newEmail : e
                  );
                  return { id: r.id, [f.key]: newArr };
                });
                // bulkUpdate soporta hasta 500 con cambios distintos por registro
                try {
                  await entityApi.bulkUpdate(updates);
                } catch (e) {
                  // fallback individual si bulkUpdate falla
                  for (const u of updates) {
                    await entityApi.update(u.id, { [f.key]: u[f.key] }).catch(() => {});
                  }
                  fieldResult.fallback = e.message;
                }
              }
            } else {
              // Escalar: filter + updateMany $set
              const match = await entityApi.filter({
                sector_id: emp.sector_id, [f.key]: oldEmail,
              });
              fieldResult.matched = (match || []).length;
              if (fieldResult.matched > 0) {
                await entityApi.updateMany(
                  { sector_id: emp.sector_id, [f.key]: oldEmail },
                  { $set: { [f.key]: newEmail } }
                ).catch((e) => { fieldResult.error = e.message; });
                const left = await entityApi.filter({
                  sector_id: emp.sector_id, [f.key]: oldEmail,
                }).catch(() => []);
                fieldResult.remaining = (left || []).length;
                fieldResult.updated = fieldResult.matched - fieldResult.remaining;
              }
            }
          } catch (e) {
            fieldResult.error = e.message;
          }
          perField[f.key] = fieldResult;
        }
        propagation[spec.entity] = perField;
      }
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
      propagation,
      link: linkInfo,
    });
  } catch (error) {
    return Response.json({ ok: false, error: error.message || 'Error inesperado' }, { status: 500 });
  }
});