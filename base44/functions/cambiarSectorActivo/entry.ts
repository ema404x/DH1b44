import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { normalizeRole } from "../../shared/roles.ts";

/**
 * cambiarSectorActivo — Cambia el sector_id del usuario actual (sector activo).
 *
 * Modelo B: solo platform admins y empleados con rol `gerente_general` pueden cambiar.
 * Estampa `sector_base` la primera vez que el usuario cambia (preserva su sector de origen).
 * Valida que el sector destino exista y esté activo.
 *
 * Bypassa RLS de User.update (admin-only) vía asServiceRole.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { sector_destino } = body;
    if (!sector_destino || typeof sector_destino !== 'string') {
      return Response.json({ error: 'sector_destino es requerido' }, { status: 400 });
    }

    const sb = base44.asServiceRole;

    // ── Gate de rol: platform admin puede siempre; gerente_general (empleado) autorizado ──
    let puedeCambiar = user.role === 'admin';
    let emp = null;
    if (!puedeCambiar) {
      // 1) Por user_id (patrón primario de vincularEmpleado)
      const byUserId = await sb.entities.Employee.filter({ user_id: user.id }).catch(() => []);
      emp = byUserId[0];
      // 2) Fallback por email (ficha sin user_id estampado aún)
      if (!emp && user.email) {
        const byEmail = await sb.entities.Employee.filter({ email: user.email }).catch(() => []);
        emp = byEmail.find(e => e.email?.toLowerCase().trim() === user.email.toLowerCase().trim());
      }
      if (emp && normalizeRole(emp.role) === 'gerente_general') {
        puedeCambiar = true;
        // Auto-curación: estampar user_id si faltaba
        if (emp.user_id !== user.id) {
          await sb.entities.Employee.update(emp.id, { user_id: user.id }).catch(() => {});
        }
      }
    }
    if (!puedeCambiar) {
      return Response.json({ error: 'Forbidden: solo gerente_general puede cambiar de sector' }, { status: 403 });
    }

    // ── Validar que el sector destino exista y esté activo ──
    const sectores = await sb.entities.Sector.filter({ clave: sector_destino }).catch(() => []);
    const sector = sectores[0];
    if (!sector) return Response.json({ error: 'Sector no encontrado' }, { status: 404 });
    if (sector.activo === false) {
      return Response.json({ error: 'Sector inactivo' }, { status: 409 });
    }

    // ── Fijar sector_base solo la primera vez (preserva el sector de origen) ──
    // La RLS lee {{user.data.sector_id}}. El SDK del service role almacena los
    // parámetros top-level del payload dentro del blob `data` del User.
    // PASAR `data: { sector_id }` crea `data.data.sector_id` (doble anidamiento)
    // — bug histórico. Patrón limpio: solo parámetros top-level.
    const sectorBaseActual = user.data?.sector_base ?? null;
    const sectorIdActual = user.data?.sector_id ?? user.sector_id ?? null;

    const updatePayload = { sector_id: sector_destino } as any;
    if (!sectorBaseActual && sectorIdActual) {
      // Preservar sector_base la primera vez — también como top-level.
      updatePayload.sector_base = sectorIdActual;
    }

    await sb.entities.User.update(user.id, updatePayload);

    // ── Sincronizar la ficha Employee al nuevo sector (fix rebote de limbo) ──
    // Sin esto la ficha queda en el sector viejo y vincularEmpleado (que trata a
    // la ficha como fuente de verdad) revierte el User al sector viejo en el
    // próximo login → el empleado queda en limbo (no visto en ningún sector).
    // Best-effort: si no hay ficha (platform admin puro) no rompe el flujo.
    // Los registros históricos (OTs/Activos/Pendientes) NO se migran: quedan en
    // su sector original, preservando el aislamiento y evitando contaminación.
    try {
      let empRow = emp;
      if (!empRow) {
        const byUid = user.id ? (await sb.entities.Employee.filter({ user_id: user.id }).catch(() => [])) : [];
        empRow = byUid[0];
        if (!empRow && user.email) {
          const byEmail = await sb.entities.Employee.filter({ email: user.email }).catch(() => []);
          empRow = byEmail.find(e => e.email?.toLowerCase().trim() === user.email.toLowerCase().trim());
        }
      }
      if (empRow && empRow.sector_id !== sector_destino) {
        await sb.entities.Employee.update(empRow.id, { sector_id: sector_destino }).catch(() => {});
      }
    } catch (_) {}

    return Response.json({
      ok: true,
      sector_activo: sector_destino,
      sector_base: updatePayload.sector_base || sectorBaseActual,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});