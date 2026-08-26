/**
 * REGLA DE ORO — Reasignación de Jefe de Sitio saliente → entrante.
 *
 * Fuente de verdad del responsable de cada ubicación: el módulo Información
 * General (entidades Direccion + LocationData, campo `jefe_sitio` por NOMBRE,
 * editado desde DirectorioJerarquico). Cuando un jefe de sitio deja el sistema,
 * TODO lo que llevaba su nombre pasa al jefe que se queda con la ubicación:
 * Direcciones, LocationData, Edificios, OTs, Pendientes, Activos, Tablets,
 * Inspecciones, Equipamiento de calefacción, cuadrilla (Empleados asignados) y
 * Órdenes de rutina. Sin huérfanos, sin vacíos, sin bugs. Ambos sectores
 * (escuela y bapro) de forma idéntica y aislada.
 *
 * Reglas:
 *  1. NOMBRE COMO CLAVE (no Employee): el responsable se identifica por el
 *     nombre tal como figura en Información General (Direccion/LocationData.
 *     jefe_sitio). No se exige que el jefe tenga registro Employee — pero si
 *     lo tiene, se usa su email para el match dual y su user_id para rutinas,
 *     y se lo desactiva al final.
 *  2. AISLAMIENTO: sólo opera en el sector del caller. Todo match y escritura
 *     se acota por sector_id. Saliente y entrante se resuelven dentro del sector.
 *  3. MATCH DUAL en OT/Pendiente: un registro pertenece al saliente si (a) su
 *     jefe_sitio_email calza con el email del saliente (cuando éste tiene
 *     Employee con email — fuente de verdad para RLS), o (b) no tiene email
 *     estampado y su jefe_sitio (nombre normalizado) calza con el nombre del
 *     saliente (back-compat de registros legacy). Si el email existe pero es
 *     de OTR@ jefe, NO se toca. Para el resto de entidades (sin email) se
 *     matchea sólo por nombre normalizado.
 *  4. RLS PRESERVADO: al reasignar OT/Pendiente se estampa jefe_sitio_email del
 *     ENTRANTE. Por eso el entrante DEBE tener email resuelto (vía Employee o
 *     pasado explícito); sin email, fail-closed — no se dejan OTs invisibles.
 *  5. INFORMACIÓN GENERAL ACTUALIZADA: se actualiza Direccion.jefe_sitio Y
 *     LocationData.jefe_sitio (replicando la propagación que hace
 *     DirectorioJerarquico), de modo que el responsable de cada ubicación
 *     quede consistente con las OTs/activos migrados.
 *  6. NO BORRA: el Empleado saliente (si existe) se desactiva (status
 *     'inactivo'), no se elimina — preserva auditoría.
 *  7. DRY RUN: con dry_run=true calcula qué se reasignaría y previews, sin
 *     escribir.
 *  8. AUDITORÍA: registra un AuditLog con el resumen.
 *
 * Normalización de nombres: trim + minúsculas + sin acentos (NFD). Esto resuelve
 * el mismatch histórico entre strings crudos ("Emerson Useche" vs "EMERSON
 * USECHE" vs "Emersón Useche").
 */

export type JefeInput = string | { nombre?: string; email?: string; employee_id?: string };

export interface JefeResuelto {
  nombre: string; // nombre canónico (el pasado, sin normalizar)
  email: string; // '' si no se pudo resolver
  user_id: string | null;
  employee_id: string | null;
}

const norm = (s: unknown): string =>
  (s ? String(s) : '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

// Paginación por cursor (mismo patrón que getReportesGerenciales).
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

// Normaliza el input a { nombre, email?, employee_id? }.
function parseInput(input: JefeInput): { nombre: string; email?: string; employee_id?: string } {
  if (!input) return { nombre: '' };
  if (typeof input === 'string') return { nombre: input.trim() };
  return {
    nombre: (input.nombre || '').trim(),
    email: input.email?.trim() || undefined,
    employee_id: input.employee_id?.trim() || undefined,
  };
}

// Resuelve un jefe por nombre (clave de Información General). Si hay Employee
// vinculado en el sector, trae email/user_id/employee_id para match dual,
// RLS y desactivación. Si no hay Employee, igual opera (sólo por nombre).
async function resolverJefe(
  sb: any,
  sector_id: string,
  input: JefeInput
): Promise<JefeResuelto> {
  const parsed = parseInput(input);
  if (!parsed.nombre) throw new Error('Falta el nombre del jefe de sitio.');

  // Búsqueda por employee_id explícito
  if (parsed.employee_id) {
    try {
      const emp = await sb.entities.Employee.get(parsed.employee_id);
      if (emp.sector_id !== sector_id) {
        throw new Error('El jefe indicado pertenece a otro sector (aislamiento).');
      }
      return {
        nombre: parsed.nombre,
        email: parsed.email || emp.email || '',
        user_id: emp.user_id || null,
        employee_id: emp.id,
      };
    } catch {
      // cae a búsqueda por nombre
    }
  }

  // Búsqueda por email explícito
  if (parsed.email) {
    const list = await sb.entities.Employee.filter({ sector_id, email: parsed.email }, 'created_date', 50);
    const emp = list[0];
    if (emp) {
      return {
        nombre: parsed.nombre,
        email: emp.email || parsed.email,
        user_id: emp.user_id || null,
        employee_id: emp.id,
      };
    }
    // email pasado pero sin Employee: lo respetamos (ej. entrante sin cuenta
    // pero con email conocido para RLS).
    return { nombre: parsed.nombre, email: parsed.email, user_id: null, employee_id: null };
  }

  // Búsqueda por nombre (normalizado) en el sector
  const list = await sb.entities.Employee.filter({ sector_id }, 'created_date', 500);
  const emp = list.find((e: any) => norm(e.full_name) === norm(parsed.nombre));
  if (emp) {
    return {
      nombre: parsed.nombre,
      email: emp.email || '',
      user_id: emp.user_id || null,
      employee_id: emp.id,
    };
  }

  // Sin Employee: opera sólo por nombre (sin email/user_id).
  return { nombre: parsed.nombre, email: '', user_id: null, employee_id: null };
}

// Entidades con jefe_sitio (nombre) y, opcionalmente, jefe_sitio_email.
const ENTIDADES: { name: string; campo: string; emailField?: string }[] = [
  { name: 'Direccion', campo: 'jefe_sitio' },
  { name: 'LocationData', campo: 'jefe_sitio' },
  { name: 'Edificio', campo: 'jefe_sitio' },
  { name: 'WorkOrder', campo: 'jefe_sitio', emailField: 'jefe_sitio_email' },
  { name: 'Pendiente', campo: 'jefe_sitio', emailField: 'jefe_sitio_email' },
  { name: 'Asset', campo: 'jefe_sitio' },
  { name: 'Tablet', campo: 'jefe_sitio' },
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
  return !!nombre && norm(nombre) === norm(sal.nombre);
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
 * Ejecuta (o simula) la reasignación completa de un jefe saliente al entrante,
 * guiándose por el responsable de cada ubicación (Información General).
 */
export async function reasignarJefeSitio(opts: {
  sb: any;
  sector_id: string;
  saliente: JefeInput;
  entrante: JefeInput;
  dry_run?: boolean;
  actor?: { email: string; role: string };
}): Promise<ReasignarResult> {
  const { sb, sector_id, saliente, entrante, dry_run = false, actor } = opts;

  const sal = await resolverJefe(sb, sector_id, saliente);
  const ent = await resolverJefe(sb, sector_id, entrante);

  if (norm(sal.nombre) === norm(ent.nombre)) {
    throw new Error('El jefe saliente y el entrante son la misma persona.');
  }
  if (!ent.email) {
    throw new Error(
      'El jefe entrante no tiene email resuelto. Sin email no hereda la visibilidad (RLS) de las OT. ' +
      'Asócialo a un Employee con email en el sector, o pasa jefe_entrante.email explícito.'
    );
  }

  const resumen: Record<string, number> = {};
  const previews: Record<string, any[]> = {};

  // 1) Entidades con jefe_sitio (incluye Direccion + LocationData = Información General)
  for (const cfg of ENTIDADES) {
    const recs = await fetchAll(sb, cfg.name, { sector_id });
    const matches = recs.filter((r) => esDelSaliente(r, cfg, sal));
    resumen[cfg.name] = matches.length;
    previews[cfg.name] = matches.slice(0, 5).map((r) => ({
      id: r.id,
      jefe_sitio: r[cfg.campo],
      ...(cfg.emailField ? { jefe_sitio_email: r[cfg.emailField] } : {}),
      ...(r.establecimiento ? { establecimiento: r.establecimiento } : {}),
      ...(r.direccion ? { direccion: r.direccion } : {}),
    }));
    if (!dry_run && matches.length) {
      const updates = matches.map((r) => {
        const u: any = { id: r.id, [cfg.campo]: ent.nombre };
        if (cfg.emailField) u[cfg.emailField] = ent.email;
        return u;
      });
      await bulkUpdateBatches(sb, cfg.name, updates);
    }
  }

  // 2) Cuadrilla: Empleados asignados al saliente (assigned_jefe_sitio por nombre)
  const emps = await fetchAll(sb, 'Employee', { sector_id });
  const cuadrilla = emps.filter((e) => norm(e.assigned_jefe_sitio) === norm(sal.nombre));
  resumen['Employee_cuadrilla'] = cuadrilla.length;
  previews['Employee_cuadrilla'] = cuadrilla.slice(0, 5).map((e) => ({ id: e.id, full_name: e.full_name, assigned_jefe_sitio: e.assigned_jefe_sitio }));
  if (!dry_run && cuadrilla.length) {
    await bulkUpdateBatches(
      sb,
      'Employee',
      cuadrilla.map((e) => ({ id: e.id, assigned_jefe_sitio: ent.nombre }))
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
        ruts.map((r) => ({ id: r.id, responsable_id: ent.user_id || '', responsable_nombre: ent.nombre }))
      );
    }
  } else {
    resumen['OrdenRutina'] = 0;
  }

  // 4) Desactivar el Empleado saliente (si existe; no se borra — preserva auditoría)
  if (!dry_run && sal.employee_id) {
    await sb.entities.Employee.update(sal.employee_id, {
      status: 'inactivo',
      notes: `Jefe de sitio reasignado a ${ent.nombre} el ${new Date().toISOString()}.`,
    });
  }

  // 5) Auditoría
  if (!dry_run) {
    try {
      await sb.entities.AuditLog.create({
        entity_type: 'Employee',
        entity_id: sal.employee_id || sal.nombre,
        action: 'update',
        user_email: actor?.email || 'sistema',
        user_role: actor?.role || 'admin',
        timestamp: new Date().toISOString(),
        changed_fields: ['jefe_sitio', 'jefe_sitio_email', 'assigned_jefe_sitio', 'responsable_id', 'status'],
        notes: `Reasignación de jefe de sitio: ${sal.nombre} → ${ent.nombre}. Resumen: ${JSON.stringify(resumen)}`,
      });
    } catch {
      // auditoría best-effort: no rompe la reasignación
    }
  }

  return { saliente: sal, entrante: ent, resumen, previews, dry_run };
}