import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { shouldSyncToGerente } from "../../shared/roles.ts";

// Re-vinculación premium de empleados — resuelve de raíz el problema de
// "cambién el mail y no me deja volver a vincularlo".
//
// Reglas de oro:
//  1. Server-side: la búsqueda del usuario de plataforma por email se hace con
//     asServiceRole.filter (sin tope de 500 del list client-side, que dejaba
//     fuera al usuario correcto y fallaba el relink).
//  2. Nunca destruir sin construir: si no hay usuario de plataforma con el email
//     nuevo, NO se borra el user_id en silencio — se auto-invita al nuevo email
//     (la identidad vieja queda reemplazada). El link se completa en el primer
//     login del invitado (vincularEmpleado auto-cura por email).
//  3. Sector guard fail-closed: el empleado debe pertenecer al sector del
//     caller. Nunca vincular una ficha de otro sector.
//  4. Sync completa: al vincular, sincroniza full_name, sector_id y rol de
//     plataforma (gerente/user vía shouldSyncToGerente) — igual que
//     vincularEmpleado, para no dejar identidad desincronizada.
//  5. Admin-only: solo un admin puede re-vincular fichas ajenas.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ ok: false, error: 'Se requiere rol admin' }, { status: 403 });
    }

    // ── Sector canónico del caller (fail-closed, sin default 'escuela') ──
    const userEmail = (user.email || '').toLowerCase().trim();
    let callerEmp = null;
    if (userEmail) {
      const r = await base44.asServiceRole.entities.Employee.filter({ email: userEmail }).catch(() => []);
      callerEmp = r?.[0] || null;
    }
    if (!callerEmp && user.id) {
      const r2 = await base44.asServiceRole.entities.Employee.filter({ user_id: user.id }).catch(() => []);
      callerEmp = r2?.[0] || null;
    }
    const callerSector = callerEmp?.sector_id || user.data?.sector_id || user.sector_id;
    if (!callerSector) {
      return Response.json({ ok: false, error: 'Sin sector asignado' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { employee_id } = body;
    if (!employee_id) {
      return Response.json({ ok: false, error: 'Falta employee_id' }, { status: 400 });
    }

    // ── Cargar la ficha a re-vincular (service role, bypass RLS) ──
    let emp = null;
    try {
      emp = await base44.asServiceRole.entities.Employee.get(employee_id);
    } catch (_) {
      return Response.json({ ok: false, error: 'Empleado no encontrado' }, { status: 404 });
    }
    if (!emp) {
      return Response.json({ ok: false, error: 'Empleado no encontrado' }, { status: 404 });
    }
    if (emp.sector_id !== callerSector) {
      return Response.json({ ok: false, error: 'Forbidden: empleado de otro sector' }, { status: 403 });
    }
    if (!emp.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emp.email.trim())) {
      return Response.json({ ok: false, error: 'El empleado no tiene un email válido' }, { status: 400 });
    }
    const empEmail = emp.email.toLowerCase().trim();

    // ── Búsqueda server-side del usuario de plataforma por email ──
    //    filter({ email }) no tiene tope; el list client-side (-created_date, 500)
    //    dejaba fuera al usuario correcto cuando había >500 users.
    const matches = await base44.asServiceRole.entities.User.filter({ email: emp.email }).catch(() => []);
    const platformUser = (matches || []).find(
      u => (u.email || '').toLowerCase().trim() === empEmail
    ) || null;

    // ── CASE A: usuario encontrado → vincular + sincronizar ──
    if (platformUser) {
      const tasks = [];
      if (emp.user_id !== platformUser.id) {
        tasks.push(
          base44.asServiceRole.entities.Employee.update(emp.id, { user_id: platformUser.id }).catch(() => {})
        );
      }
      // Sync de la identidad de plataforma (excepto admins — mantienen super-rol)
      if (platformUser.role !== 'admin') {
        const userUpdate = {};
        const isEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const platName = (platformUser.full_name || '').trim();
        if (emp.full_name && (isEmailPattern.test(platName) || platName !== (emp.full_name || '').trim())) {
          userUpdate.full_name = emp.full_name;
        }
        const currentSector = platformUser.data?.sector_id ?? null;
        if (emp.sector_id && emp.sector_id !== currentSector) {
          userUpdate.sector_id = emp.sector_id;
        }
        const shouldBe = shouldSyncToGerente(emp.role) ? 'gerente' : 'user';
        if ((shouldBe === 'gerente' || shouldBe === 'user') && platformUser.role !== shouldBe) {
          userUpdate.role = shouldBe;
        }
        if (Object.keys(userUpdate).length > 0) {
          tasks.push(
            base44.asServiceRole.entities.User.update(platformUser.id, userUpdate).catch(() => {})
          );
        }
      }
      await Promise.allSettled(tasks);

      return Response.json({
        ok: true,
        action: 'linked',
        employee_id: emp.id,
        user_id: platformUser.id,
        user_email: platformUser.email,
        message: `Vinculado a ${platformUser.email}`,
      });
    }

    // ── CASE B: no hay usuario de plataforma con ese email → auto-invitar ──
    //    El email fue cambiado (o es un empleado nuevo). El email de plataforma
    //    es auth-owned y no se puede actualizar directamente, así que invitamos
    //    el nuevo email con el rol mapeado. El link se completa solo en el
    //    primer login del invitado (vincularEmpleado linkea por email).
    const platformRole = shouldSyncToGerente(emp.role) ? 'gerente' : 'user';
    let invited = false;
    let inviteError = null;
    try {
      const usersApi = base44.asServiceRole?.users?.inviteUser
        ? base44.asServiceRole.users
        : base44.users;
      if (usersApi?.inviteUser) {
        await usersApi.inviteUser(emp.email, platformRole);
        invited = true;
      } else {
        inviteError = 'inviteUser no disponible en el runtime backend';
      }
    } catch (e) {
      inviteError = e.message || 'Error desconocido al invitar';
    }

    // Limpiar user_id stale SOLO si la invitación salió OK — nunca huérfano la
    // ficha sin un camino constructivo (la invitación) para reconectarla.
    if (invited && emp.user_id) {
      try {
        const oldUser = await base44.asServiceRole.entities.User.get(emp.user_id);
        if (!oldUser || (oldUser.email || '').toLowerCase().trim() !== empEmail) {
          await base44.asServiceRole.entities.Employee.update(emp.id, { user_id: null }).catch(() => {});
        }
      } catch (_) {
        // user_id apunta a un usuario roto → limpiar
        await base44.asServiceRole.entities.Employee.update(emp.id, { user_id: null }).catch(() => {});
      }
    }

    if (invited) {
      return Response.json({
        ok: true,
        action: 'invited',
        employee_id: emp.id,
        email: emp.email,
        role: platformRole,
        message: `No había usuario con ese email. Se envió invitación a ${emp.email} (rol: ${platformRole}). El vínculo se completará cuando la persona acepte e ingrese.`,
      });
    }

    return Response.json({
      ok: false,
      action: 'invite_failed',
      error: inviteError || 'No se pudo invitar al usuario',
      message: 'No hay usuario de plataforma con ese email y la invitación automática falló. Invitalo manualmente con el botón Invitar y luego re-vinculá.',
    });
  } catch (error) {
    return Response.json({ ok: false, error: error.message || 'Error inesperado' }, { status: 500 });
  }
});