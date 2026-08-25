import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

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

// Trae TODOS los registros que matchean el query, paginando de a 500 con un
// cursor sobre created_date.
async function fetchAll(sb, entity, query, sort = 'created_date') {
  const all = [];
  let cursor = undefined;
  let prev = undefined;
  for (let i = 0; i < 200; i++) {
    let batch;
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

    const callerSector = user?.data?.sector_id || user?.sector_id;
    if (!callerSector) {
      return Response.json({ error: 'Sin sector asignado' }, { status: 403 });
    }

    const sb = base44.asServiceRole;

    // ── Resolver permisos + rol de empleado (espejo del frontend) ──
    let perms = {};
    let employeeRole = null;
    if (user.role !== 'admin') {
      let emp = null;
      try {
        const byEmail = await sb.entities.Employee.filter({ email: user.email });
        emp = byEmail.find(
          (e) => (e.email || '').toLowerCase().trim() === (user.email || '').toLowerCase().trim()
        );
      } catch {}
      employeeRole = emp?.role || user.role || '';
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

    // Plazo de vencimiento de OTs del sector (AlertaConfig). El reloj de
    // vencimiento solo corre para OTs en en_progreso; arranca desde
    // fecha_inicio_real (cuando la OT entró en progreso), no desde la creación.
    let otPlazoDays = 1;
    try {
      const otCfgs = await sb.entities.AlertaConfig.filter({ tipo: 'ot_vencida', sector_id: callerSector, activo: true });
      if (otCfgs.length) otPlazoDays = otCfgs[0].dias_vencimiento_ot || 1;
    } catch {}
    const esVencida = (ot) => {
      if (ot.status !== 'en_progreso') return false;
      const startRaw = ot.fecha_inicio_real || ot.scheduled_date;
      if (!startRaw) return false;
      const t = new Date(startRaw).getTime();
      if (isNaN(t)) return false;
      return (now.getTime() - t) >= otPlazoDays * 86400000;
    };

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
        const [pend, prog, compMonth, urgent, compl, nonCancel] = await Promise.all([
          fetchAll(sb, 'WorkOrder', { ...sec, status: { $in: ['pendiente', 'asignada'] } }),
          fetchAll(sb, 'WorkOrder', { ...sec, status: 'en_progreso' }),
          fetchAll(sb, 'WorkOrder', { ...sec, status: 'completada', completed_date: { $gte: thisMonthStr } }),
          fetchAll(sb, 'WorkOrder', { ...sec, status: { $in: ['pendiente', 'asignada', 'en_progreso', 'obra', 'pendiente_validacion'] }, priority: { $in: ['urgente', 'alta'] } }),
          fetchAll(sb, 'WorkOrder', { ...sec, status: 'completada' }),
          fetchAll(sb, 'WorkOrder', { ...sec, status: { $ne: 'cancelada' } }),
        ]);
        pendingOrders = pend.length;
        inProgressOrders = prog.length;
        // Solo las OTs en en_progreso pueden estar vencidas (reloj desde
        // fecha_inicio_real, plazo = dias_vencimiento_ot del sector).
        overdueOrders = prog.filter(esVencida).length;
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
        pendingOrders = mine.filter((o) => ['pendiente', 'asignada'].includes(o.status)).length;
        inProgressOrders = mine.filter((o) => o.status === 'en_progreso').length;
        overdueOrders = mine.filter(esVencida).length;
        completedThisMonth = mine.filter((o) => o.completed_date && o.status === 'completada' && new Date(o.completed_date) >= thisMonthStart).length;
        urgentOrders = mine.filter((o) => ['pendiente', 'asignada', 'en_progreso', 'obra', 'pendiente_validacion'].includes(o.status) && ['urgente', 'alta'].includes(o.priority)).length;
        const validOrders = mine.filter((o) => o.status !== 'cancelada').length;
        const compl = mine.filter((o) => o.status === 'completada').length;
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
      revenueThisMonth = thisM.reduce((s, i) => s + (i.total || 0), 0);
      revenueLastMonth = lastM.reduce((s, i) => s + (i.total || 0), 0);
      revenueTrend = revenueLastMonth > 0 ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100) : 0;
      pendingInvoices = pendInv.reduce((s, i) => s + (i.total || 0), 0);
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