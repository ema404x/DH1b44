// base44/shared/workOrderVisibility.ts
//
// REGLA DE ORO — Visibilidad de Órdenes de Trabajo (OT).
// Fuente ÚNICA de verdad para qué OTs ve un usuario. La usan
// getWorkOrdersForUser, getAlertasForUser, getDashboardMetrics y cualquier
// backend que necesite el set de OTs del caller. Aplica a AMBOS sectores
// (escuela y bapro) de forma idéntica — sin defaults de sector hardcodeados.
//
// REGLA:
//  Un usuario ve una OT si, y sólo si:
//    1. La OT pertenece a SU sector (aislamiento entre sectores), Y
//    2. Cumple alguna condición de visibilidad según su rol:
//       a. Admin-view (permiso "Ver Todo" del rol del EMPLEADO en Control de
//          Acceso, o super-admin puro sin ficha de empleado): ve TODAS las
//          OTs del sector. El rol de plataforma NUNCA hace bypass: un
//          jefe_sitio con platformRole='admin' se rige por el admin_view de
//          su ficha de empleado, igual que en Inspecciones/Pendientes.
//       b. Rol de campo (jefe_sitio / operario / inspector / ...): ve las
//          OTs donde es creador, jefe_sitio (por email), asignado (por id o
//          nombre), o que fueron creadas/asignadas por su jefe de sitio
//          (linkage Tablet → jefe, sector-scoped).
//       c. Sin ficha de campo ni admin-view: ve las que creó o le asignaron.
//
//  Fail-safes (sin vacíos ni bugs):
//   - Sin sector resuelto → el caller no opera (fail-closed, resuelto arriba).
//   - OT sin sector_id → EXCLUIDA (nunca se atribuye a un sector por default;
//     corrige el bug del default 'escuela' que fugaba OTs bapro al sector
//     escuela cuando sector_id venía vacío).
//   - Datos faltantes (assigned_to, jefe_sitio_email, nombre) → predicado
//     false para esa rama, sin falsos positivos.
//
//  Determinismo: el set completo se trae con fetchAll ($gte + $nin + dedupe
//  por id) — sin cap, sin saltos en boundaries de created_date idéntico. El
//  burbujeo de OTs recién tocadas se preserva con sort -updated_date (regla
//  de oro: una OT vieja iniciada por QR bubbla al top para quedar visible).
//
//  Aislamiento: cada query de carga/linkage estampa sector_id explícitamente
//  Y el predicado lo re-verifica (defense-in-depth). No se usa el client
//  scoped para no ocultar la intención; el chequeo doble es auditable.

import { resolveAndReconcileSector } from "./callerIdentity.ts";
import { resolveAdminView, norm } from "./visibilityResolver.ts";
import { isFieldRole } from "./roles.ts";
import { fetchAll } from "./fetchAllSector.ts";

/** Contexto de visibilidad del caller — todo lo necesario para evaluar el predicado. */
export interface OtVisibilityContext {
  userId: string;
  userEmail: string;
  employeeName: string;
  employeeRole: string;
  sector: string;
  /** platform admin o permiso "Ver Todo" (admin_view) del rol de empleado. */
  isAdminView: boolean;
  /** Rol de campo (jefe_sitio / operario / inspector / ...). */
  isField: boolean;
  /** Linkage jefe de sitio (Tablet→Employee), sector-scoped. Null si no aplica. */
  jefe: { userId: string | null; email: string; name: string } | null;
  /**
   * Forzar scope "solo propias": ignora admin-view y el linkage jefe de campo.
   * El caller ve estrictamente las OTs donde es creador, asignado o jefe_sitio.
   * Usado por el Dashboard para mostrar la actividad del usuario actual sin
   * importar el rol (incluso admins ven solo sus propias OTs).
   */
  forceOwnOnly?: boolean;
}

/** Resultado canónico de getVisibleWorkOrders. */
export interface VisibleWorkOrdersResult {
  orders: any[];
  total: number;
  archived_count: number;
  role: string;
  ctx: OtVisibilityContext | null;
}

/**
 * Construye el contexto de visibilidad del caller en UNA pasada:
 *  1. Resuelve la identidad canónica (sector + empleado) desde la ficha
 *     Employee (fuente de verdad) y reconcilia la plataforma best-effort.
 *  2. Resuelve admin_view desde el rol del EMPLEADO (no plataforma) —
 *     cierra el bug del jefe_sitio con platformRole='admin' que veía todo.
 *  3. Resuelve el linkage jefe (Tablet→Employee) sólo para roles de campo.
 *
 * Sector-agnóstico, idempotente, fail-safe. Devuelve null si el caller no
 * tiene sector (fail-closed — la función caller debe responder 403).
 *
 * @param sb client service-role (base44.asServiceRole) — NO scoped, porque
 *            la resolución de identidad debe encontrar al empleado por email
 *            sin restringir por sector (el sector SE descubre acá).
 */
export async function buildOtVisibilityContext(
  sb: any,
  user: any,
  options: { forceOwnOnly?: boolean } = {},
): Promise<OtVisibilityContext | null> {
  const { sector, employee } = await resolveAndReconcileSector(sb, user);
  if (!sector) return null;

  const userId = user?.id || '';
  const userEmail = (user?.email || '').toLowerCase().trim();
  const employeeRole = (employee?.role || '').toLowerCase().trim();
  const employeeName = employee?.full_name || user?.full_name || '';

  // Admin-view: permiso explícito "Ver Todo" del rol del EMPLEADO en Control
  // de Acceso (RolePermission), o super-admin puro (sin ficha de empleado).
  // El rol de plataforma NUNCA hace bypass: un jefe_sitio con
  // platformRole='admin' se rige por el admin_view de su ficha, igual que el
  // cliente (useCurrentUser.isSuperAdmin). Cierra el leak donde el jefe veía
  // TODAS las OTs del sector sin tener "Ver Todo" tildado en Control de Acceso.
  const isAdminView = await resolveAdminView(sb, employee, 'WorkOrder');
  const isField = isFieldRole(employeeRole);

  // Linkage jefe de sitio: el operario de campo ejecuta el trabajo que le
  // pide su jefe. Debe ver TODAS las OTs que ese jefe crea (incluso las no
  // asignadas nominalmente). Linkage canónico: Tablet (nombre==nombre del
  // operario) → jefe_sitio. Fallback: Employee.assigned_jefe_sitio.
  // Sector-scoped (aislamiento entre sectores): un jefe de otro sector no
  // se linkea. Si no hay linkage, no se suma nada (comportamiento previo).
  let jefe: OtVisibilityContext['jefe'] = null;
  if (isField && employeeName) {
    try {
      let jefeNameStr = '';
      const tablets = await sb.entities.Tablet.filter({
        sector_id: sector,
        nombre: employeeName,
      });
      const tablet = tablets.find((t: any) => norm(t.nombre) === norm(employeeName));
      if (tablet?.jefe_sitio) jefeNameStr = tablet.jefe_sitio;
      if (!jefeNameStr && employee?.assigned_jefe_sitio) {
        jefeNameStr = employee.assigned_jefe_sitio;
      }
      if (jefeNameStr) {
        const jefeEmps = await sb.entities.Employee.filter({
          sector_id: sector,
          full_name: jefeNameStr,
        });
        const jefeEmp =
          jefeEmps.find((e: any) => norm(e.full_name) === norm(jefeNameStr)) || null;
        jefe = jefeEmp
          ? {
              userId: jefeEmp.user_id || null,
              email: (jefeEmp.email || '').toLowerCase().trim(),
              name: jefeEmp.full_name || jefeNameStr,
            }
          : { userId: null, email: '', name: jefeNameStr };
      }
    } catch {
      // fail-safe: sin linkage, el operario igual ve sus OTs propias.
      jefe = null;
    }
  }

  return {
    userId,
    userEmail,
    employeeName,
    employeeRole,
    sector,
    isAdminView,
    isField,
    jefe,
    forceOwnOnly: options.forceOwnOnly === true,
  };
}

/**
 * PREDICADO ÚNICO de visibilidad — la regla de oro. Una OT es visible para el
 * caller si pertenece a su sector Y cumple la condición de su rol.
 *
 * Pure function (sin I/O): se puede usar para filtrar cualquier array de OTs
 * ya cargadas (Kanban, alertas, dashboard) con el mismo ctx, garantizando
 * consistencia entre todos los consumidores.
 */
export function otEsVisiblePara(ot: any, ctx: OtVisibilityContext): boolean {
  if (!ot || !ctx) return false;

  // Aislamiento entre sectores + fail-closed: OT sin sector_id → excluida.
  // (Antes: (ot.sector_id || 'escuela') === sector — atribuía OTs bapro sin
  //  sector_id al sector escuela. Ahora se exige sector_id explícito.)
  if (!ot.sector_id || ot.sector_id !== ctx.sector) return false;

  // a. Admin-view: todo el sector. Se salta cuando forceOwnOnly=true (Dashboard
  //    "siempre del usuario actual"): incluso admins ven solo sus propias OTs.
  if (ctx.isAdminView && !ctx.forceOwnOnly) return true;

  const myName = norm(ctx.employeeName);
  const otName = norm(ot.assigned_name);
  const otJefeName = norm(ot.jefe_sitio);

  // Visibilidad PROPIA (todos los roles autenticados con sector):
  // creador, jefe por email, asignado por id, asignado por nombre, o
  // jefe_sitio por nombre.
  const propia =
    (!!ot.created_by_id && ot.created_by_id === ctx.userId) ||
    (!!ot.jefe_sitio_email && ot.jefe_sitio_email.toLowerCase().trim() === ctx.userEmail) ||
    (!!ot.assigned_to && ot.assigned_to === ctx.userId) ||
    (!!myName && !!otName && otName === myName) ||
    (!!myName && !!otJefeName && otJefeName === myName);
  if (propia) return true;

  // b. Linkage jefe (sólo roles de campo): OTs creadas por su jefe, o donde
  // el jefe es responsable por email/nombre. Se salta en scope "solo propias":
  // el usuario ve estrictamente sus OTs (creador/asignado/jefe_sitio), no las
  // derivadas de su linkage de jefe.
  if (ctx.isField && ctx.jefe && !ctx.forceOwnOnly) {
    return (
      (!!ctx.jefe.userId && !!ot.created_by_id && ot.created_by_id === ctx.jefe.userId) ||
      (!!ctx.jefe.email && !!ot.jefe_sitio_email &&
        ot.jefe_sitio_email.toLowerCase().trim() === ctx.jefe.email) ||
      (!!ctx.jefe.name && !!otJefeName && otJefeName === norm(ctx.jefe.name))
    );
  }

  // c. Sin ficha de campo ni admin-view: sólo propia (ya evaluada → false).
  return false;
}

/**
 * Carga el set completo de OTs visibles para el caller. ÚNICA API que los
 * backends deberían usar para listar OTs.
 *
 * Determinístico (fetchAll, sin saltos), sector-agnóstico, con burbujeo por
 * -updated_date. Devuelve { orders, total, role, ctx } — el ctx permite
 * re-filtrar el mismo set en otros módulos (alertas, dashboard) sin recalcular
 * la identidad.
 */
export async function getVisibleWorkOrders(
  sb: any,
  user: any,
  options: { excludeArchived?: boolean; forceOwnOnly?: boolean } = {},
): Promise<VisibleWorkOrdersResult> {
  const ctx = await buildOtVisibilityContext(sb, user, { forceOwnOnly: options.forceOwnOnly });
  if (!ctx) return { orders: [], total: 0, role: null, ctx: null };

  // fetchAll trae TODAS las OTs del sector (activas + archivadas) en una sola
  // llamada. El predicado otEsVisiblePara se aplica UNA vez sobre el set
  // completo — el caller decide si quiere solo activas (excludeArchived) o
  // todas. El archived_count sale gratis porque ya tenemos el set en memoria.
  const all = await fetchAll(sb, 'WorkOrder', { sector_id: ctx.sector }, '-updated_date');

  // Split en memoria post-visibilidad: activas y archivadas, ambas ya filtradas
  // por otEsVisiblePara (defense-in-depth — el predicado es la última barrera).
  const allVisible = all.filter((ot: any) => otEsVisiblePara(ot, ctx));
  const archivadas = allVisible.filter((o: any) => o.archivada);
  const activas = allVisible.filter((o: any) => !o.archivada);

  return {
    orders: options.excludeArchived ? activas : allVisible,
    total: (options.excludeArchived ? activas : allVisible).length,
    archived_count: archivadas.length,
    role: ctx.isAdminView ? 'admin' : ctx.employeeRole || 'user',
    ctx,
  };
}