/**
 * Framework de Migración Segura — infraestructura reutilizable.
 *
 * Tres primitivas:
 *  1. runDryRun(scannerId, params)      — SOLO LECTURA. Escanea y propone cambios sin escribir.
 *  2. createMigrationSnapshot(...)      — Guarda copia de campos antes de un backfill.
 *  3. rollbackMigration(migrationId)    — Restaura desde los snapshots en lotes reversibles.
 *
 * Contrato: el helper de dry-run NUNCA escribe. Su salida es un reporte estructurado
 * consumible por el panel de Testing. Los snapshots se guardan en MigrationRecord (admin-only).
 *
 * Cada migración futura registra su scanner en SCANNER_REGISTRY y reusa este framework.
 */

export interface DryRunReport {
  scanner_id: string;
  total_a_afectar: number;
  muestras: any[];
  alertas: string[];
  duration_ms: number;
}

export interface SnapshotResult {
  migration_id: string;
  total_registros: number;
}

export interface RollbackResult {
  restored: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

/**
 * Ejecuta un dry-run contra el scanner registrado. Solo lectura — nunca escribe.
 * El scanner recibe el client service-role y devuelve proposals + alertas.
 */
export async function runDryRun(
  base44ServiceRole: any,
  scannerId: string,
  params: Record<string, any> = {}
): Promise<DryRunReport> {
  const scanner = SCANNER_REGISTRY[scannerId];
  if (!scanner) {
    throw new Error(
      `Scanner '${scannerId}' no registrado. Disponibles: ${Object.keys(SCANNER_REGISTRY).join(', ') || '(ninguno)'}`
    );
  }
  const start = Date.now();
  const result = await scanner(base44ServiceRole, params || {});
  const proposals = result.proposals || [];
  return {
    scanner_id: scannerId,
    total_a_afectar: proposals.length,
    muestras: proposals.slice(0, 20),
    alertas: result.alertas || [],
    duration_ms: Date.now() - start,
  };
}

/**
 * Crea un snapshot de los campos de negocio de los registros que matchean el filtro.
 * No modifica los registros — solo los lee y guarda su estado previo en MigrationRecord.
 */
export async function createMigrationSnapshot(
  base44ServiceRole: any,
  migrationType: string,
  entityName: string,
  queryFilter: Record<string, any>,
  fieldsToSnapshot: string[],
  notes?: string
): Promise<SnapshotResult> {
  const entity = base44ServiceRole.entities[entityName];
  if (!entity) throw new Error(`Entidad '${entityName}' no encontrada en el SDK`);
  const records = await entity.filter(queryFilter);
  const snapshots = records.map((r: any) => ({
    id: r.id,
    snapshot: Object.fromEntries(fieldsToSnapshot.map((f) => [f, r[f]])),
  }));
  const migration = await base44ServiceRole.entities.MigrationRecord.create({
    migration_type: migrationType,
    entity_name: entityName,
    snapshots,
    snapshot_completo: true,
    estado: 'snapshot_creado',
    total_registros: records.length,
    notas: notes || '',
    sector_id: 'sistema',
  });
  return { migration_id: migration.id, total_registros: records.length };
}

/**
 * Restaura los campos snapshoteados a su valor previo. Lote por lote, registra errores
 * sin cortar el flujo. Marca el MigrationRecord como 'revertido' (o 'revertido_parcial' si hubo fallos).
 */
export async function rollbackMigration(
  base44ServiceRole: any,
  migrationId: string,
  actorEmail: string
): Promise<RollbackResult> {
  const migration = await base44ServiceRole.entities.MigrationRecord.get(migrationId);
  if (!migration) throw new Error('MigrationRecord no encontrado');
  if (migration.estado === 'revertido' || migration.estado === 'revertido_parcial') {
    throw new Error(`Esta migración ya fue revertida (estado: ${migration.estado})`);
  }
  const entity = base44ServiceRole.entities[migration.entity_name];
  if (!entity) throw new Error(`Entidad '${migration.entity_name}' no encontrada`);
  const results: RollbackResult = { restored: 0, failed: 0, errors: [] };
  for (const snap of migration.snapshots || []) {
    try {
      await entity.update(snap.id, snap.snapshot);
      results.restored++;
    } catch (e: any) {
      results.failed++;
      results.errors.push({ id: snap.id, error: e?.message || 'error desconocido' });
    }
  }
  await base44ServiceRole.entities.MigrationRecord.update(migrationId, {
    estado: results.failed > 0 ? 'revertido_parcial' : 'revertido',
    reverted_at: new Date().toISOString(),
    reverted_by: actorEmail,
  });
  return results;
}

/**
 * Registry de scanners. Cada migración futura registra aquí su escáner de solo lectura.
 * Un scanner recibe (base44ServiceRole, params) y devuelve { proposals, alertas }.
 *
 * Scanner 'recon' — reconocimiento genérico. Cuenta y muestrea registros que matchean
 * un filtro, sin proponer cambios específicos. Útil como pre-flight de cualquier migración.
 */
/**
 * Ejecuta un scanner y devuelve TODAS las proposals (sin cap de muestras).
 * Usado por las funciones de backfill en la fase de apply — necesitan la lista completa.
 */
export async function getDryRunProposals(
  base44ServiceRole: any,
  scannerId: string,
  params: Record<string, any> = {}
): Promise<any[]> {
  const scanner = SCANNER_REGISTRY[scannerId];
  if (!scanner) {
    throw new Error(
      `Scanner '${scannerId}' no registrado. Disponibles: ${Object.keys(SCANNER_REGISTRY).join(', ') || '(ninguno)'}`
    );
  }
  const result = await scanner(base44ServiceRole, params || {});
  return result.proposals || [];
}

export const SCANNER_REGISTRY: Record<string, (base44: any, params: any) => Promise<{ proposals: any[]; alertas: string[] }>> = {
  recon: async (base44, params) => {
    const { entity_name, query_filter = {}, fields = [] } = params;
    if (!entity_name) throw new Error('entity_name requerido para scanner recon');
    const entity = base44.entities[entity_name];
    if (!entity) throw new Error(`Entidad '${entity_name}' no encontrada`);
    const records = await entity.filter(query_filter);
    const proposals = records.map((r: any) => ({
      id: r.id,
      entity_name,
      current_values: fields.length ? Object.fromEntries(fields.map((f) => [f, r[f]])) : { id: r.id },
      proposed_values: null,
      reason: 'Coincide con el filtro de migración — candidato a modificación',
    }));
    return { proposals, alertas: [] };
  },

  /**
   * Scanner backfill_completed_date — propone completed_date para OTs en estado
   * 'completada' que nunca recibieron la fecha (pre-guard). Fallback en cascada:
   *   1. fecha_validacion (timestamp exacto del cierre)
   *   2. fecha_inicio_real + 1 día (estimación conservadora)
   *   3. updated_date (última modificación — último recurso)
   * Solo lectura — no escribe. Devuelve proposals con proposed_values calculados.
   */
  backfill_completed_date: async (base44, _params) => {
    const records = await base44.entities.WorkOrder.filter({
      status: 'completada',
      completed_date: null,
    });
    const proposals = records.map((r: any) => {
      let proposedDate: string | null = null;
      let source: string = '';
      if (r.fecha_validacion) {
        proposedDate = String(r.fecha_validacion).split('T')[0];
        source = 'fecha_validacion';
      } else if (r.fecha_inicio_real) {
        const d = new Date(r.fecha_inicio_real);
        d.setDate(d.getDate() + 1);
        proposedDate = d.toISOString().split('T')[0];
        source = 'fecha_inicio_real + 1 día';
      } else if (r.updated_date) {
        proposedDate = String(r.updated_date).split('T')[0];
        source = 'updated_date (última modificación)';
      } else {
        return {
          id: r.id,
          entity_name: 'WorkOrder',
          current_values: { status: r.status, completed_date: r.completed_date, fecha_validacion: r.fecha_validacion, updated_date: r.updated_date },
          proposed_values: null,
          reason: 'Sin fuente de fecha disponible — requiere revisión manual',
        };
      }
      return {
        id: r.id,
        entity_name: 'WorkOrder',
        current_values: { status: r.status, completed_date: r.completed_date, fecha_validacion: r.fecha_validacion, updated_date: r.updated_date },
        proposed_values: { completed_date: proposedDate },
        reason: `Fecha propuesta desde ${source}: ${proposedDate}`,
      };
    });
    const alertas = proposals.filter((p: any) => !p.proposed_values).length > 0
      ? [`${proposals.filter((p: any) => !p.proposed_values).length} OT(s) sin fuente de fecha — requieren revisión manual`]
      : [];
    return { proposals, alertas };
  },
};