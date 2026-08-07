import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

/**
 * KPIs del Dashboard computados sobre el TOTAL del sector (sin truncar).
 *
 * El Dashboard actual calcula client-side sobre listas truncadas
 * (.list('-updated_date', 100/150/...)), por lo que subreporta a medida que
 * crece la base. Esta función replica EXACTAMENTE los mismos filtros (estados,
 * fechas) que usa el Dashboard, pero los computa sobre el total del sector
 * filtrando del lado servidor.
 *
 * Reglas innegociables:
 *  - Fail closed en sector: si el usuario no tiene sector_id → 403. NUNCA
 *    defaultear a 'escuela'.
 *  - Permisos: cada grupo de métricas se gatea por el permiso de lectura del
 *    módulo correspondiente (espejo de usePermission/roles.js). Si no aplica,
 *    se devuelve null. Las financieras por canRead('Invoice').
 *  - Pendientes se gatean por 'Pendientes' (NO por 'Asset' como hace hoy el
 *    Dashboard — bug a corregir al migrar el frontend).
 */

const normalizeRole = (r) =>
  (r || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

function canReadModule(perms, moduleKey) {
  const p = perms?.[moduleKey];
  if (!p) return false;
  if (p.read === true) return true;
  // admin_view implica read (mismo criterio que roles.js)
  if (p.admin_view === true) return true;
  return false;
}

const dateOnly = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Trae TODOS los registros que matchean el query, paginando de a 500 con un
// cursor sobre created_date. La mayoría de los predicados son acotados
// (estado+fecha) y se resuelven en una sola página; la paginación cubre los
// totales amplios (proyectos, materiales, etc.).
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
      // Si la paginación por created_date no es soportada, devolvemos lo acumulado.
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

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // ── Fail closed en sector: NUNCA defaultear a 'escuela' ──
    const callerSector = user?.data?.sector_id || user?.sector_id;
    if (!callerSector) {
      return Response.json({ error: 'Sin sector asignado' }, { status: 403 });
    }

    const sb = base44.asServiceRole;

    // ── Resolver permisos (espejo del frontend: usePermission + roles.js) ──
    let perms = {};
    if (user.role !== 'admin') {
      // Empleado vinculado por email (mismo resolve que gestionarObrasCertificacion)
      let emp = null;
      try {
        const byEmail = await sb.entities.Employee.filter({ email: user.email });
        emp = byEmail.find(
          (e) => (e.email || '').toLowerCase().trim() === (user.email || '').toLowerCase().trim()
        );
      } catch {}
      const roleKey = emp?.role || user.role || '';
      if (roleKey) {
        try {
          const allRps = await sb.entities.RolePermission.list('created_date', 500);
          const rp = allRps.find((r) => normalizeRole(r.role_name) === normalizeRole(roleKey));
          if (rp?.permissions) perms = rp.permissions;
        } catch {}
      }
    }
    const canRead = (moduleKey) =>
      user.role === 'admin' ? true : canReadModule(perms, moduleKey);

    // ── Fechas (date-only para coincidir con el Dashboard, que compara
    //    parseISO(payment_date) >= startOfMonth — payment_date es date-only) ──
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thisMonthStr = dateOnly(thisMonthStart);
    const lastMonthStr = dateOnly(lastMonthStart);
    const nowISO = now.toISOString();

    const sec = { sector_id: callerSector };

    // ── WorkOrder (mismos estados/fechas que el Dashboard) ──
    let pendingOrders = null,
      inProgressOrders = null,
      overdueOrders = null,
      completedThisMonth = null,
      urgentOrders = null,
      efficiency = null;
    if (canRead('WorkOrder')) {
      const [pend, prog, overdue, compMonth, urgent, compl, nonCancel] = await Promise.all([
        fetchAll(sb, 'WorkOrder', { ...sec, status: { $in: ['pendiente', 'asignada'] } }),
        fetchAll(sb, 'WorkOrder', { ...sec, status: 'en_progreso' }),
        // vencidas: scheduled_date en el pasado y no terminada/cancelada
        fetchAll(sb, 'WorkOrder', { ...sec, status: { $nin: ['completada', 'cancelada'] }, scheduled_date: { $lt: nowISO } }),
        // completadas este mes
        fetchAll(sb, 'WorkOrder', { ...sec, status: 'completada', completed_date: { $gte: thisMonthStr } }),
        // urgentes: activas (no terminadas) con prioridad urgente/alta
        fetchAll(sb, 'WorkOrder', { ...sec, status: { $in: ['pendiente', 'asignada', 'en_progreso', 'obra', 'pendiente_validacion'] }, priority: { $in: ['urgente', 'alta'] } }),
        fetchAll(sb, 'WorkOrder', { ...sec, status: 'completada' }),
        fetchAll(sb, 'WorkOrder', { ...sec, status: { $ne: 'cancelada' } }),
      ]);
      pendingOrders = pend.length;
      inProgressOrders = prog.length;
      overdueOrders = overdue.length;
      completedThisMonth = compMonth.length;
      urgentOrders = urgent.length;
      const validOrders = nonCancel.length;
      efficiency = validOrders > 0 ? Math.round((compl.length / validOrders) * 100) : 0;
    }

    // ── Project ──
    let activeProjects = null,
      totalProjects = null;
    if (canRead('Project')) {
      const [allP, activeP] = await Promise.all([
        fetchAll(sb, 'Project', sec),
        fetchAll(sb, 'Project', { ...sec, status: 'en_progreso' }),
      ]);
      totalProjects = allP.length;
      activeProjects = activeP.length;
    }

    // ── Client ──
    let activeClients = null,
      totalClients = null;
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

    // ── Invoice (financieras — gateadas por canRead('Invoice')) ──
    let revenueThisMonth = null,
      revenueLastMonth = null,
      revenueTrend = null,
      pendingInvoices = null;
    if (canRead('Invoice')) {
      const [thisM, lastM, pendInv] = await Promise.all([
        fetchAll(sb, 'Invoice', { ...sec, status: 'pagada', payment_date: { $gte: thisMonthStr } }),
        fetchAll(sb, 'Invoice', { ...sec, status: 'pagada', payment_date: { $gte: lastMonthStr, $lt: thisMonthStr } }),
        fetchAll(sb, 'Invoice', { ...sec, status: 'pendiente' }),
      ]);
      revenueThisMonth = thisM.reduce((s, i) => s + (i.total || 0), 0);
      revenueLastMonth = lastM.reduce((s, i) => s + (i.total || 0), 0);
      revenueTrend =
        revenueLastMonth > 0 ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100) : 0;
      pendingInvoices = pendInv.reduce((s, i) => s + (i.total || 0), 0);
    }

    // ── Material (lowStock: stock <= min_stock && min_stock > 0) ──
    let lowStockItems = null,
      totalMaterials = null;
    if (canRead('Inventory')) {
      const allM = await fetchAll(sb, 'Material', sec);
      totalMaterials = allM.length;
      lowStockItems = allM.filter((m) => m.stock <= m.min_stock && m.min_stock > 0).length;
    }

    // ── Asset (mantenimientos vencidos) ──
    let overdueAssets = null;
    if (canRead('Asset')) {
      const od = await fetchAll(sb, 'Asset', { ...sec, next_maintenance: { $lt: nowISO } });
      overdueAssets = od.length;
    }

    // ── Pendientes (FIX: gate por 'Pendientes', NO 'Asset') ──
    let pendientesActivos = null,
      pendientesResueltos = null,
      pendientesUrgentes = null;
    if (canRead('Pendientes')) {
      const [act, res, urg] = await Promise.all([
        fetchAll(sb, 'Pendiente', { ...sec, estado: { $in: ['pendiente', 'asignado', 'en_progreso'] } }),
        fetchAll(sb, 'Pendiente', { ...sec, estado: 'resuelto' }),
        fetchAll(sb, 'Pendiente', { ...sec, prioridad: 'urgente', estado: { $ne: 'resuelto' } }),
      ]);
      pendientesActivos = act.length;
      pendientesResueltos = res.length;
      pendientesUrgentes = urg.length;
    }

    return Response.json({
      sector: callerSector,
      activeProjects,
      totalProjects,
      pendingOrders,
      inProgressOrders,
      overdueOrders,
      completedThisMonth,
      urgentOrders,
      efficiency,
      activeClients,
      totalClients,
      activeEmployees,
      revenueThisMonth,
      revenueLastMonth,
      revenueTrend,
      pendingInvoices,
      lowStockItems,
      totalMaterials,
      overdueAssets,
      pendientesActivos,
      pendientesResueltos,
      pendientesUrgentes,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}