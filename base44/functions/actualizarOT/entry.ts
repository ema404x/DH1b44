import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Actualiza campos de una OT de forma robusta, sin depender del RLS directo
// sobre user.data.sector_id (que falla con 403 cuando el sector de plataforma
// queda desfasado) NI del gap de la regla RLS de update (que no incluye caminos
// por assigned_to ni por jefe_sitio/assigned_name → un jefe ve OTs asignadas
// a él por nombre pero no puede editarlas). Usa asServiceRole + guard de sector
// explícito, igual que eliminarOT / getActivosSector / transicionEstadoOT.
//
// PERMISO (espeja y EXTIENDE la RLS de WorkOrder.update, sólo para cerrar el gap):
//   - admin + sector
//   - gerente + sector
//   - creador (created_by_id == caller.id)
//   - asignado por email (jefe_sitio_email == caller.email)
//   - asignado por user_id (assigned_to == caller.id)        ← gap cerrado
//   - asignado por nombre (jefe_sitio|assigned_name == caller.full_name) ← gap cerrado
// El aislamiento por sector es verificado explícitamente: la OT debe pertenecer
// al sector canónico del caller. No hay fuga cross-sector.
//
// USO DESDE EL FRONTEND: WorkOrderDetailPanel rutea por acá SOLO cuando la OT
// es del sector escuela. Otros sectores siguen por base44.entities.WorkOrder.update
// (RLS), sin cambios → ningún cambio aplica a otros sectores.

const BUILT_IN = new Set(['id', 'created_date', 'updated_date', 'created_by_id', 'sector_id']);

const norm = (s) => (s || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .replace(/\s+/g, ' ');

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { ot_id, patch } = body;
    if (!ot_id) return Response.json({ error: 'Falta ot_id' }, { status: 400 });
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      return Response.json({ error: 'Falta patch' }, { status: 400 });
    }

    // Sector canónico: la ficha de Empleado es la fuente de verdad (igual que
    // eliminarOT / getActivosSector). user.data como fallback.
    const userEmail = (user.email || '').toLowerCase().trim();
    let employee = null;
    if (userEmail) {
      const empResults = await base44.asServiceRole.entities.Employee.filter({ email: userEmail });
      employee = empResults[0] || null;
    }
    if (!employee && user.id) {
      const empByUserId = await base44.asServiceRole.entities.Employee.filter({ user_id: user.id });
      employee = empByUserId[0] || null;
    }
    const callerSector = employee?.sector_id || user.data?.sector_id || user.sector_id;
    if (!callerSector) {
      return Response.json({ error: 'Sin sector asignado' }, { status: 403 });
    }

    // Leer la OT via service role (bypass de RLS — el permiso lo controlamos acá).
    let ot = null;
    try {
      ot = await base44.asServiceRole.entities.WorkOrder.get(ot_id);
    } catch (_) { /* not found */ }
    if (!ot) return Response.json({ error: 'Orden de trabajo no encontrada' }, { status: 404 });

    // Aislamiento por sector: la OT debe ser del mismo sector del caller.
    if (ot.sector_id !== callerSector) {
      return Response.json({ error: 'Esta OT pertenece a otro sector. Cambiá de sector activo para operarla.' }, { status: 403 });
    }

    // Permiso de update — espeja la RLS y cierra el gap (assigned_to / nombre).
    const role = user.role || '';
    const isCreator = ot.created_by_id && ot.created_by_id === user.id;
    const isAssignedByEmail = ot.jefe_sitio_email && (ot.jefe_sitio_email || '').toLowerCase().trim() === userEmail;
    const isAssignedByTo = ot.assigned_to && ot.assigned_to === user.id;
    let isAssignedByName = false;
    if (employee && employee.full_name && (ot.jefe_sitio || ot.assigned_name)) {
      const empName = norm(employee.full_name);
      isAssignedByName = !!empName && (norm(ot.jefe_sitio) === empName || norm(ot.assigned_name) === empName);
    }
    const canUpdate = role === 'admin'
      || role === 'gerente'
      || isCreator
      || isAssignedByEmail
      || isAssignedByTo
      || isAssignedByName;
    if (!canUpdate) {
      return Response.json({ error: 'No tenés permiso para editar esta OT' }, { status: 403 });
    }

    // Sanitizar el patch: nunca permitir sobreescribir built-ins ni sector_id
    // (aislamiento). El resto de campos del schema de WorkOrder pasan tal cual.
    const cleanPatch = {};
    let changed = 0;
    for (const [k, v] of Object.entries(patch)) {
      if (BUILT_IN.has(k)) continue;
      cleanPatch[k] = v;
      changed++;
    }
    if (changed === 0) {
      return Response.json({ success: true, ot, mensaje: 'Sin cambios' });
    }

    const updated = await base44.asServiceRole.entities.WorkOrder.update(ot_id, cleanPatch);
    return Response.json({ success: true, ot: updated, mensaje: 'OT actualizada' });
  } catch (error) {
    return Response.json({ error: error.message || 'Error al actualizar la OT' }, { status: 500 });
  }
}