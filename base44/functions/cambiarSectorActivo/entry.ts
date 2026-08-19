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
    // Escribe a data.sector_id / data.sector_base — la RLS lee {{user.data.sector_id}}.
    // Escribir solo al campo plano (sector_id) NO lo ve la RLS.
    const sectorBaseActual = user.data?.sector_base ?? null;
    const sectorIdActual = user.data?.sector_id ?? user.sector_id ?? null;
    const updatePayload = { data: { sector_id: sector_destino } };
    if (!sectorBaseActual && sectorIdActual) {
      updatePayload.data.sector_base = sectorIdActual;
    }

    await sb.entities.User.update(user.id, updatePayload);

    return Response.json({
      ok: true,
      sector_activo: sector_destino,
      sector_base: updatePayload.data.sector_base || sectorBaseActual,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});