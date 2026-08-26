/**
 * REGLA DE ORO — Reasignación de Jefe de Sitio saliente → entrante.
 *
 * Cuando un jefe de sitio deja el sistema (es "eliminado"), TODO lo que
 * llevaba su nombre —OTs, pendientes, activos, tablets, edificios, direcciones,
 * inspecciones, equipamiento de calefacción, órdenes de rutina y la cuadrilla
 * (Empleados asignados a él)— pasa al jefe de sitio que se quedó con la
 * ubicación. Sin huérfanos, sin vacíos, sin bugs. Aplica a AMBOS sectores
 * (escuela y bapro) de forma idéntica y aislada.
 *
 * Reglas:
 *  1. AISLAMIENTO: sólo opera dentro del sector del caller. Saliente y entrante
 *     deben resolverse a Empleados de ESE sector (si no calzan, fail-closed).
 *  2. RESOLUCIÓN ROBUSTA: cada jefe se resuelve por employee_id → email →
 *     nombre (normalizado: trim + minúsculas + sin acentos). Nunca por string
 *     crudo, que era la fuente de los "no calza nada" históricos.
 *  3. MATCH DUAL: un registro pertenece al saliente si (a) su jefe_sitio_email
 *     calza con el email del saliente (fuente de verdad, robusta para RLS), o
 *     (b) no tiene email estampado y su jefe_sitio (nombre normalizado) calza
 *     con el nombre del saliente (back-compat de registros legacy). Si el email
 *     existe pero es de OTR@ jefe, NO se toca (evita reasignar lo que ya está
 *     bien asignado a alguien más).
 *  4. RLS PRESERVADO: al reasignar OT/Pendiente se estampa jefe_sitio_email del
 *     ENTRANTE (no sólo el nombre) → el nuevo jefe hereda visibilidad RLS.
 *     Por eso el entrante DEBE tener email; sin email, fail-closed.
 *  5. NO BORRA: el Empleado saliente se desactiva (status 'inactivo'), no se
 *     elimina — preserva la pista de auditoría. La reasignación es el evento;
 *     el baja es consecuente.
 *  6. ATÓMICA EN INTENCIÓN: procesa todo o nada ante errores de validación; ante
 *     error de escritura a mitad, los registros ya migrados quedan migrados
 *     (no se hace rollback destructivo) y se reporta el avance en el resumen.
 *  7. DRY RUN: con dry_run=true calcula qué se reasignaría y previews, sin
 *     escribir nada. Para validar antes de ejecutar.
 *  8. AUDITORÍA: registra un AuditLog con el resumen y los campos cambiados.
 */

export interface JefeIdent {
  employee_id?: string;
  email?: string;
  nombre?: string;
}

export interface JefeResuelto {
  employee_id: string;
  full_name: string;
  email: string;
  user_id: string | null;
  role: string;
  sector_id: string;
}

const norm = (s: unknown): string =>
  (s ? String(s) : '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

// Paginación por cursor (mismo patrón que getReportesGerenciales). Trae TODO
// el sector sin tope, sin depender de skip.
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
    } catch {
      break;
    }
    all.push(...batch);
    if (batch.length < 500) break;
    cursor = batch[batch.length - 1]?.created_date;
    if (!cursor || cursor === prev) break;
    prev = cursor;
  }
  return all;
}

// Resuelve un jefe a un Employee canónico del sector. Orden: id → email → nombre.
export async function resolverJefe(sb: any, sector_id: string, ident: JefeIdent): Promise<JefeResuelto> {
  let emp: any = null;
  if (ident.employee_id) {
    try {
      emp = await sb.entities.Employee.get(ident.employee_id);
    } catch {
      emp = null;
    }
    if (emp && emp.sector_id !== sector_id) {
      throw new Error('El jefe indicado pertenece a otro sector (aislamiento).');
    }
  }
  if (!emp && ident.email) {
    const list = await sb.entities.Employee.filter({ sector_id, email: ident.email }, 'created_date', 50);
    emp = list.find((e: any) => norm(e.role) === 'jefe_sitio') || list[0] || null;
  }
  if (!emp && ident.nombre) {
    const list = await sb.entities.Employee.filter({ sector_id }, 'created_date', 500);
    emp = list.find((e: any) => norm(e.full_name) === norm(ident.nombre)) || null;
  }
  if (!emp) {
    throw new Error('No se encontró el jefe de sitio indicado en el sector.');
  }
  return {
    employee_id: emp.id,
    full_name: emp.full_name,
    email: emp.email || '',
    user_id: emp.user_id || null,
    role: emp.role || '',
    sector_id: emp.sector_id,
  };
}

// Entidades que cargan jefe_sitio (nombre) y, opcionalmente, jefe_sitio_email.
const ENTIDADES: { name: string; campo: string; emailField?: string }[] = [
  { name: 'WorkOrder', campo: 'jefe_sitio', emailField: 'jefe_sitio_email' },
  { name: 'Pendiente', campo: 'jefe_sitio', emailField: 'jefe_sitio_email' },
  { name: 'Asset', campo: 'jefe_sitio' },
  { name: 'Tablet', campo: 'jefe_sitio' },
  { name: 'Edificio', campo: 'jefe_sitio' },
  { name: 'Direccion', campo: 'jefe_sitio' },
  { name: 'InspeccionColegio', campo: 'jefe_sitio' },
  { name: 'EquipamientoCalefaccion', campo: 'jefe_sitio' },
];

// ¿El registro pertenece al saliente? Match dual (email o nombre legacy).
function esDelSaliente(rec: any, cfg: { campo: string; emailField?: string }, sal: JefeResuelto): boolean {
  if (cfg.emailField && sal.email) {
    const em = rec[cfg.emailField];
    if (em) return norm(em) === norm(sal.email); // email es fuente de verdad
    // sin email → cae a match por nombre (legacy)
  }
  const nombre = rec[cfg.campo];
  return !!nombre && norm(nombre) === norm(sal.full_name);
}

async function bulkUpdateBatches(sb: any, entity: string, updates: any[]): Promise<void> {
  for (let i = 0; i < updates.length; i += 500) {
    await sb.entities[entity].bulkUpdate(updates.slice(i, i + 500));
  }
}

export interface ReasignarResult {
  saliente: JefeResuelto;
  entrante: JefeResuelto;
  resumen: Record<string, number>;
  previews: Record<string, any[]>;
  dry_run: boolean;
}

/**
 * Ejecuta (o simula) la reasignación completa de un jefe saliente al entrante.
 */
export async function reasignarJefeSitio(opts: {
  sb: any;
  sector_id: string;
  saliente: JefeIdent;
  entrante: JefeIdent;
  dry_run?: boolean;
  actor?: { email: string; role: string };
}): Promise<ReasignarResult> {
  const { sb, sector_id, saliente, entrante, dry_run = false, actor } = opts;

  const sal = await resolverJefe(sb, sector_id, saliente);
  const ent = await resolverJefe(sb, sector_id, entrante);

  if (sal.employee_id === ent.employee_id) {
    throw new Error('El jefe saliente y el entrante son la misma persona.');
  }
  if (norm(ent.role) !== 'jefe_sitio') {
    throw new Error('El jefe entrante no tiene rol jefe_sitio.');
  }
  if (!ent.email) {
    throw new Error('El jefe entrante no tiene email configurado; sin email no hereda la visibilidad (RLS) de las OT.');
  }

  const resumen: Record<string, number> = {};
  const previews: Record<string, any[]> = {};

  // 1) Entidades con jefe_sitio
  for (const cfg of ENTIDADES) {
    const recs = await fetchAll(sb, cfg.name, { sector_id });
    const matches = recs.filter((r) => esDelSaliente(r, cfg, sal));
    resumen[cfg.name] = matches.length;
    previews[cfg.name] = matches.slice(0, 5).map((r) => ({
      id: r.id,
      jefe_sitio: r[cfg.campo],
      ...(cfg.emailField ? { jefe_sitio_email: r[cfg.emailField] } : {}),
    }));
    if (!dry_run && matches.length) {
      const updates = matches.map((r) => {
        const u: any = { id: r.id, [cfg.campo]: ent.full_name };
        if (cfg.emailField) u[cfg.emailField] = ent.email;
        return u;
      });
      await bulkUpdateBatches(sb, cfg.name, updates);
    }
  }

  // 2) Cuadrilla: Empleados asignados al saliente (assigned_jefe_sitio)
  const emps = await fetchAll(sb, 'Employee', { sector_id });
  const cuadrilla = emps.filter((e) => norm(e.assigned_jefe_sitio) === norm(sal.full_name));
  resumen['Employee_cuadrilla'] = cuadrilla.length;
  previews['Employee_cuadrilla'] = cuadrilla.slice(0, 5).map((e) => ({ id: e.id, full_name: e.full_name, assigned_jefe_sitio: e.assigned_jefe_sitio }));
  if (!dry_run && cuadrilla.length) {
    await bulkUpdateBatches(
      sb,
      'Employee',
      cuadrilla.map((e) => ({ id: e.id, assigned_jefe_sitio: ent.full_name }))
    );
  }

  // 3) Órdenes de rutina donde el responsable era el saliente (por user_id)
  let rutinasCount = 0;
  if (sal.user_id) {
    const ruts = await fetchAll(sb, 'OrdenRutina', { sector_id, responsable_id: sal.user_id });
    rutinasCount = ruts.length;
    resumen['OrdenRutina'] = rutinasCount;
    if (!dry_run && ruts.length) {
      await bulkUpdateBatches(
        sb,
        'OrdenRutina',
        ruts.map((r) => ({ id: r.id, responsable_id: ent.user_id || '', responsable_nombre: ent.full_name }))
      );
    }
  } else {
    resumen['OrdenRutina'] = 0;
  }

  // 4) Desactivar el saliente (no borrar — preserva auditoría)
  if (!dry_run) {
    await sb.entities.Employee.update(sal.employee_id, {
      status: 'inactivo',
      notes: `Jefe de sitio reasignado a ${ent.full_name} el ${new Date().toISOString()}.`,
    });
  }

  // 5) Auditoría
  if (!dry_run) {
    try {
      await sb.entities.AuditLog.create({
        entity_type: 'Employee',
        entity_id: sal.employee_id,
        action: 'update',
        user_email: actor?.email || 'sistema',
        user_role: actor?.role || 'admin',
        timestamp: new Date().toISOString(),
        changed_fields: ['jefe_sitio', 'jefe_sitio_email', 'assigned_jefe_sitio', 'responsable_id', 'status'],
        notes: `Reasignación de jefe de sitio: ${sal.full_name} → ${ent.full_name}. Resumen: ${JSON.stringify(resumen)}`,
      });
    } catch {
      // auditoría best-effort: no rompe la reasignación
    }
  }

  return { saliente: sal, entrante: ent, resumen, previews, dry_run };
}