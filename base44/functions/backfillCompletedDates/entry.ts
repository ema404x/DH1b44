import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { runDryRun, getDryRunProposals, createMigrationSnapshot } from '../../shared/migrationFramework.ts';

/**
 * Backfill de completed_date para OTs en estado 'completada' que nunca recibieron
 * la fecha (pre-guard de transicionEstadoOT).
 *
 * Flujo seguro (4 fases del framework):
 *   1. Dry-run: escanea y propone fechas SIN escribir.
 *   2. Snapshot: guarda el estado previo en MigrationRecord (reversible).
 *   3. Apply: actualiza los 83 registros con la fecha propuesta.
 *   4. Marca el MigrationRecord como 'aplicado'.
 *
 * Recibe { dry_run: boolean }. Si dry_run=true, solo ejecuta fase 1 y devuelve el reporte.
 * Admin-only — toca datos de OTs de todos los sectores.
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — solo admin' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { dry_run = true } = body;

    // ── Fase 1: Dry-run (solo lectura) — reporte cappeado a 20 muestras ──
    const report = await runDryRun(base44.asServiceRole, 'backfill_completed_date', {});

    if (dry_run) {
      return Response.json({
        ok: true,
        mode: 'dry_run',
        total_a_afectar: report.total_a_afectar,
        muestras: report.muestras,
        alertas: report.alertas,
        duration_ms: report.duration_ms,
        message: 'Dry-run completado. Reejecutá con dry_run=false para aplicar (previo snapshot automático).',
      });
    }

    // Validación: no aplicar si hay OTs sin fuente de fecha (requieren revisión manual)
    if (report.alertas.length > 0) {
      return Response.json({
        ok: false,
        error: 'No se puede aplicar: hay OTs sin fuente de fecha. Revisá las alertas del dry-run.',
        alertas: report.alertas,
      }, { status: 409 });
    }

    // ── Obtener TODAS las proposals (sin cap de muestras) para la fase de apply ──
    const proposals = await getDryRunProposals(base44.asServiceRole, 'backfill_completed_date', {});

    // ── Fase 2: Snapshot (guarda estado previo en MigrationRecord) ──
    const snapshot = await createMigrationSnapshot(
      base44.asServiceRole,
      'backfill_completed_date',
      'WorkOrder',
      { status: 'completada', completed_date: null },
      ['completed_date', 'fecha_validacion', 'updated_date', 'status'],
      `Backfill completed_date — ${report.total_a_afectar} OTs — aplicado por ${user.email}`
    );

    // ── Fase 3: Apply (actualiza cada registro con la fecha propuesta) ──
    const results = { updated: 0, failed: 0, errors: [] };
    for (const p of proposals) {
      try {
        await base44.asServiceRole.entities.WorkOrder.update(p.id, p.proposed_values);
        results.updated++;
      } catch (e: any) {
        results.failed++;
        results.errors.push({ id: p.id, error: e?.message || 'error desconocido' });
      }
    }

    // ── Fase 4: Marca el MigrationRecord como aplicado ──
    await base44.asServiceRole.entities.MigrationRecord.update(snapshot.migration_id, {
      estado: 'aplicado',
      aplicado_at: new Date().toISOString(),
      aplicado_por: user.email || 'admin',
      dry_run_report: { total_a_afectar: report.total_a_afectar, alertas: report.alertas, duration_ms: report.duration_ms },
    });

    return Response.json({
      ok: true,
      mode: 'aplicado',
      migration_id: snapshot.migration_id,
      total_registros: snapshot.total_registros,
      results,
      message: `Backfill aplicado: ${results.updated} OTs actualizadas, ${results.failed} fallos. Snapshot guardado en MigrationRecord ${snapshot.migration_id} para rollback.`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}