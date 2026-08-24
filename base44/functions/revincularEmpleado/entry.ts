import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveCallerSector, isValidEmail, linkOrInvitePlatformUser } from "../../shared/empleadoLink.ts";

// Re-vinculación premium de empleados — resuelve de raíz el problema de
// "cambié el mail y no me deja volver a vincularlo".
//
// Reglas de oro:
//  1. Server-side: la búsqueda del usuario de plataforma por email se hace con
//     asServiceRole.filter (sin tope de 500 del list client-side, que dejaba
//     fuera al usuario correcto y fallaba el relink).
//  2. Nunca destruir sin construir: si no hay usuario de plataforma con el email
//     nuevo, NO se borra el user_id en silencio — se auto-invita al nuevo email.
//  3. Sector guard fail-closed: el empleado debe pertenecer al sector del caller.
//  4. Sync completa: al vincular, sincroniza full_name, sector_id y rol de
//     plataforma (gerente/user vía shouldSyncToGerente).
//  5. Admin-only: solo un admin puede re-vincular fichas ajenas.

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
    const { employee_id } = body;
    if (!employee_id) {
      return Response.json({ ok: false, error: 'Falta employee_id' }, { status: 400 });
    }

    const sb = base44.asServiceRole;

    // ── Cargar la ficha a re-vincular (service role, bypass RLS) ──
    let emp = null;
    try {
      emp = await sb.entities.Employee.get(employee_id);
    } catch (_) {
      return Response.json({ ok: false, error: 'Empleado no encontrado' }, { status: 404 });
    }
    if (!emp) {
      return Response.json({ ok: false, error: 'Empleado no encontrado' }, { status: 404 });
    }
    if (emp.sector_id !== callerSector) {
      return Response.json({ ok: false, error: 'Forbidden: empleado de otro sector' }, { status: 403 });
    }
    if (!isValidEmail(emp.email)) {
      return Response.json({ ok: false, error: 'El empleado no tiene un email válido' }, { status: 400 });
    }

    const empEmail = emp.email.toLowerCase().trim();
    const tasks = [];
    const linkInfo = await linkOrInvitePlatformUser(sb, base44, emp, empEmail, tasks);
    await Promise.allSettled(tasks);

    const message = linkInfo.action === 'linked'
      ? `Vinculado a ${linkInfo.user_email}`
      : (linkInfo.action === 'invited'
          ? `No había usuario con ese email. Se envió invitación a ${linkInfo.email} (rol: ${linkInfo.role}). El vínculo se completará cuando la persona acepte e ingrese.`
          : 'No hay usuario de plataforma con ese email y la invitación automática falló. Invitalo manualmente con el botón Invitar y luego re-vinculá.');

    return Response.json({
      ok: linkInfo.action !== 'invite_failed',
      action: linkInfo.action,
      employee_id: emp.id,
      user_id: linkInfo.user_id,
      user_email: linkInfo.user_email,
      email: linkInfo.email,
      role: linkInfo.role,
      message,
    });
  } catch (error) {
    return Response.json({ ok: false, error: error.message || 'Error inesperado' }, { status: 500 });
  }
});