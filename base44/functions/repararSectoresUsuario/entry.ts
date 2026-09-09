import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { fetchAll } from '../../shared/fetchAllSector.ts';

/**
 * Repara `data.sector_id` en usuarios que lo tienen ausente o malformado
 * (doble-anidado), alineándolo con el sector_id de su ficha de Employee.
 * Aplana cualquier `data.data.*` anidado (basura de escrituras legacy que
 * pasaban `data: { sector_id: ... }` al SDK, creando `data.data.sector_id`
 * en lugar de `data.sector_id`).
 *
 * PROBLEMA
 *   La RLS de entidades como InspeccionColegio, WorkOrder, Pendiente, etc.
 *   evalúa `{{user.data.sector_id}}`. Si ese campo está ausente (data={}) o
 *   malformado (data.data.sector_id en lugar de data.sector_id), el usuario
 *   no puede guardar, actualizar ni eliminar registros desde el cliente (403).
 *
 *   La auto-reparación en callerIdentity.ts solo dispara cuando el sector
 *   existe pero *difiere* — cuando está ausente, la condición es falsy y
 *   nunca se ejecuta. Esta función hace el reparación one-time.
 *
 * FLUJO (4 fases, igual que backfillCompletedDates):
 *   1. Dry-run: escanea usuarios + resuelve Employee SIN escribir.
 *   2. Snapshot: guarda el estado previo en MigrationRecord (reversible).
 *   3. Apply: aplana data.data.* → data.*, alinea sector_id con Employee,
 *      y escribe con el patrón limpio (sector_id como parámetro top-level,
 *      que el SDK guarda en data.sector_id — NUNCA `data: { sector_id }`).
 *   4. Marca el MigrationRecord como 'aplicado'.
 *
 * Recibe { dry_run: boolean }. Si dry_run=true (default), solo fase 1.
 * Admin-only — toce datos de User de todos los sectores.
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — solo admin' }, { status: 403 });

    const sb = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const { dry_run = true } = body;

    // ── Fase 1: Cargar usuarios + empleados en paralelo ──
    const [allUsers, allEmployees] = await Promise.all([
      sb.entities.User.list('-created_date', 500),
      fetchAll(sb, 'Employee', {}),
    ]);

    // Mapas de Employee: email → employee, user_id → employee
    const empByEmail = new Map();
    const empByUid = new Map();
    for (const emp of allEmployees) {
      const email = (emp.email || '').toLowerCase().trim();
      if (email) empByEmail.set(email, emp);
      if (emp.user_id) empByUid.set(emp.user_id, emp);
    }

    // ── Analizar cada usuario ──
    const candidatos = [];
    const saltadosCorrectos = [];
    const saltadosSinEmployee = [];
    const snapshots = [];

    for (const u of allUsers) {
      const userEmail = (u.email || '').toLowerCase().trim();

      // Resolver Employee: email primero, user_id fallback
      let employee = userEmail ? empByEmail.get(userEmail) || null : null;
      if (!employee && u.id) employee = empByUid.get(u.id) || null;

      // Sin Employee con sector_id → no hay nada que alinear
      if (!employee?.sector_id) {
        saltadosSinEmployee.push({ id: u.id, email: u.email, full_name: u.full_name });
        continue;
      }

      const employeeSector = employee.sector_id;
      const currentData = u.data || {};
      // La RLS lee EXCLUSIVAMENTE user.data.sector_id — no el top-level sector_id.
      // Si data.sector_id está ausente, el RLS falla aunque u.sector_id esté seteado.
      const currentDataSector = currentData.sector_id ?? null;
      // Detección de basura: data.data.* anidado (de escrituras legacy que
      // pasaban `data: { sector_id }` al SDK). Hay que aplanarlo para que
      // data.sector_id quede en el nivel correcto.
      const hasNestedGarbage =
        currentData.data && typeof currentData.data === 'object' &&
        !Array.isArray(currentData.data);

      // Candidato si: sector_id ausente/mal alineado O hay basura que aplanar.
      const sectorMismatch = currentDataSector !== employeeSector;
      const needsFlatten = Boolean(hasNestedGarbage);

      // Ya correcto y sin basura → idempotente, saltar
      if (!sectorMismatch && !needsFlatten) {
        saltadosCorrectos.push({ id: u.id, email: u.email, sector: currentDataSector });
        continue;
      }

      // Candidato a reparación
      snapshots.push({
        id: u.id,
        snapshot: { data: currentData, sector_id: u.sector_id },
      });
      candidatos.push({
        id: u.id,
        email: u.email,
        full_name: u.full_name,
        sector_anterior: currentDataSector,
        sector_nuevo: employeeSector,
        employee_name: employee.full_name,
        employee_role: employee.role,
        top_level_sector_id: u.sector_id ?? null,
        has_nested_garbage: needsFlatten,
        nested_keys: hasNestedGarbage ? Object.keys(currentData.data) : [],
      });
    }

    // ── Dry-run: devolver reporte sin escribir ──
    if (dry_run) {
      return Response.json({
        ok: true,
        mode: 'dry_run',
        total_usuarios: allUsers.length,
        total_a_reparar: candidatos.length,
        candidatos,
        saltados_correctos: saltadosCorrectos.length,
        saltados_sin_employee: saltadosSinEmployee.length,
        message: 'Dry-run completado. Reejecutá con dry_run=false para aplicar (previo snapshot automático).',
      });
    }

    // Si no hay candidatos (todos limpios), salir idempotente sin crear MigrationRecord.
    if (candidatos.length === 0) {
      return Response.json({
        ok: true,
        mode: 'aplicado',
        migration_id: null,
        total_usuarios: allUsers.length,
        total_reparados: 0,
        total_fallidos: 0,
        saltados_correctos: saltadosCorrectos.length,
        saltados_sin_employee: saltadosSinEmployee.length,
        errors: [],
        message: 'No hay usuarios para reparar — todos están limpios.',
      });
    }

    // ── Fase 2+3: Snapshot + Apply ──
    const results = { updated: 0, failed: 0, errors: [] };

    for (const c of candidatos) {
      try {
        const u = allUsers.find((x) => x.id === c.id);
        const currentData = u?.data || {};

        // ── Aplanar data.data.* → data.* (eliminar doble anidamiento) ──
        // Las escrituras legacy pasaban `data: { sector_id }` al SDK, que lo
        // almacenaba como `data.data = { sector_id }` en lugar de `data.sector_id`.
        // Promovemos las keys anidadas al nivel superior, SIN sobrescribir keys
        // que ya existen en el nivel superior (sector_base, role, etc.).
        let flattenedData = { ...currentData };
        if (flattenedData.data && typeof flattenedData.data === 'object' && !Array.isArray(flattenedData.data)) {
          const nested = flattenedData.data;
          // Merge: las keys del nivel superior tienen prioridad sobre las anidadas
          // (evita que un sector_base stale del nivel anidado pise el correcto).
          flattenedData = { ...nested, ...flattenedData };
          delete flattenedData.data;
        }

        // ── Alinear sector_id con la ficha Employee (fuente canónica) ──
        flattenedData.sector_id = c.sector_nuevo;

        // ── Escritura limpia: sector_id como parámetro top-level ──
        // El SDK del service role almacena parámetros top-level dentro del blob
        // `data`. Pasar `data: { ... }` crea `data.data` (doble anidamiento).
        await sb.entities.User.update(c.id, flattenedData);
        results.updated++;
      } catch (e) {
        results.failed++;
        results.errors.push({ id: c.id, email: c.email, error: e?.message || 'error desconocido' });
      }
    }

    // ── Fase 4: Registrar MigrationRecord con snapshots ──
    let migrationId = null;
    if (snapshots.length > 0) {
      const migration = await sb.entities.MigrationRecord.create({
        migration_type: 'reparar_sector_id_usuario',
        entity_name: 'User',
        snapshots,
        snapshot_completo: true,
        estado: results.failed > 0 ? 'revertido_parcial' : 'aplicado',
        total_registros: snapshots.length,
        aplicado_at: new Date().toISOString(),
        aplicado_por: user.email || 'admin',
        notas: `Reparación data.sector_id en User — ${results.updated} reparados, ${results.failed} fallidos — ejecutado por ${user.email}`,
        sector_id: 'sistema',
      });
      migrationId = migration.id;
    }

    return Response.json({
      ok: true,
      mode: 'aplicado',
      migration_id: migrationId,
      total_usuarios: allUsers.length,
      total_reparados: results.updated,
      total_fallidos: results.failed,
      saltados_correctos: saltadosCorrectos.length,
      saltados_sin_employee: saltadosSinEmployee.length,
      errors: results.errors,
      message: `Reparación aplicada: ${results.updated} usuarios reparados, ${results.failed} fallidos. Snapshot guardado en MigrationRecord ${migrationId || '(sin cambios)'} para rollback.`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}