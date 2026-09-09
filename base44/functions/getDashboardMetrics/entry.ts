import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { esOtVencida } from '../../shared/otVencimiento.ts';
import { fetchAll } from '../../shared/fetchAllSector.ts';
import { round2 } from '../../shared/round2.ts';
import { resolveAdminView, loadRolePermissions, norm } from '../../shared/visibilityResolver.ts';
import { buildOtVisibilityContext, otEsVisiblePara } from '../../shared/workOrderVisibility.ts';

/**
 * KPIs del Dashboard computados sobre el TOTAL que el usuario puede ver (sin
 * truncar). Regla de oro: backend-first, fuente única de visibilidad.
 *
 * Visibilidad de OT: delegada a buildOtVisibilityContext + otEsVisiblePara
 * (workOrderVisibility.ts), el MISMO predicado que usan la página Órdenes y el
 * Portal Operario. Así los contadores del Dashboard son idénticos a los de las
 * otras vistas.
 *
 * Performance: buildOtVisibilityContext resuelve sector + employee + admin_view
 * + linkage en UNA pasada. WorkOrder se carga con fetchAll y se filtra con
 * otEsVisiblePara usando el ctx ya resuelto — sin re-resolver identidad.
 * Direccion se carga en el Promise.all principal y estabsSet se computa inline
 * desde arrays ya cargados — sin re-llamar resolveEstablecimientosDeJefe.
 * RolePermission se lee del cache de 60s (loadRolePermissions) ya poblado por
 * resolveAdminView dentro de buildOtVisibilityContext.
 *
 * Reglas innegociables:
 *  - Fail closed en sector: si el usuario no tiene sector_id → 403.
 *  - Permisos: cada grupo de métricas se gatea por el permiso de lectura del
 *    módulo correspondiente. Si no aplica, se devuelve null.
 *  - Payload: clients se omite (solo conteos en kpis). Todos los demás arrays
 *    se mantienen completos porque los componentes del Dashboard los consumen.
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

const dateOnly = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const sb = base44.asServiceRole;

    // scope='own': el Dashboard pide KPIs de OT propios del usuario (ignora
    // admin-view y linkage jefe). Sólo afecta WorkOrder; los demás módulos
    // (proyectos, clientes, materiales, facturación) siguen sector-scoped.
    const body = await req.json().catch(() => ({}));
    const forceOwnOnly = body?.scope === 'own';

    // ── Resolución CANÓNICA en una sola pasada ──
    // buildOtVisibilityContext resuelve: sector (Employee → reconciliación
    // best-effort), admin_view (RolePermission cacheado), linkage jefe
    // (salteado si forceOwnOnly). Devuelve ctx con TODO — employee, sector,
    // isAdminView. Elimina la llamada duplicada a resolveAndReconcileSector.
    const ctx = await buildOtVisibilityContext(sb, user, { forceOwnOnly });
    if (!ctx) {
      return Response.json({ error: 'Sin sector asignado' }, { status: 403 });
    }

    const callerSector = ctx.sector;
    const employee = ctx.employee;

    // ── Resolver permisos del rol del empleado (cacheado) ──
    // loadRolePermissions usa el cache de 60s ya poblado por resolveAdminView
    // ('WorkOrder') dentro de buildOtVisibilityContext. Sin raw list duplicado.
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

    // ── Disparar TODAS las cargas de datos en paralelo ──
    // WorkOrder se carga con fetchAll y se filtra con otEsVisiblePara usando el
    // ctx ya resuelto — sin re-llamar a buildOtVisibilityContext (antes
    // getVisibleWorkOrders lo hacía internamente, duplicando Employee + linkage).
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
      // Direccion para estabsSet inline (evita re-fetch en resolveEstablecimientosDeJefe)
      loadKeys.push('direcciones');
      loadPromises.push(fetchAll(sb, 'Direccion', sec));
      // Si Asset no se cargó arriba (canRead('Asset')=false), cargarlo acá
      // para que estabsSet tenga los sedes/locations del jefe.
      if (!loadKeys.includes('assets')) {
        loadKeys.push('assets');
        loadPromises.push(fetchAll(sb, 'Asset', sec));
      }
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

    // ── Client (solo conteos — el array no se envía al cliente) ──
    let activeClients = null, totalClients = null;
    if (loaded.clients) {
      totalClients = loaded.clients.length;
      activeClients = loaded.clients.filter((c) => c.status === 'activo').length;
    }

    // ── Employee ──
    let activeEmployees = null;
    if (loaded.employees) {
      activeEmployees = loaded.employees.filter((e) => e.status === 'activo').length;
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
      overdueAssets = loaded.assets.filter((a) => a.next_maintenance && new Date(a.next_maintenance) < now).length;
    }

    // ── Pendientes ──
    // Visibilidad regida por admin_view (Ver Todo) del rol del empleado — no por
    // isSuperAdmin. Un gerente sin admin_view para Pendientes ve solo los propios
    // + los de sus establecimientos asignados. Sin ficha de empleado (super-admin
    // puro) → admin_view=true → todo el sector.
    //
    // estabsSet se computa INLINE desde loaded.direcciones + loaded.assets (ya
    // cargados en Promise.all) — sin re-llamar resolveEstablecimientosDeJefe
    // (que re-fetchaba Direccion+Asset duplicados). Misma lógica matchJefe.
    let pendientesActivos = null, pendientesResueltos = null, pendientesUrgentes = null;
    let visiblePendientes = null;
    if (loaded.pendientes) {
      const allPends = loaded.pendientes;
      const pendAdminView = await resolveAdminView(sb, employee, 'Pendientes');
      let mine;
      if (pendAdminView) {
        mine = allPends;
      } else {
        // estabsSet inline — misma lógica que resolveEstablecimientosDeJefe
        // pero reutilizando los arrays ya cargados (sin fetch duplicado).
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

    return Response.json({
      sector: callerSector,
      isSuperAdmin,
      activeProjects, totalProjects,
      pendingOrders, inProgressOrders, overdueOrders, completedThisMonth, urgentOrders, efficiency,
      activeClients, totalClients,
      activeEmployees,
      revenueThisMonth, revenueLastMonth, revenueTrend, pendingInvoices,
      lowStockItems, totalMaterials, overdueAssets,
      pendientesActivos, pendientesResueltos, pendientesUrgentes,
      // Arrays completos (fetchAll sin cap) para que el Dashboard consuma
      // una sola fuente de verdad. clients se omite (solo conteos en kpis)
      // porque ningún componente del Dashboard lo usa más allá del conteo.
      orders: loaded.workorders || null,
      projects: loaded.projects || null,
      invoices: loaded.invoices || null,
      materials: loaded.materials || null,
      assets: loaded.assets || null,
      employees: loaded.employees || null,
      pendientes: visiblePendientes,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}