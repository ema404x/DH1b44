import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { createScopedClient, resolveCallerSector, SectorError } from '../../shared/sectorGuard.ts';

// Revierte una importación de activos (rollback).
//   1. Lee ImportacionActivos por id (scoped al sector).
//   2. Borra los assets creados (created_ids).
//   3. Restaura los assets actualizados a su snapshot previo (updated_snapshots).
//      Si snapshot_completo=false, los que no tienen snapshot no se restauran
//      (estado final = revertida_parcial).
//   4. Borra las sedes creadas en esa importación que no tengan otros assets
//      vinculados (sedes_creadas_ids).
//   5. Marca el registro como revertido y audita.

const DELETE_BATCH = 100;
const UPDATE_BATCH = 100;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'gerente') {
      return Response.json({ error: 'Forbidden: solo admin/gerente' }, { status: 403 });
    }
    const callerSector = resolveCallerSector(user);
    const sb = createScopedClient(base44, callerSector);

    const body = await req.json().catch(() => ({}));
    const { importacion_id } = body;
    if (!importacion_id) return Response.json({ error: 'importacion_id requerido' }, { status: 400 });

    const registro = await sb.entities.ImportacionActivos.get(importacion_id).catch(() => null);
    if (!registro) return Response.json({ error: 'Importación no encontrada' }, { status: 404 });
    if (registro.estado === 'revertida' || registro.estado === 'revertida_parcial') {
      return Response.json({ error: 'Esta importación ya fue revertida' }, { status: 400 });
    }

    const created_ids: string[] = registro.created_ids || [];
    const updated_snapshots: { id: string; snapshot: any }[] = registro.updated_snapshots || [];
    const sedes_creadas_ids: string[] = registro.sedes_creadas_ids || [];

    // ── 1. Borrar assets creados en esta importación ────────────────────
    let borrados = 0;
    for (let i = 0; i < created_ids.length; i += DELETE_BATCH) {
      const batch = created_ids.slice(i, i + DELETE_BATCH);
      try {
        await sb.entities.Asset.deleteMany({ id: { $in: batch } });
        borrados += batch.length;
      } catch (e) {
        console.error('rollback deleteMany error:', e.message);
      }
    }

    // ── 2. Restaurar snapshots de assets actualizados ───────────────────
    let restaurados = 0;
    for (let i = 0; i < updated_snapshots.length; i += UPDATE_BATCH) {
      const batch = updated_snapshots.slice(i, i + UPDATE_BATCH);
      const restores = batch.map(s => ({ id: s.id, ...s.snapshot }));
      try {
        await sb.entities.Asset.bulkUpdate(restores);
        restaurados += restores.length;
      } catch (e) {
        // Fallback individual si el batch falla
        for (const r of restores) {
          try { await sb.entities.Asset.update(r.id, r); restaurados++; }
          catch (e2) { console.error('rollback restore error:', e2.message); }
        }
      }
    }

    // ── 3. Limpiar sedes creadas sin otros assets vinculados ────────────
    let sedes_borradas = 0;
    for (const locId of sedes_creadas_ids) {
      if (!locId) continue;
      try {
        const vinculados = await sb.entities.Asset.filter({ location_id: locId }, '-updated_date', 5);
        if (vinculados && vinculados.length > 0) continue; //仍有 activos → no borrar
        // Sin assets vinculados → borrar Edificio y LocationData
        const edificios = await sb.entities.Edificio.filter({ location_id: locId }, '-updated_date', 10);
        for (const ed of (edificios || [])) {
          try { await sb.entities.Edificio.delete(ed.id); } catch {}
        }
        try { await sb.entities.LocationData.delete(locId); } catch {}
        sedes_borradas++;
      } catch (e) {
        console.error('rollback sede cleanup error:', e.message);
      }
    }

    // ── 4. Marcar registro como revertido ───────────────────────────────
    const sinSnapshot = (registro.updated_ids?.length || 0) - updated_snapshots.length;
    const estadoFinal = sinSnapshot > 0 ? 'revertida_parcial' : 'revertida';
    await sb.entities.ImportacionActivos.update(importacion_id, {
      estado: estadoFinal,
      reverted_at: new Date().toISOString(),
      reverted_by: user.full_name || user.email,
      reverted_by_email: user.email,
    });

    // ── 5. Auditar ──────────────────────────────────────────────────────
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        entity_type: 'ImportacionActivos',
        entity_id: importacion_id,
        action: 'rollback',
        user_email: user.email,
        user_role: user.role || 'user',
        timestamp: new Date().toISOString(),
        notes: `Rollback importación "${registro.file_name}": ${borrados} borrados, ${restaurados} restaurados, ${sedes_borradas} sedes borradas`,
      });
    } catch (e) {
      console.error('rollback audit error:', e.message);
    }

    return Response.json({
      ok: true,
      importacion_id,
      estado: estadoFinal,
      borrados,
      restaurados,
      sedes_borradas,
      sin_snapshot: sinSnapshot,
      mensaje: estadoFinal === 'revertida_parcial'
        ? `Reversión parcial: ${sinSnapshot} actualización(es) no tenían snapshot y no se restauraron.`
        : 'Importación revertida correctamente.',
    });
  } catch (err) {
    if (err instanceof SectorError) return Response.json({ error: err.message }, { status: err.status });
    console.error('rollbackImportacion error:', err);
    return Response.json({ error: `Error interno: ${err.message}` }, { status: 500 });
  }
}