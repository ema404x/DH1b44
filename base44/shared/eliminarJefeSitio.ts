/**
 * REGLA DE ORO — Eliminar Jefe de Sitio y heredar sus OT al responsable ACTUAL
 * de cada ubicación. Fuente de verdad: el módulo Información General.
 *
 * Flujo profesional (ambos sectores, aislado):
 *  1. El admin, en Información General, reasigna los colegios/ubicaciones del
 *     jefe saliente al nuevo jefe (Direccion/LocationData.jefe_sitio para
 *     escuela; Asset.jefe_sitio para bapro). Esa es la fuente de verdad.
 *  2. El admin elimina al jefe del módulo Empleados → dispara esta función.
 *  3. La función, para CADA OT/Pendiente/Activo/etc. que llevaba el sello del
 *     saliente (jefe_sitio name, jefe_sitio_email, created_by_id), resuelve el
 *     NUEVO responsable buscando la ubicación del registro en Información
 *     General (LocationData.jefe_sitio para escuela vía location_qr_name/
 *     establecimiento; Asset.jefe_sitio para bapro vía asset_id) y le hereda
 *     el registro (stampea jefe_sitio + jefe_sitio_email para preservar RLS).
 *  4. Elimina el Employee saliente (no lo desactiva — el admin lo elimina).
 *
 * Reglas innegociables (sin bugs, sin vacíos):
 *  - AISLAMIENTO: sólo opera en el sector del caller. Saliente resuelto en sector.
 *  - FUENTE DE VERDAD: el nuevo responsable se LEE de Información General; no
 *    es un parámetro libre. Si el admin NO reasignó el colegio (el jefe_sitio
 *    de la ubicación sigue siendo el saliente o está vacío), ese registro se
 *    reporta como "sin_resolver" y NO se toca (fail-closed: nunca adivinar ni
 *    reasignar al propio saliente).
 *  - RLS PRESERVADO: el nuevo responsable debe resolverse a un Employee con
 *    email (para stampar jefe_sitio_email). Si no tiene email, el registro se
 *    reporta como "sin_resolver" (no dejar OTs invisibles).
 *  - DIRECCION/LOCATIONDATA (escuela) y ASSET (bapro) SON la fuente de verdad:
 *    no se pisan acá. Si todavía llevan el nombre del saliente, se reportan
 *    como "ubicaciones_pendientes" para que el admin las reasigne en IG.
 *  - MATCH DEL SALIENTE: un registro es del saliente si (a) jefe_sitio_email
 *    calza con su email, o (b) jefe_sitio (nombre normalizado) calza, o
 *    (c) created_by_id == saliente.user_id (las OT que CREÓ — el user pidió
 *    explícito "jefe que creó una OT"). Si el email existe pero es de otro
 *    jefe, no se toca.
 *  - DRY RUN: calcula y reporta sin escribir ni borrar.
 *  - AUDITORÍA: registra AuditLog con el resumen.
 *  - OVERRIDE opcional: si se pasa `jefe_entrante` (nombre), se usa ese para
 *    TODOS los registros (modo reasignación manual explícita, sin resolver
 *    por ubicación). Útil para Tablet y para el caso de un solo entrante.
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

interface Indexes {
  // Información General — escuela
  ldByEst: Map<string, string>;      // norm(establecimiento) -> jefe_sitio
  ldById: Map<string, string>;       // id -> jefe_sitio
  // Información General — bapro (Asset es la ubicación)
  assetById: Map<string, any>;        // id -> Asset
  assetBySede: Map<string, string>;   // norm(sede) -> jefe_sitio
  // LocationQR (escuela) — para resolver OT.location_qr_id -> nombre -> LD
  lqrById: Map<string, string>;       // id -> name
  // Empleados (resolver nombre de jefe -> email/user_id)
  empByName: Map<string, { email: string; user_id: string | null; employee_id: string } | null>;
}

async function buildIndexes(sb: any, sector_id: string): Promise<Indexes> {
  const [lds, assets, lqrs, emps] = await Promise.all([
    fetchAll(sb, 'LocationData', { sector_id }),
    fetchAll(sb, 'Asset', { sector_id }),
    fetchAll(sb, 'LocationQR', { sector_id }),
    fetchAll(sb, 'Employee', { sector_id }),
  ]);
  const ldByEst = new Map<string, string>();
  const ldById = new Map<string, string>();
  for (const l of lds) {
    if (l.establecimiento) ldByEst.set(norm(l.establecimiento), l.jefe_sitio || '');
    ldById.set(l.id, l.jefe_sitio || '');
  }
  const assetById = new Map<string, any>();
  const assetBySede = new Map<string, string>();
  for (const a of assets) {
    assetById.set(a.id, a);
    if (a.sede) assetBySede.set(norm(a.sede), a.jefe_sitio || '');
  }
  const lqrById = new Map<string, string>();
  for (const q of lqrs) lqrById.set(q.id, q.name || '');
  const empByName = new Map<string, { email: string; user_id: string | null; employee_id: string } | null>();
  for (const e of emps) {
    if (e.full_name) empByName.set(norm(e.full_name), { email: e.email || '', user_id: e.user_id || null, employee_id: e.id });
  }
  return { ldByEst, ldById, assetById, assetBySede, lqrById, empByName };
}

// Resuelve un nombre de jefe (desde IG) a {email, user_id} vía Employee.
function resolverJefePorNombre(idx: Indexes, nombre: string): { nombre: string; email: string; user_id: string | null } | null {
  if (!nombre) return null;
  const emp = idx.empByName.get(norm(nombre));
  if (emp && emp.email) return { nombre, email: emp.email, user_id: emp.user_id };
  return null; // sin Employee con email → fail-closed
}

// Resuelve el responsable ACTUAL de una ubicación dadas claves candidatas.
// Devuelve el jefe_sitio (nombre) leído de Información General, o null.
// Cada clave es { tipo: 'ldEst'|'ldId'|'assetId'|'assetSede'|'lqrToEst', valor }.
function resolverResponsableUbicacion(idx: Indexes, keys: { tipo: string; valor: string }[]): string | null {
  for (const k of keys) {
    if (!k.valor) continue;
    const v = k.valor;
    switch (k.tipo) {
      case 'ldEst': {
        const j = idx.ldByEst.get(norm(v));
        if (j) return j;
        break;
      }
      case 'ldId': {
        const j = idx.ldById.get(v);
        if (j) return j;
        break;
      }
      case 'assetId': {
        const a = idx.assetById.get(v);
        if (a && a.jefe_sitio) return a.jefe_sitio;
        break;
      }
      case 'assetSede': {
        const j = idx.assetBySede.get(norm(v));
        if (j) return j;
        break;
      }
      case 'lqrToEst': {
        // v = location_qr_id → nombre del QR → LD por establecimiento
        const qrName = idx.lqrById.get(v);
        if (qrName) {
          const j = idx.ldByEst.get(norm(qrName));
          if (j) return j;
        }
        break;
      }
    }
  }
  return null;
}

// ¿El registro pertenece al saliente?
// Match por email (fuente de verdad RLS) o por nombre. Si el registro no tiene
// jefe_sitio estampado, se acepta created_by_id == saliente.user_id (OT huérfana
// creada por el saliente sin sello de jefe). Nunca se roban OT cuyo jefe es otro.
function esDelSaliente(rec: any, cfg: { emailField?: string }, sal: { nombre: string; email: string; user_id: string | null }): boolean {
  if (cfg.emailField && sal.email) {
    const em = rec[cfg.emailField];
    if (em) return norm(em) === norm(sal.email);
  }
  const nombre = rec.jefe_sitio;
  if (nombre && norm(nombre) === norm(sal.nombre)) return true;
  if (!nombre && sal.user_id && rec.created_by_id === sal.user_id) return true;
  return false;
}

// Claves candidatas por entidad para resolver la ubicación en IG.
function clavesUbicacion(rec: any, entity: string): { tipo: string; valor: string }[] {
  switch (entity) {
    case 'WorkOrder':
      return [
        { tipo: 'ldEst', valor: rec.location_qr_name },
        { tipo: 'lqrToEst', valor: rec.location_qr_id },
        { tipo: 'assetId', valor: rec.asset_id },
        { tipo: 'ldEst', valor: rec.location },
      ];
    case 'Pendiente':
      return [
        { tipo: 'ldEst', valor: rec.establecimiento },
        { tipo: 'ldEst', valor: rec.sitio },
      ];
    case 'Asset':
      return [
        { tipo: 'ldId', valor: rec.location_id },
        { tipo: 'ldEst', valor: rec.sede },
      ];
    case 'Edificio':
      return [
        { tipo: 'ldId', valor: rec.location_id },
        { tipo: 'ldEst', valor: rec.nombre },
      ];
    case 'InspeccionColegio':
      return [{ tipo: 'ldEst', valor: rec.establecimiento }];
    case 'EquipamientoCalefaccion':
      return [{ tipo: 'ldEst', valor: rec.escuela }];
    default:
      return [];
  }
}

const ENTIDADES_HERENCIA: { name: string; emailField?: string }[] = [
  { name: 'WorkOrder', emailField: 'jefe_sitio_email' },
  { name: 'Pendiente', emailField: 'jefe_sitio_email' },
  { name: 'Asset' },
  { name: 'Edificio' },
  { name: 'InspeccionColegio' },
  { name: 'EquipamientoCalefaccion' },
  { name: 'Tablet' }, // sin ubicación: usa entrante global
];

export interface EliminarResult {
  saliente: { nombre: string; email: string; user_id: string | null; employee_id: string | null };
  resuelto: Record<string, number>;
  sinResolver: Record<string, any[]>;
  ubicacionesPendientes: { Direccion: any[]; LocationData: any[]; Asset: any[] };
  entrantesUsados: Record<string, number>; // nombre -> # registros heredados a ese jefe
  empleado_eliminado: boolean;
  dry_run: boolean;
  auditoria: boolean;
}

export async function eliminarJefeSitio(opts: {
  sb: any;
  sector_id: string;
  empleado_id?: string;
  jefe_saliente?: string;
  jefe_entrante?: string; // override explícito (modo manual)
  dry_run?: boolean;
  actor?: { email: string; role: string };
}): Promise<EliminarResult> {
  const { sb, sector_id, dry_run = false, actor } = opts;

  // ── Resolver saliente ──
  let sal: { nombre: string; email: string; user_id: string | null; employee_id: string | null };
  if (opts.empleado_id) {
    const emp = await sb.entities.Employee.get(opts.empleado_id);
    if (emp.sector_id !== sector_id) throw new Error('El empleado pertenece a otro sector (aislamiento).');
    sal = { nombre: emp.full_name, email: emp.email || '', user_id: emp.user_id || null, employee_id: emp.id };
  } else if (opts.jefe_saliente) {
    const name = opts.jefe_saliente.trim();
    const list = await sb.entities.Employee.filter({ sector_id }, 'created_date', 500);
    const emp = list.find((e: any) => norm(e.full_name) === norm(name));
    sal = emp
      ? { nombre: emp.full_name, email: emp.email || '', user_id: emp.user_id || null, employee_id: emp.id }
      : { nombre: name, email: '', user_id: null, employee_id: null };
  } else {
    throw new Error('Falta empleado_id o jefe_saliente.');
  }
  if (!sal.nombre) throw new Error('No se pudo resolver el nombre del jefe saliente.');

  // ── Override entrante explícito (modo manual) ──
  let entranteOverride: { nombre: string; email: string; user_id: string | null } | null = null;
  if (opts.jefe_entrante) {
    const idx0 = await buildIndexes(sb, sector_id);
    entranteOverride = resolverJefePorNombre(idx0, opts.jefe_entrante);
    if (!entranteOverride) {
      throw new Error(`El jefe entrante "${opts.jefe_entrante}" no tiene Employee con email en el sector. Sin email no hereda RLS.`);
    }
    if (norm(entranteOverride.nombre) === norm(sal.nombre)) throw new Error('El entrante y el saliente son la misma persona.');
  }

  const idx = await buildIndexes(sb, sector_id);
  const salNorm = norm(sal.nombre);

  const resuelto: Record<string, number> = {};
  const sinResolver: Record<string, any[]> = {};
  const entrantesUsados: Record<string, number> = {};
  const ubicacionesPendientes: any = { Direccion: [], LocationData: [], Asset: [] };

  // ── Ubicaciones que todavía llevan al saliente (el admin no las reasignó en IG) ──
  // Escuela: Direccion + LocationData. Bapro: Asset.
  const dirs = await fetchAll(sb, 'Direccion', { sector_id });
  ubicacionesPendientes.Direccion = dirs.filter((d) => norm(d.jefe_sitio) === salNorm).map((d) => ({ id: d.id, direccion: d.direccion, jefe_sitio: d.jefe_sitio }));
  ubicacionesPendientes.LocationData = [...idx.ldByEst.entries()]
    .filter(([_, j]) => norm(j) === salNorm)
    .map(([est]) => ({ establecimiento: est }));
  // Assets del saliente (bapro): reportar los que aún llevan al saliente
  const assetsSector = await fetchAll(sb, 'Asset', { sector_id });
  ubicacionesPendientes.Asset = assetsSector.filter((a) => norm(a.jefe_sitio) === salNorm).map((a) => ({ id: a.id, name: a.name, sede: a.sede, jefe_sitio: a.jefe_sitio }));

  // ── Herencia por entidad ──
  for (const cfg of ENTIDADES_HERENCIA) {
    const recs = await fetchAll(sb, cfg.name, { sector_id });
    const matches = recs.filter((r) => esDelSaliente(r, cfg, sal));
    const updates: any[] = [];
    const sinRes: any[] = [];

    for (const r of matches) {
      let nuevoJefeNombre: string | null = null;
      if (entranteOverride) {
        nuevoJefeNombre = entranteOverride.nombre;
      } else if (cfg.name === 'Tablet') {
        nuevoJefeNombre = null; // se resuelve después con el entrante global
      } else {
        const j = resolverResponsableUbicacion(idx, clavesUbicacion(r, cfg.name));
        // fail-closed: si la ubicación sigue apuntando al saliente o está vacía, no heredar
        if (j && norm(j) !== salNorm && norm(j) !== '') nuevoJefeNombre = j;
      }
      if (!nuevoJefeNombre) {
        sinRes.push({ id: r.id, jefe_sitio: r.jefe_sitio, motivo: 'ubicación sin nuevo responsable en Información General' });
        continue;
      }
      const entrante = entranteOverride || resolverJefePorNombre(idx, nuevoJefeNombre);
      if (!entrante) {
        sinRes.push({ id: r.id, jefe_sitio: r.jefe_sitio, nuevo: nuevoJefeNombre, motivo: 'nuevo responsable sin Employee con email' });
        continue;
      }
      const u: any = { id: r.id, jefe_sitio: entrante.nombre };
      if (cfg.emailField) u[cfg.emailField] = entrante.email;
      updates.push(u);
      entrantesUsados[entrante.nombre] = (entrantesUsados[entrante.nombre] || 0) + 1;
    }

    resuelto[cfg.name] = updates.length;
    sinResolver[cfg.name] = sinRes;
    if (!dry_run && updates.length) await bulkUpdateBatches(sb, cfg.name, updates);
  }

  // ── Tablet: si no hay override, usar el entrante único (si hay exactamente uno) ──
  if (!entranteOverride && (resuelto['Tablet'] === 0)) {
    const tablets = await fetchAll(sb, 'Tablet', { sector_id });
    const tabletMatches = tablets.filter((t) => norm(t.jefe_sitio) === salNorm);
    if (tabletMatches.length) {
      const nombres = Object.keys(entrantesUsados);
      if (nombres.length === 1) {
        const ent = resolverJefePorNombre(idx, nombres[0]);
        if (ent) {
          if (!dry_run) {
            await bulkUpdateBatches(sb, 'Tablet', tabletMatches.map((t) => ({ id: t.id, jefe_sitio: ent.nombre })));
          }
          resuelto['Tablet'] = tabletMatches.length;
          entrantesUsados[ent.nombre] = (entrantesUsados[ent.nombre] || 0) + tabletMatches.length;
        } else {
          sinResolver['Tablet'] = tabletMatches.map((t) => ({ id: t.id, motivo: 'entrante sin email' }));
        }
      } else {
        sinResolver['Tablet'] = tabletMatches.map((t) => ({ id: t.id, motivo: 'múltiples entrantes posibles; reasignar manualmente' }));
      }
    }
  }

  // ── Cuadrilla: Empleados asignados al saliente ──
  const emps = await fetchAll(sb, 'Employee', { sector_id });
  const cuadrilla = emps.filter((e) => norm(e.assigned_jefe_sitio) === salNorm);
  resuelto['Employee_cuadrilla'] = cuadrilla.length;
  if (cuadrilla.length) {
    const entNombre = entranteOverride?.nombre || Object.keys(entrantesUsados)[0] || null;
    if (entNombre) {
      if (!dry_run) await bulkUpdateBatches(sb, 'Employee', cuadrilla.map((e) => ({ id: e.id, assigned_jefe_sitio: entNombre })));
    } else {
      sinResolver['Employee_cuadrilla'] = cuadrilla.map((e) => ({ id: e.id, motivo: 'sin entrante determinado' }));
    }
  }

  // ── Órdenes de rutina donde el responsable era el saliente (por user_id) ──
  if (sal.user_id) {
    const ruts = await fetchAll(sb, 'OrdenRutina', { sector_id, responsable_id: sal.user_id });
    if (ruts.length) {
      const entNombre = entranteOverride?.nombre || Object.keys(entrantesUsados)[0] || null;
      const ent = entNombre ? resolverJefePorNombre(idx, entNombre) : null;
      if (ent) {
        if (!dry_run) await bulkUpdateBatches(sb, 'OrdenRutina', ruts.map((r) => ({ id: r.id, responsable_id: ent.user_id || '', responsable_nombre: ent.nombre })));
        resuelto['OrdenRutina'] = ruts.length;
      } else {
        sinResolver['OrdenRutina'] = ruts.map((r) => ({ id: r.id, motivo: 'sin entrante con user_id' }));
      }
    } else {
      resuelto['OrdenRutina'] = 0;
    }
  }

  // ── Eliminar el Employee saliente ──
  let empleado_eliminado = false;
  if (!dry_run && sal.employee_id) {
    try {
      await sb.entities.Employee.delete(sal.employee_id);
      empleado_eliminado = true;
    } catch (e) {
      // no rompe la herencia ya aplicada
    }
  }

  // ── Auditoría ──
  let auditoria = false;
  if (!dry_run) {
    try {
      await sb.entities.AuditLog.create({
        entity_type: 'Employee',
        entity_id: sal.employee_id || sal.nombre,
        action: 'delete',
        user_email: actor?.email || 'sistema',
        user_role: actor?.role || 'admin',
        timestamp: new Date().toISOString(),
        changed_fields: ['jefe_sitio', 'jefe_sitio_email', 'assigned_jefe_sitio', 'responsable_id'],
        notes: `Eliminar jefe + heredar OT por IG: ${sal.nombre} eliminado. Resuelto: ${JSON.stringify(resuelto)}. Sin resolver: ${Object.keys(sinResolver).length} entidades. Ubicaciones pendientes: ${ubicacionesPendientes.Direccion.length + ubicacionesPendientes.LocationData.length + ubicacionesPendientes.Asset.length}.`,
      });
      auditoria = true;
    } catch { /* best-effort */ }
  }

  return {
    saliente: { nombre: sal.nombre, email: sal.email, user_id: sal.user_id, employee_id: sal.employee_id },
    resuelto,
    sinResolver,
    ubicacionesPendientes,
    entrantesUsados,
    empleado_eliminado,
    dry_run,
    auditoria,
  };
}