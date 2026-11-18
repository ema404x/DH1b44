import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { fetchAll } from '../../shared/fetchAllSector.ts';
import { round2 } from '../../shared/round2.ts';
import { finDiaLocal } from '../../shared/fechaLocal.ts';
import { resolveAdminView, loadRolePermissions, norm } from '../../shared/visibilityResolver.ts';
import { buildOtVisibilityContext, otEsVisiblePara } from '../../shared/workOrderVisibility.ts';
import { buildPanelSummary } from '../../shared/dashboardSummary.ts';

/**
 * Panel rápido: mismos valores que muestra el Dashboard, calculados en el
 * servidor y devueltos ya agregados (sin listas completas).
 *
 * Sector, permisos, visibilidad de OT y de Pendientes y los conteos fijos son
 * los mismos de getDashboardMetrics (que no se modifica). Lo que depende de
 * los filtros del Dashboard se calcula en shared/dashboardSummary.ts.
 *
 * Payload: { scope, dateRange, jefeSitio, priority, nowMs, tzOffsetMin }
 */

const normalizeRole = (r) =>
  (r || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const FIELD_ROLES = ['jefe_sitio', 'jefe de sitio', 'inspector', 'tecnico', 'supervisor', 'operario', 'operario_portal'];
const ADMIN_LEVEL_ROLES = ['admin', 'gerente', 'gerencia', 'administrativo', 'gerente_general'];

function isFieldRole(r) { return FIELD_ROLES.includes(normalizeRole(r)); }
function isAdminLevelRole(r) { return ADMIN_LEVEL_ROLES.includes(normalizeRole(r)); }
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

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const sb = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const forceOwnOnly = body?.scope === 'own';

    // Filtros del Dashboard + hora y zona del dispositivo.
    const dateRange = ['7d', '30d', '3m'].includes(body?.dateRange) ? body.dateRange : 'all';
    const jefeSitio = typeof body?.jefeSitio === 'string' ? body.jefeSitio : '';
    const priority = typeof body?.priority === 'string' ? body.priority : '';
    const nowMs = Number.isFinite(body?.nowMs) && Math.abs(body.nowMs - Date.now()) < 86400000 ? body.nowMs : Date.now();
    const tz = Number.isFinite(body?.tzOffsetMin) && Math.abs(body.tzOffsetMin) <= 900 ? body.tzOffsetMin : 180;

    const ctx = await buildOtVisibilityContext(sb, user, { forceOwnOnly });
    if (!ctx) {
      return Response.json({ error: 'Sin sector asignado' }, { status: 403 });
    }

    const callerSector = ctx.sector;
    const employee = ctx.employee;

    let perms = {};
    let employeeRole = null;
    if (user.role !== 'admin') {
      employeeRole = employee?.role || user.role || '';
      if (employeeRole) {
        try {
          const allRps = await loadRolePermissions(sb);
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

    // ── Mismas cargas que getDashboardMetrics ──
    const loadKeys = [];
    const loadPromises = [];
    if (canRead('WorkOrder')) {
      loadKeys.push('workorders');
      loadPromises.push(
        fetchAll(sb, 'WorkOrder', { sector_id: callerSector }, '-updated_date')
          .then((arr) => arr.filter((o) => otEsVisiblePara(o, ctx)))
      );
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
      loadPromises.push(fetchAll(sb, 'Employee', sec));
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
      loadPromises.push(fetchAll(sb, 'Asset', sec));
    }
    if (canRead('Pendientes')) {
      loadKeys.push('pendientes');
      loadPromises.push(fetchAll(sb, 'Pendiente', sec));
      if (!loadKeys.includes('assets')) {
        loadKeys.push('assets');
        loadPromises.push(fetchAll(sb, 'Asset', sec));
      }
    }
    // Direcciones: el Dashboard las pide siempre (filtro de jefes).
    loadKeys.push('direcciones');
    loadPromises.push(fetchAll(sb, 'Direccion', sec, '-created_date'));
    // Certificados: la MISMA consulta que hace hoy el Dashboard, con la
    // sesión del usuario (mismas reglas de visibilidad y mismo tope).
    loadKeys.push('certs');
    loadPromises.push(
      base44.entities.Certificado.list('-created_date', 200)
        .then((r) => (Array.isArray(r) ? r : (r?.items || [])))
        .catch(() => [])
    );

    const loadedValues = await Promise.all(loadPromises);
    const loaded = {};
    loadKeys.forEach((k, i) => { loaded[k] = loadedValues[i]; });

    // ── Conteos fijos (idénticos a getDashboardMetrics) ──
    let activeProjects = null, totalProjects = null;
    if (loaded.projects) {
      totalProjects = loaded.projects.length;
      activeProjects = loaded.projects.filter((p) => p.status === 'en_progreso').length;
    }

    let activeClients = null, totalClients = null;
    if (loaded.clients) {
      totalClients = loaded.clients.length;
      activeClients = loaded.clients.filter((c) => c.status === 'activo').length;
    }

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

    let lowStockItems = null, totalMaterials = null;
    if (loaded.materials) {
      totalMaterials = loaded.materials.length;
      lowStockItems = loaded.materials.filter((m) => m.stock <= m.min_stock && m.min_stock > 0).length;
    }

    let overdueAssets = null;
    if (loaded.assets) {
      overdueAssets = loaded.assets.filter((a) => a.next_maintenance && finDiaLocal(a.next_maintenance) < now).length;
    }

    // ── Pendientes (misma visibilidad que getDashboardMetrics) ──
    let pendientesActivos = null, pendientesResueltos = null, pendientesUrgentes = null;
    let visiblePendientes = null;
    if (loaded.pendientes) {
      const allPends = loaded.pendientes;
      const pendAdminView = await resolveAdminView(sb, employee, 'Pendientes', user);
      let mine;
      if (pendAdminView) {
        mine = allPends;
      } else {
        const jefeName = employee?.full_name || user.full_name || '';
        const targetName = norm(jefeName);
        const uEmail = (user.email || '').toLowerCase().trim();
        const targetEmail = norm(uEmail);
        const matchJefeInline = (jefeStr) => {
          if (!jefeStr) return false;
          const n = norm(jefeStr);
          if (targetName && n === targetName) return true;
          if (targetEmail && n === targetEmail) return true;
          return false;
        };
        const estabsSet = new Set();
        (loaded.direcciones || []).forEach((d) => {
          if (matchJefeInline(d.jefe_sitio) && d.direccion) estabsSet.add(norm(d.direccion));
        });
        (loaded.assets || []).forEach((a) => {
          if (matchJefeInline(a.jefe_sitio)) {
            if (a.sede) estabsSet.add(norm(a.sede));
            if (a.location) estabsSet.add(norm(a.location));
          }
        });

        mine = allPends.filter((p) =>
          (p.created_by_id && p.created_by_id === user.id) ||
          (p.jefe_sitio_email && p.jefe_sitio_email.toLowerCase().trim() === uEmail) ||
          (p.establecimiento && estabsSet.has(norm(p.establecimiento))) ||
          (p.sitio && estabsSet.has(norm(p.sitio)))
        );
      }
      visiblePendientes = mine;
      pendientesActivos = mine.filter((p) => ['pendiente', 'asignado', 'en_progreso'].includes(p.estado)).length;
      pendientesResueltos = mine.filter((p) => p.estado === 'resuelto').length;
      pendientesUrgentes = mine.filter((p) => p.prioridad === 'urgente' && p.estado !== 'resuelto').length;
    }

    // ── Todo lo que depende de los filtros del Dashboard ──
    const resumen = buildPanelSummary({
      orders: loaded.workorders,
      projects: loaded.projects,
      invoices: loaded.invoices,
      materials: loaded.materials,
      assets: loaded.assets,
      employees: loaded.employees,
      pendientes: visiblePendientes,
      direcciones: loaded.direcciones,
      certs: loaded.certs,
    }, { dateRange, jefeSitio, priority, nowMs, tz });

    return Response.json({
      sector: callerSector,
      isSuperAdmin,
      kpis: {
        activeProjects, totalProjects,
        activeClients, totalClients,
        revenueThisMonth, revenueTrend, pendingInvoices,
        lowStockItems, totalMaterials, overdueAssets,
        pendientesActivos, pendientesResueltos, pendientesUrgentes,
      },
      ...resumen,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}