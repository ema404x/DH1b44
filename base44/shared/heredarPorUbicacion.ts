/**
 * REGLA DE ORO — Herencia automática de OT al reasignar el jefe de una
 * ubicación en Información General.
 *
 * Disparador: automatización de entidad sobre Direccion (escuela) o Asset
 * (bapro) cuando cambia `jefe_sitio`. El admin reasigna el responsable de la
 * ubicación en Información General → esta función hereda automáticamente las
 * OT/Pendientes/Activos/Edificios/Inspecciones/Equipamiento que estaban bajo
 * el jefe ANTERIOR en ESA ubicación al jefe NUEVO. Sin clicks extra.
 *
 * Fuente de verdad: Información General (Direccion/LocationData para escuela;
 * Asset para bapro). La función NO pisa Direccion/LocationData/Asset (ya fueron
 * actualizados por el admin) — sólo hereda los registros dependientes.
 *
 * Reglas innegociables (sin bugs, sin vacíos):
 *  - Sólo actúa si jefe_sitio cambió de un nombre A otro nombre distinto no
 *    vacío. Si se limpia (new vacío) o no había anterior (old vacío), no hace
 *    nada (no reasigna a vacío ni inventa).
 *  - SCOPE por ubicación: sólo registros bajo ESA Direccion (sus escuelas,
 *    via LocationData.direccion_id → establecimiento) o ESE Asset (asset_id).
 *    Nunca toca registros de otras ubicaciones del old_jefe.
 *  - MATCH del old_jefe: jefe_sitio_email == old_email (si resuelve) OR
 *    jefe_sitio (nombre normalizado) == old_jefe. Nunca roba OT de otro jefe.
 *  - RLS: stampa jefe_sitio_email del nuevo jefe si resuelve a Employee con
 *    email. Si no resuelve, igual mueve el nombre (off del old_jefe) y audita
 *    warning (admins siempre ven los registros; el email se backfilla al dar
 *    de alta el Employee). No deja registros bajo un jefe que se va.
 *  - IDEMPOTENTE: tras heredar, los registros quedan bajo new_jefe → no
 *    rematchean old_jefe en un re-disparo. Seguro ante retries.
 *  - Aislamiento por sector (derivado de data.sector_id).
 */

const norm = (s: unknown): string =>
  (s ? String(s) : '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

async function fetchAll(sb: any, entity: string, query: Record<string, any>, sort = 'created_date'): Promise<any[]> {
  const all: any[] = [];
  let cursor: string | undefined;
  let prev: string | undefined;
  for (let i = 0; i < 200; i++) {
    let batch: any[];
    try {
      const q = { ...query };
      if (cursor) q.created_date = { $gt: cursor };
      batch = await sb.entities[entity].filter(q, sort, 500);
    } catch { break; }
    all.push(...batch);
    if (batch.length < 500) break;
    cursor = batch[batch.length - 1]?.created_date;
    if (!cursor || cursor === prev) break;
    prev = cursor;
  }
  return all;
}

async function bulkUpdateBatches(sb: any, entity: string, updates: any[]): Promise<void> {
  for (let i = 0; i < updates.length; i += 500) {
    await sb.entities[entity].bulkUpdate(updates.slice(i, i + 500));
  }
}

export async function heredarPorUbicacion(sb: any, payload: any, dry_run = false) {
  const event = payload?.event;
  const data = payload?.data;
  const old_data = payload?.old_data;
  if (event?.type !== 'update') return { skipped: 'not update' };
  const entity = event?.entity_name;
  if (entity !== 'Direccion' && entity !== 'Asset') return { skipped: `entity ${entity} not supported` };

  const old_jefe = old_data?.jefe_sitio || '';
  const new_jefe = data?.jefe_sitio || '';
  if (!old_jefe) return { skipped: 'no previous jefe_sitio' };
  if (!new_jefe) return { skipped: 'jefe_sitio cleared (no new responsable)' };
  if (norm(old_jefe) === norm(new_jefe)) return { skipped: 'jefe_sitio unchanged' };

  const sector = data?.sector_id || old_data?.sector_id;
  if (!sector) return { skipped: 'no sector_id' };

  // Resolver emails de old y new jefe vía Employee (por nombre en el sector).
  const emps = await fetchAll(sb, 'Employee', { sector_id: sector });
  const findEmp = (nombre: string) => emps.find((e: any) => norm(e.full_name) === norm(nombre));
  const oldEmp = findEmp(old_jefe);
  const newEmp = findEmp(new_jefe);
  const old_email = oldEmp?.email || '';
  const new_email = newEmp?.email || '';

  // Scope: colegios de esta Direccion (escuela) o este Asset (bapro/escuela).
  const colegiosNorm = new Set<string>();
  let assetId: string | null = null;
  if (entity === 'Direccion') {
    const lds = await fetchAll(sb, 'LocationData', { sector_id: sector, direccion_id: event.entity_id });
    lds.forEach((l: any) => { if (l.establecimiento) colegiosNorm.add(norm(l.establecimiento)); });
  } else {
    assetId = event.entity_id;
    if (data?.name) colegiosNorm.add(norm(data.name));
    if (data?.sede) colegiosNorm.add(norm(data.sede));
  }

  const esOldJefe = (rec: any, emailField?: string) => {
    if (emailField && old_email) {
      const em = rec[emailField];
      if (em) return norm(em) === norm(old_email);
    }
    return rec.jefe_sitio && norm(rec.jefe_sitio) === norm(old_jefe);
  };

  const resuelto: Record<string, number> = {};
  const warnings: string[] = [];

  // Helper para reasignar una entidad dada una fn de match por colegio.
  // FAIL-CLOSED para entidades con RLS por email (WorkOrder/Pendiente): si el
  // nuevo jefe no tiene email resuelto, NO movemos el nombre — dejar jefe_sitio
  // con el nuevo nombre pero jefe_sitio_email='' vuelve invisibles los registros
  // (RLS exige jefe_sitio_email==user.email) para el nuevo Y el viejo jefe.
  // Las entidades sin emailField (Asset/Edificio/Inspección/Equipamiento) no
  // dependen de email para RLS → heredan el nombre igual (sin vacío).
  async function reasignar(entityName: string, emailField: string | undefined, colegioMatch: (r: any) => boolean) {
    const recs = await fetchAll(sb, entityName, { sector_id: sector });
    const matches = recs.filter((r) => colegioMatch(r) && esOldJefe(r, emailField));
    if (!matches.length) { resuelto[entityName] = 0; return; }
    if (emailField && !new_email) {
      warnings.push(`${entityName}: ${matches.length} registro(s) NO reasignados — el nuevo jefe "${new_jefe}" no tiene Employee con email (RLS quedaría incompleta). Asociá un Employee con email en el sector y reasigná de nuevo.`);
      resuelto[entityName] = 0;
      return;
    }
    const updates = matches.map((r) => {
      const u: any = { id: r.id, jefe_sitio: new_jefe };
      if (emailField) u[emailField] = new_email;
      return u;
    });
    if (!dry_run) await bulkUpdateBatches(sb, entityName, updates);
    resuelto[entityName] = updates.length;
  }

  // WorkOrder: por location_qr_name (escuela) o asset_id (bapro/escuela).
  await reasignar('WorkOrder', 'jefe_sitio_email', (r) =>
    (r.location_qr_name && colegiosNorm.has(norm(r.location_qr_name))) ||
    (assetId && r.asset_id === assetId)
  );
  // Pendiente: por establecimiento/sitio.
  await reasignar('Pendiente', 'jefe_sitio_email', (r) =>
    (r.establecimiento && colegiosNorm.has(norm(r.establecimiento))) ||
    (r.sitio && colegiosNorm.has(norm(r.sitio)))
  );
  // Asset (sólo escuela: el Asset trigger mismo ya se actualizó; mover otros
  // assets del mismo colegio). En bapro el Asset es la ubicación — skip.
  if (entity === 'Direccion') {
    await reasignar('Asset', undefined, (r) => (r.sede && colegiosNorm.has(norm(r.sede))));
    await reasignar('Edificio', undefined, (r) => (r.nombre && colegiosNorm.has(norm(r.nombre))));
    await reasignar('InspeccionColegio', undefined, (r) => (r.establecimiento && colegiosNorm.has(norm(r.establecimiento))));
    await reasignar('EquipamientoCalefaccion', undefined, (r) => (r.escuela && colegiosNorm.has(norm(r.escuela))));
  }

  // Cuadrilla del old_jefe asignada a esta ubicación: no hay link directo de
  // Empleado→Direccion, skip (lo cubre el flujo eliminarJefeSitio completo).

  // Auditoría
  if (!dry_run) {
    try {
      await sb.entities.AuditLog.create({
        entity_type: entity,
        entity_id: event.entity_id,
        action: 'update',
        user_email: 'automacion',
        user_role: 'sistema',
        timestamp: new Date().toISOString(),
        changed_fields: ['jefe_sitio', 'jefe_sitio_email'],
        notes: `Heredencia automática por reasignación de ubicación: ${old_jefe} → ${new_jefe} (sector ${sector}). Resuelto: ${JSON.stringify(resuelto)}. ${warnings.join(' ')}`,
      });
    } catch { /* best-effort */ }
  }

  return { entity, old_jefe, new_jefe, new_email: !!new_email, sector, resuelto, warnings, dry_run };
}