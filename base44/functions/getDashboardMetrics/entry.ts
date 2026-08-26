import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { esOtVencida } from '../../shared/otVencimiento.ts';
import { resolveAndReconcileSector } from '../../shared/callerIdentity.ts';
import { fetchAll } from '../../shared/fetchAllSector.ts';
import { round2 } from '../../shared/round2.ts';

/**
 * KPIs del Dashboard computados sobre el TOTAL que el usuario puede ver (sin
 * truncar). Regla de oro: backend-first.
 *
 * Antes esta función sólo computaba KPIs sector-wide (para admins). Los jefes
 * quedaban fuera y el Dashboard los contaba client-side sobre .list(150) →
 * subreporte en cuanto un jefe superaba 150 OTs, y como la query 'workorders'
 * se persiste en IndexedDB, al montar se hidrataba con 150 viejos → contadores
 * desactualizados que recién se corregían al refetch ("hay que recargar varias
 * veces").
 *
 * Ahora:
 *  - Super-admin (admin/gerente sin rol de campo): KPIs sector-wide (igual que
 *    antes), con queries filtradas por estado (eficiente).
 *  - No super-admin (jefe/inspector/técnico/user): KPIs scopeados al usuario
 *    (created_by_id == user.id OR jefe_sitio_email == user.email), espejo del
 *    RLS de WorkOrder/Pendiente. Se traen TODAS sus OTs/pendientes paginando
 *    (sin tope 150) y se computan los KPIs en JS — contadores exactos.
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
// Espejo exacto de useCurrentUser.isSuperAdmin.
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

// fetchAll (base44/shared/fetchAllSector.ts): paginación robusta con cursor
// $gte + dedupe por id de la boundary — no saltea registros con created_date
// idéntico (imports masivos).

// Merge+dedupe por id (para juntar created_by_id ∪ jefe_sitio_email sin dobles).
function mergeDedupe(lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const r of list) {
      if (r && r.id && !seen.has(r.id)) { seen.add(r.id); out.push(r); }
    }
  }
  return out;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const sb = base44.asServiceRole;

    // Resolución CANÓNICA del sector: ficha Employee primero, reconciliando
    // user.data.sector_id si está desfasado (igual que getWorkOrdersForUser).
    // Antes leíamos solo user.data.sector_id → KPIs sobre sector equivocado
    // hasta re-login.
    const { sector: callerSector, employee } = await resolveAndReconcileSector(sb, user);
    if (!callerSector) {
      return Response.json({ error: 'Sin sector asignado' }, { status: 403 });
    }

    // ── Resolver permisos + rol de empleado (espejo del frontend) ──
    // Reutiliza la ficha Employee ya resuelta en resolveAndReconcileSector.
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
    const thisMonthStr = dateOnly(thisMonthStart);

    // REGLA DE ORO — vencimiento de OT (base44/shared/otVencimiento.ts):
    // una OT está vencida SÓLO si está en en_progreso y HOY superó su fecha
    // programada (scheduled_date). Pendiente/asignada/obra/validación nunca
    // se cuentan como vencidas. Aplica a ambos sectores de forma idéntica.

    const sec = { sector_id: callerSector };
    // Scope de usuario para no-super-admin (espejo del RLS de WorkOrder/Pendiente).
    const userEmail = (user.email || '').toLowerCase().trim();
    const userScopeQueries = isSuperAdmin ? null : [
      { created_by_id: user.id },
      { jefe_sitio_email: userEmail },
    ];

    // ── WorkOrder ──
    let pendingOrders = null,
      inProgressOrders = null,
      overdueOrders = null,
      completedThisMonth = null,
      urgentOrders = null,
      efficiency = null;
    if (canRead('WorkOrder')) {
      if (isSuperAdmin) {
        // KPIs de pipeline ACTIVO: excluyen archivadas (las archivadas son del
        // historial, no del tablero activo). archivada: { $ne: true } cubre
        // tanto true como ausente (default false).
        const notArchived = { archivada: { $ne: true } };
        const [pend, prog, compMonth, urgent, compl, nonCancel] = await Promise.all([
          fetchAll(sb, 'WorkOrder', { ...sec, ...notArchived, status: { $in: ['pendiente', 'asignada'] } }),
          fetchAll(sb, 'WorkOrder', { ...sec, ...notArchived, status: 'en_progreso' }),
          fetchAll(sb, 'WorkOrder', { ...sec, ...notArchived, status: 'completada', completed_date: { $gte: thisMonthStr } }),
          fetchAll(sb, 'WorkOrder', { ...sec, ...notArchived, status: { $in: ['pendiente', 'asignada', 'en_progreso', 'obra', 'pendiente_validacion'] }, priority: { $in: ['urgente', 'alta'] } }),
          fetchAll(sb, 'WorkOrder', { ...sec, ...notArchived, status: 'completada' }),
          fetchAll(sb, 'WorkOrder', { ...sec, ...notArchived, status: { $ne: 'cancelada' } }),
        ]);
        pendingOrders = pend.length;
        inProgressOrders = prog.length;
        // Vencidas: OTs en en_progreso que superaron su fecha programada (regla de oro).
        overdueOrders = prog.filter(o => esOtVencida(o, now)).length;
        completedThisMonth = compMonth.length;
        urgentOrders = urgent.length;
        const validOrders = nonCancel.length;
        efficiency = validOrders > 0 ? Math.round((compl.length / validOrders) * 100) : 0;
      } else {
        // Jefe/operario: traer TODAS sus OTs (paginado, sin tope 150) y contar en JS.
        const lists = await Promise.all(
          userScopeQueries.map((q) => fetchAll(sb, 'WorkOrder', { ...sec, ...q }))
        );
        const mine = mergeDedupe(lists);
        // Pipeline activo: excluye archivadas (historial).
        const activeMine = mine.filter((o) => !o.archivada);
        pendingOrders = activeMine.filter((o) => ['pendiente', 'asignada'].includes(o.status)).length;
        inProgressOrders = activeMine.filter((o) => o.status === 'en_progreso').length;
        overdueOrders = activeMine.filter(o => esOtVencida(o, now)).length;
        completedThisMonth = activeMine.filter((o) => o.completed_date && o.status === 'completada' && new Date(o.completed_date) >= thisMonthStart).length;
        urgentOrders = activeMine.filter((o) => ['pendiente', 'asignada', 'en_progreso', 'obra', 'pendiente_validacion'].includes(o.status) && ['urgente', 'alta'].includes(o.priority)).length;
        const validOrders = activeMine.filter((o) => o.status !== 'cancelada').length;
        const compl = activeMine.filter((o) => o.status === 'completada').length;
        efficiency = validOrders > 0 ? Math.round((compl / validOrders) * 100) : 0;
      }
    }

    // ── Project ──
    let activeProjects = null, totalProjects = null;
    if (canRead('Project')) {
      const [allP, activeP] = await Promise.all([
        fetchAll(sb, 'Project', sec),
        fetchAll(sb, 'Project', { ...sec, status: 'en_progreso' }),
      ]);
      totalProjects = allP.length;
      activeProjects = activeP.length;
    }

    // ── Client ──
    let activeClients = null, totalClients = null;
    if (canRead('Client')) {
      const [allC, activeC] = await Promise.all([
        fetchAll(sb, 'Client', sec),
        fetchAll(sb, 'Client', { ...sec, status: 'activo' }),
      ]);
      totalClients = allC.length;
      activeClients = activeC.length;
    }

    // ── Employee ──
    let activeEmployees = null;
    if (canRead('Employee')) {
      const activeE = await fetchAll(sb, 'Employee', { ...sec, status: 'activo' });
      activeEmployees = activeE.length;
    }

    // ── Invoice ──
    let revenueThisMonth = null, revenueLastMonth = null, revenueTrend = null, pendingInvoices = null;
    if (canRead('Invoice')) {
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthStr = dateOnly(lastMonthStart);
      const [thisM, lastM, pendInv] = await Promise.all([
        fetchAll(sb, 'Invoice', { ...sec, status: 'pagada', payment_date: { $gte: thisMonthStr } }),
        fetchAll(sb, 'Invoice', { ...sec, status: 'pagada', payment_date: { $gte: lastMonthStr, $lt: thisMonthStr } }),
        fetchAll(sb, 'Invoice', { ...sec, status: 'pendiente' }),
      ]);
      revenueThisMonth = round2(thisM.reduce((s, i) => s + (i.total || 0), 0));
      revenueLastMonth = round2(lastM.reduce((s, i) => s + (i.total || 0), 0));
      revenueTrend = revenueLastMonth > 0 ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100) : 0;
      pendingInvoices = round2(pendInv.reduce((s, i) => s + (i.total || 0), 0));
    }

    // ── Material ──
    let lowStockItems = null, totalMaterials = null;
    if (canRead('Inventory')) {
      const allM = await fetchAll(sb, 'Material', sec);
      totalMaterials = allM.length;
      lowStockItems = allM.filter((m) => m.stock <= m.min_stock && m.min_stock > 0).length;
    }

    // ── Asset ──
    let overdueAssets = null;
    if (canRead('Asset')) {
      const od = await fetchAll(sb, 'Asset', { ...sec, next_maintenance: { $lt: now.toISOString() } });
      overdueAssets = od.length;
    }

    // ── Pendientes ──
    let pendientesActivos = null, pendientesResueltos = null, pendientesUrgentes = null;
    if (canRead('Pendientes')) {
      if (isSuperAdmin) {
        const [act, res, urg] = await Promise.all([
          fetchAll(sb, 'Pendiente', { ...sec, estado: { $in: ['pendiente', 'asignado', 'en_progreso'] } }),
          fetchAll(sb, 'Pendiente', { ...sec, estado: 'resuelto' }),
          fetchAll(sb, 'Pendiente', { ...sec, prioridad: 'urgente', estado: { $ne: 'resuelto' } }),
        ]);
        pendientesActivos = act.length;
        pendientesResueltos = res.length;
        pendientesUrgentes = urg.length;
      } else {
        const lists = await Promise.all(
          userScopeQueries.map((q) => fetchAll(sb, 'Pendiente', { ...sec, ...q }))
        );
        const mine = mergeDedupe(lists);
        pendientesActivos = mine.filter((p) => ['pendiente', 'asignado', 'en_progreso'].includes(p.estado)).length;
        pendientesResueltos = mine.filter((p) => p.estado === 'resuelto').length;
        pendientesUrgentes = mine.filter((p) => p.prioridad === 'urgente' && p.estado !== 'resuelto').length;
      }
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