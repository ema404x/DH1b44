import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { esOtVencida } from '../../shared/otVencimiento.ts';
import { resolveAndReconcileSector } from '../../shared/callerIdentity.ts';
import { fetchAll } from '../../shared/fetchAllSector.ts';
import { round2 } from '../../shared/round2.ts';
import { resolveAdminView, resolveEstablecimientosDeJefe, norm } from '../../shared/visibilityResolver.ts';
import { getVisibleWorkOrders } from '../../shared/workOrderVisibility.ts';

/**
 * KPIs del Dashboard computados sobre el TOTAL que el usuario puede ver (sin
 * truncar). Regla de oro: backend-first, fuente única de visibilidad.
 *
 * Visibilidad de OT: delegada a getVisibleWorkOrders (workOrderVisibility.ts),
 * el MISMO predicado que usan la página Órdenes y el Portal Operario. Así los
 * contadores del Dashboard son idénticos a los de las otras vistas — sin
 * lógica de scope duplicada (antes había computeIsSuperAdmin + userScopeQueries
 * + mergeDedupe que omitía assigned_to/nombre/linkage y generaba discrepancias).
 *
 * Performance: antes ~17 fetchAll (6 sobre WorkOrder solo). Ahora 8 fetchAll
 * totales — uno por módulo — disparados en un único Promise.all, con los KPIs
 * computados en memoria sobre el array ya cargado. WorkOrder pasó de 6 recorridos
 * paginados a 1.
 *
 * Reglas innegociables:
 *  - Fail closed en sector: si el usuario no tiene sector_id → 403.
 *  - Permisos: cada grupo de métricas se gatea por el permiso de lectura del
 *    módulo correspondiente (espejo de usePermission/roles.js). Si no aplica,
 *    se devuelve null.
 */

const normalizeRole = (r) =>
  (r || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const FIELD_ROLES = ['jefe_sitio', 'jefe de sitio', 'inspector', 'tecnico', 'supervisor', 'operario', 'operario_portal'];
const ADMIN_LEVEL_ROLES = ['admin', 'gerente', 'gerencia', 'administrativo', 'gerente_general'];

function isFieldRole(r) { return FIELD_ROLES.includes(normalizeRole(r)); }
function isAdminLevelRole(r) { return ADMIN_LEVEL_ROLES.includes(normalizeRole(r)); }
// Espejo exacto de useCurrentUser.isSuperAdmin. Se devuelve en la respuesta para
// que el frontend no deba recalcularlo (algunos componentes lo consumen del
// payload del Dashboard). NO se usa para scope de OT — eso lo resuelve
// getVisibleWorkOrders via admin_view del rol del empleado.
function computeIsSuperAdmin(platformRole, employeeRole) {
  if ((platformRole === 'admin' && !isFieldRole(employeeRole)) ||
      platformRole === 'gerente' ||
      isAdminLevelRole(employeeRole)) return true;
  return false;
}

function canReadModule(perms, moduleKey) {
  const p = perms?.[moduleKey];
  if (!p) return false;
  if (p.read === true) return true;
  if (p.admin_view === true) return true;
  return false;
}

const dateOnly = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const sb = base44.asServiceRole;

    // Resolución CANÓNICA del sector: ficha Employee primero, reconciliando
    // user.data.sector_id si está desfasado (igual que getWorkOrdersForUser).
    const { sector: callerSector, employee } = await resolveAndReconcileSector(sb, user);
    if (!callerSector) {
      return Response.json({ error: 'Sin sector asignado' }, { status: 403 });
    }

    // ── Resolver permisos + rol de empleado (espejo del frontend) ──
    let perms = {};
    let employeeRole = null;
    if (user.role !== 'admin') {
      employeeRole = employee?.role || user.role || '';
      if (employeeRole) {
        try {
          const allRps = await sb.entities.RolePermission.list('created_date', 500);
          const rp = allRps.find((r) => normalizeRole(r.role_name) === normalizeRole(employeeRole));
          if (rp?.permissions) perms = rp.permissions;
        } catch {}
      }
    }
    const isSuperAdmin = computeIsSuperAdmin(user.role, employeeRole);
    const canRead = (moduleKey) =>
      user.role === 'admin' ? true : canReadModule(perms, moduleKey);

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const sec = { sector_id: callerSector };

    // ── Disparar TODAS las cargas de datos en paralelo ──
    // Un fetchAll por módulo; KPIs se computan en memoria sobre el array ya
    // cargado. getVisibleWorkOrders es la fuente única de OTs visibles (mismo
    // predicado que Órdenes/Portal) — un solo recorrido paginado de WorkOrder
    // reemplaza los 6 que había antes.
    const loadKeys = [];
    const loadPromises = [];
    if (canRead('WorkOrder')) {
      loadKeys.push('workorders');
      loadPromises.push(getVisibleWorkOrders(sb, user).then((r) => r.orders));
    }
    if (canRead('Project')) {
      loadKeys.push('projects');
      loadPromises.push(fetchAll(sb, 'Project', sec));
    }
    if (canRead('Client')) {
      loadKeys.push('clients');
      loadPromises.push(fetchAll(sb, 'Client', sec));
    }
    if (canRead('Employee')) {
      loadKeys.push('employees');
      loadPromises.push(fetchAll(sb, 'Employee', { ...sec, status: 'activo' }));
    }
    if (canRead('Invoice')) {
      loadKeys.push('invoices');
      loadPromises.push(fetchAll(sb, 'Invoice', { ...sec, status: { $in: ['pagada', 'pendiente'] } }));
    }
    if (canRead('Inventory')) {
      loadKeys.push('materials');
      loadPromises.push(fetchAll(sb, 'Material', sec));
    }
    if (canRead('Asset')) {
      loadKeys.push('assets');
      loadPromises.push(fetchAll(sb, 'Asset', { ...sec, next_maintenance: { $lt: now.toISOString() } }));
    }
    if (canRead('Pendientes')) {
      loadKeys.push('pendientes');
      loadPromises.push(fetchAll(sb, 'Pendiente', sec));
    }

    const loadedValues = await Promise.all(loadPromises);
    const loaded = {};
    loadKeys.forEach((k, i) => { loaded[k] = loadedValues[i]; });

    // ── WorkOrder KPIs (1 sola carga, filtros en memoria) ──
    // Pipeline activo: excluye archivadas (las archivadas son del historial,
    // no del tablero activo). archivada: { $ne: true } en JS equivale a !o.archivada
    // (cubre tanto true como ausente/default false).
    let pendingOrders = null,
      inProgressOrders = null,
      overdueOrders = null,
      completedThisMonth = null,
      urgentOrders = null,
      efficiency = null;
    if (loaded.workorders) {
      const active = loaded.workorders.filter((o) => !o.archivada);
      pendingOrders = active.filter((o) => ['pendiente', 'asignada'].includes(o.status)).length;
      inProgressOrders = active.filter((o) => o.status === 'en_progreso').length;
      // Vencidas: OTs en en_progreso que superaron su fecha programada (regla de oro).
      overdueOrders = active.filter((o) => esOtVencida(o, now)).length;
      completedThisMonth = active.filter((o) => o.completed_date && o.status === 'completada' && new Date(o.completed_date) >= thisMonthStart).length;
      urgentOrders = active.filter((o) => ['pendiente', 'asignada', 'en_progreso', 'obra', 'pendiente_validacion'].includes(o.status) && ['urgente', 'alta'].includes(o.priority)).length;
      const validOrders = active.filter((o) => o.status !== 'cancelada').length;
      const compl = active.filter((o) => o.status === 'completada').length;
      efficiency = validOrders > 0 ? Math.round((compl / validOrders) * 100) : 0;
    }

    // ── Project ──
    let activeProjects = null, totalProjects = null;
    if (loaded.projects) {
      totalProjects = loaded.projects.length;
      activeProjects = loaded.projects.filter((p) => p.status === 'en_progreso').length;
    }

    // ── Client ──
    let activeClients = null, totalClients = null;
    if (loaded.clients) {
      totalClients = loaded.clients.length;
      activeClients = loaded.clients.filter((c) => c.status === 'activo').length;
    }

    // ── Employee ──
    let activeEmployees = null;
    if (loaded.employees) {
      activeEmployees = loaded.employees.length;
    }

    // ── Invoice ──
    let revenueThisMonth = null, revenueLastMonth = null, revenueTrend = null, pendingInvoices = null;
    if (loaded.invoices) {
      const inv = loaded.invoices;
      const paidThisM = inv.filter((i) => i.status === 'pagada' && i.payment_date && new Date(i.payment_date) >= thisMonthStart);
      const paidLastM = inv.filter((i) => i.status === 'pagada' && i.payment_date && new Date(i.payment_date) >= lastMonthStart && new Date(i.payment_date) < thisMonthStart);
      const pend = inv.filter((i) => i.status === 'pendiente');
      revenueThisMonth = round2(paidThisM.reduce((s, i) => s + (i.total || 0), 0));
      revenueLastMonth = round2(paidLastM.reduce((s, i) => s + (i.total || 0), 0));
      revenueTrend = revenueLastMonth > 0 ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100) : 0;
      pendingInvoices = round2(pend.reduce((s, i) => s + (i.total || 0), 0));
    }

    // ── Material ──
    let lowStockItems = null, totalMaterials = null;
    if (loaded.materials) {
      totalMaterials = loaded.materials.length;
      lowStockItems = loaded.materials.filter((m) => m.stock <= m.min_stock && m.min_stock > 0).length;
    }

    // ── Asset ──
    let overdueAssets = null;
    if (loaded.assets) {
      overdueAssets = loaded.assets.length;
    }

    // ── Pendientes ──
    // Visibilidad regida por admin_view (Ver Todo) del rol del empleado — no por
    // isSuperAdmin. Un gerente sin admin_view para Pendientes ve solo los propios
    // + los de sus establecimientos asignados. Sin ficha de empleado (super-admin
    // puro) → admin_view=true → todo el sector.
    let pendientesActivos = null, pendientesResueltos = null, pendientesUrgentes = null;
    if (loaded.pendientes) {
      const allPends = loaded.pendientes;
      const pendAdminView = await resolveAdminView(sb, employee, 'Pendientes');
      let mine;
      if (pendAdminView) {
        mine = allPends;
      } else {
        const establecimientos = await resolveEstablecimientosDeJefe(sb, callerSector, employee?.full_name || user.full_name || '');
        const uEmail = (user.email || '').toLowerCase().trim();
        mine = allPends.filter((p) =>
          (p.created_by_id && p.created_by_id === user.id) ||
          (p.jefe_sitio_email && p.jefe_sitio_email.toLowerCase().trim() === uEmail) ||
          (p.establecimiento && establecimientos.has(norm(p.establecimiento))) ||
          (p.sitio && establecimientos.has(norm(p.sitio)))
        );
      }
      pendientesActivos = mine.filter((p) => ['pendiente', 'asignado', 'en_progreso'].includes(p.estado)).length;
      pendientesResueltos = mine.filter((p) => p.estado === 'resuelto').length;
      pendientesUrgentes = mine.filter((p) => p.prioridad === 'urgente' && p.estado !== 'resuelto').length;
    }

    return Response.json({
      sector: callerSector,
      isSuperAdmin,
      activeProjects, totalProjects,
      pendingOrders, inProgressOrders, overdueOrders, completedThisMonth, urgentOrders, efficiency,
      activeClients, totalClients, activeEmployees,
      revenueThisMonth, revenueLastMonth, revenueTrend, pendingInvoices,
      lowStockItems, totalMaterials, overdueAssets,
      pendientesActivos, pendientesResueltos, pendientesUrgentes,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}