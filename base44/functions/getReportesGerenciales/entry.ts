import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { resolveAndReconcileSector } from '../../shared/callerIdentity.ts';
import { fetchAll } from '../../shared/fetchAllSector.ts';
import { round2 } from '../../shared/round2.ts';

/**
 * Reportes Gerenciales — backend-first.
 *
 * Problema original: la página filtraba client-side sobre `base44.entities.X.list()`
 * (tope 500-1000, sujeto a RLS). Los filtros dependían de matches exactos de strings
 * denormalizados (project_name, assigned_name, comuna vía LocationData) que casi
 * nunca calzaban → "no filtra nada". Las comunas estaban hardcodeadas a 8A/8B/10A
 * (solo sector escuela) → BAPRO no tenía opciones.
 *
 * Ahora: el backend trae TODO el sector (paginado por cursor, sin tope), aplica los
 * filtros server-side sobre el total exacto y devuelve los datasets agregados + las
 * opciones de filtro derivadas de los datos reales del sector → funciona en ambos
 * sectores (escuela y bapro) y los filtros siempre calzan.
 *
 * Reglas de oro:
 *  - Fail closed en sector: sin sector_id → 403.
 *  - Aislamiento estricto: solo se consulta el sector del caller (service-role filter).
 *  - Opciones de filtro se derivan de los datos reales (nunca hardcodeadas).
 *  - Un único round-trip: filtros + agregados en el mismo payload.
 */

const norm = (s) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

// fetchAll (base44/shared/fetchAllSector.ts): paginación robusta con cursor
// $gte + dedupe por id de la boundary — no saltea registros con created_date
// idéntico (imports masivos).

const monthKey = (d) => {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
};
const monthLabel = (key) => {
  const [y, m] = key.split('-');
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${months[parseInt(m, 10) - 1]} ${y.slice(2)}`;
};

const TYPE_LABELS = {
  mantenimiento_preventivo: 'Preventivo',
  mantenimiento_correctivo: 'Correctivo',
  instalacion: 'Instalación',
  inspeccion: 'Inspección',
  reparacion: 'Reparación',
  emergencia: 'Emergencia',
};

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const sb = base44.asServiceRole;

    // Resolución CANÓNICA del sector: ficha Employee primero, reconciliando
    // user.data.sector_id si está desfasado (igual que getWorkOrdersForUser).
    const { sector: callerSector } = await resolveAndReconcileSector(sb, user);
    if (!callerSector) {
      return Response.json({ error: 'Sin sector asignado' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const dateFrom = body.dateFrom;
    const dateTo = body.dateTo;
    const comunaF = body.comuna || 'all';
    const jefeF = body.jefe || 'all';
    const proyectoF = body.proyecto || 'all';
    const tecnicoF = body.tecnico || 'all';

    if (!dateFrom || !dateTo) {
      return Response.json({ error: 'Faltan dateFrom/dateTo' }, { status: 400 });
    }

    const sec = { sector_id: callerSector };

    // ── Fetch paralelo (todo el sector, paginado) ──
    const [orders, pendientes, timeLogs, projects, employees, materials, locations] =
      await Promise.all([
        fetchAll(sb, 'WorkOrder', sec),
        fetchAll(sb, 'Pendiente', sec),
        fetchAll(sb, 'TimeLog', sec),
        fetchAll(sb, 'Project', sec),
        fetchAll(sb, 'Employee', sec),
        fetchAll(sb, 'Material', sec),
        fetchAll(sb, 'LocationData', sec),
      ]);

    // ── Lookups de LocationData (ubic_tecnica + establecimiento) ──
    const locByUt = new Map();
    const locByEst = new Map();
    locations.forEach((l) => {
      if (l.ubic_tecnica) locByUt.set(norm(l.ubic_tecnica), l);
      if (l.establecimiento) locByEst.set(norm(l.establecimiento), l);
    });
    const locFor = (o) => locByUt.get(norm(o.location_qr_name)) || locByUt.get(norm(o.location)) || locByEst.get(norm(o.location_qr_name)) || locByEst.get(norm(o.location));

    const resolveComunaOT = (o) => locFor(o)?.comuna || null;
    const resolveJefeOT = (o) => locFor(o)?.jefe_sitio || o.jefe_sitio || null;

    // ── Rango de fechas ──
    const from = new Date(dateFrom); from.setHours(0, 0, 0, 0);
    const to = new Date(dateTo); to.setHours(23, 59, 59, 999);
    const inRange = (d) => {
      if (!d) return false;
      const dt = new Date(d);
      return dt >= from && dt <= to;
    };

    // ── Comparación canónica (insensible a mayúsculas/acentos) ──
    // Los datos vienen con casing inconsistente ("EMERSON USECHE" vs "Emerson Useche").
    // Sin normalización, el filtro exacto casi nunca calza → "no filtra nada".
    const eqNorm = (a, b) => a != null && b != null && norm(a) === norm(b);

    // ── Filtros aplicados a OTs ──
    const filteredOrders = orders.filter((o) => {
      if (!inRange(o.created_date)) return false;
      if (comunaF !== 'all' && !eqNorm(resolveComunaOT(o), comunaF)) return false;
      if (jefeF !== 'all' && !eqNorm(resolveJefeOT(o), jefeF)) return false;
      if (proyectoF !== 'all' && !eqNorm(o.project_name, proyectoF)) return false;
      if (tecnicoF !== 'all' && !eqNorm(o.assigned_name, tecnicoF)) return false;
      return true;
    });

    // ── Filtros aplicados a Pendientes (sin técnico; comuna directa) ──
    const filteredPendientes = pendientes.filter((p) => {
      if (!inRange(p.created_date)) return false;
      if (comunaF !== 'all' && !eqNorm(p.comuna, comunaF)) return false;
      if (jefeF !== 'all' && !eqNorm(p.jefe_sitio, jefeF)) return false;
      if (proyectoF !== 'all' && !eqNorm(p.proyecto_nombre, proyectoF)) return false;
      return true;
    });

    // ── TimeLogs (rango + técnico) ──
    const filteredTimeLogs = timeLogs.filter((l) => {
      if (!inRange(l.created_date)) return false;
      if (tecnicoF !== 'all' && !eqNorm(l.employee_name || l.user_name, tecnicoF)) return false;
      return true;
    });

    // ── Opciones de filtro (derivadas de datos reales del sector) ──
    // Dedup canónico: un único label por clave normalizada, prefiriendo el casing
    // "Title Case" sobre el ALL-CAPS. Así el dropdown no duplica "Emerson Useche" /
    // "EMERSON USECHE" y el match del filtro (también normalizado) siempre calza.
    const buildCanonical = (items) => {
      const map = new Map(); // normKey -> { label, allCaps }
      items.forEach((s) => {
        if (!s) return;
        const k = norm(s);
        const cur = map.get(k);
        const isAllCaps = s === s.toUpperCase() && /[A-Z]/.test(s);
        if (!cur) map.set(k, { label: s, allCaps: isAllCaps });
        else if (cur.allCaps && !isAllCaps) cur.label = s, cur.allCaps = false;
      });
      return [...map.values()].map((e) => e.label);
    };
    const strSort = (a, b) => a.localeCompare(b, 'es');

    const comunas = buildCanonical([
      ...locations.map((l) => l.comuna),
      ...pendientes.map((p) => p.comuna),
    ]).sort(strSort);
    const jefes = buildCanonical([
      ...locations.map((l) => l.jefe_sitio),
      ...pendientes.map((p) => p.jefe_sitio),
      ...employees.filter((e) => e.role && norm(e.role).includes('jefe')).map((e) => e.full_name),
    ]).sort(strSort);
    const tecnicos = buildCanonical([
      ...employees.filter((e) => !(e.role && norm(e.role).includes('jefe'))).map((e) => e.full_name),
      ...orders.map((o) => o.assigned_name),
    ]).sort(strSort);
    const proyectos = buildCanonical([
      ...projects.map((p) => p.name),
      ...orders.map((o) => o.project_name),
    ]).sort(strSort);

    const filtros = { comunas, jefes, proyectos, tecnicos };

    // ── KPIs OTs ──
    const completadas = filteredOrders.filter((o) => o.status === 'completada').length;
    const canceladas = filteredOrders.filter((o) => o.status === 'cancelada').length;
    const otsValidas = filteredOrders.length - canceladas;
    const eficiencia = otsValidas > 0 ? Math.round((completadas / otsValidas) * 100) : 0;
    const costoMaterialTotal = round2(
      filteredOrders.reduce(
        (s, o) => s + (o.materials_used || []).reduce((ms, m) => ms + (m.quantity || 0) * (m.unit_cost || 0), 0),
        0
      )
    );
    const horasPromedio = filteredTimeLogs.length > 0
      ? Math.round((filteredTimeLogs.reduce((s, l) => s + (l.hours || 0), 0) / filteredTimeLogs.length) * 10) / 10
      : 0;

    // ── OTs por mes ──
    const monthsMap = new Map();
    filteredOrders.forEach((o) => {
      if (!o.created_date) return;
      const k = monthKey(o.created_date);
      if (!monthsMap.has(k)) monthsMap.set(k, { total: 0, completadas: 0, pendientes: 0, en_progreso: 0 });
      const m = monthsMap.get(k);
      m.total++;
      if (o.status === 'completada') m.completadas++;
      if (!['completada', 'cancelada'].includes(o.status)) m.pendientes++;
      if (o.status === 'en_progreso') m.en_progreso++;
    });
    const otsPorMes = [...monthsMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({ mes: monthLabel(k), ...v }));

    // ── OTs por tipo ──
    const otsPorTipo = Object.entries(TYPE_LABELS)
      .map(([key, label]) => ({ name: label, value: filteredOrders.filter((o) => o.type === key).length }))
      .filter((d) => d.value > 0);

    // ── Eficiencia por técnico (excluye jefes de sitio) ──
    const jefeNamesLower = new Set(filtros.jefes.map(norm));
    const efMap = new Map();
    filteredOrders.forEach((o) => {
      if (!o.assigned_name || jefeNamesLower.has(norm(o.assigned_name))) return;
      if (!efMap.has(o.assigned_name)) efMap.set(o.assigned_name, { total: 0, completadas: 0 });
      const e = efMap.get(o.assigned_name);
      e.total++;
      if (o.status === 'completada') e.completadas++;
    });
    const eficienciaPorTecnico = [...efMap.entries()]
      .map(([name, d]) => ({ name, total: d.total, completadas: d.completadas, eficiencia: d.total > 0 ? Math.round((d.completadas / d.total) * 100) : 0 }))
      .sort((a, b) => b.eficiencia - a.eficiencia)
      .slice(0, 8);

    // ── Costos por proyecto ──
    const cpMap = new Map();
    filteredOrders.forEach((o) => {
      if (!o.project_name) return;
      const c = (o.materials_used || []).reduce((s, m) => s + (m.quantity || 0) * (m.unit_cost || 0), 0);
      cpMap.set(o.project_name, (cpMap.get(o.project_name) || 0) + c);
    });
    const costosPorProyecto = [...cpMap.entries()]
      .map(([name, costo]) => ({ name, costo: round2(costo) }))
      .sort((a, b) => b.costo - a.costo)
      .slice(0, 6);

    // ── Plantel de empleados (OTs sobre filteredOrders) ──
    const empOts = new Map();
    filteredOrders.forEach((o) => {
      if (!o.assigned_name) return;
      if (!empOts.has(o.assigned_name)) empOts.set(o.assigned_name, { ots: 0, completadas: 0 });
      const e = empOts.get(o.assigned_name);
      e.ots++;
      if (o.status === 'completada') e.completadas++;
    });
    const empleados = employees.map((e) => {
      const d = empOts.get(e.full_name) || { ots: 0, completadas: 0 };
      return { id: e.id, full_name: e.full_name, status: e.status, specialty: e.specialty, role: e.role, ots: d.ots, completadas: d.completadas };
    });

    // ── Inventario (materiales con min_stock > 0) ──
    const materiales = materials
      .filter((m) => m.min_stock > 0)
      .map((m) => ({ id: m.id, name: m.name, stock: m.stock, min_stock: m.min_stock }));

    // ── Pendientes ──
    const pendActivos = filteredPendientes.filter((p) => !['resuelto', 'cancelado'].includes(p.estado));
    const pendResueltos = filteredPendientes.filter((p) => p.estado === 'resuelto');
    const tasaResolucion = filteredPendientes.length > 0 ? Math.round((pendResueltos.length / filteredPendientes.length) * 100) : 0;
    const hoy = new Date();
    const pendVencidos = pendActivos.filter((p) => p.fecha_limite && new Date(p.fecha_limite) < hoy);
    const pendSinAsignar = filteredPendientes.filter((p) => !p.jefe_sitio && !['resuelto', 'cancelado'].includes(p.estado)).length;

    // MTTR
    const tiempos = pendResueltos
      .map((p) => {
        if (!p.fecha_resolucion || !p.fecha_asignacion) return null;
        const dias = (new Date(p.fecha_resolucion) - new Date(p.fecha_asignacion)) / 86400000;
        return dias >= 0 ? dias : null;
      })
      .filter((d) => d !== null);
    const mttr = tiempos.length > 0 ? Math.round((tiempos.reduce((a, b) => a + b, 0) / tiempos.length) * 10) / 10 : null;
    const backlog = pendResueltos.length > 0 ? Math.round((pendActivos.length / pendResueltos.length) * 10) / 10 : null;

    // Aging
    const agingBuckets = { '0-7d': 0, '8-30d': 0, '31-60d': 0, '>60d': 0 };
    pendActivos.forEach((p) => {
      const dias = Math.floor((hoy - new Date(p.created_date)) / 86400000);
      if (dias <= 7) agingBuckets['0-7d']++;
      else if (dias <= 30) agingBuckets['8-30d']++;
      else if (dias <= 60) agingBuckets['31-60d']++;
      else agingBuckets['>60d']++;
    });
    const aging = Object.entries(agingBuckets).map(([rango, count]) => ({ rango, count }));

    const estMap = { pendiente: 'Pendiente', asignado: 'Asignado', en_progreso: 'En Progreso', resuelto: 'Resuelto', cancelado: 'Cancelado' };
    const pendPorEstado = Object.entries(estMap)
      .map(([k, label]) => ({ name: label, value: filteredPendientes.filter((p) => p.estado === k).length }))
      .filter((d) => d.value > 0);

    const tipoMap = { mantenimiento: 'Mantenimiento', obra: 'Obra', inspeccion: 'Inspección', emergencia: 'Emergencia' };
    const pendPorTipo = Object.entries(tipoMap)
      .map(([k, label]) => ({ name: label, value: filteredPendientes.filter((p) => p.tipo === k).length }))
      .filter((d) => d.value > 0);

    const priMap = { urgente: 'Urgente', alta: 'Alta', media: 'Media', baja: 'Baja' };
    const pendPorPrioridad = Object.entries(priMap)
      .map(([k, label]) => {
        const total = filteredPendientes.filter((p) => p.prioridad === k).length;
        const resueltos = filteredPendientes.filter((p) => p.prioridad === k && p.estado === 'resuelto').length;
        return { name: label, total, resueltos, eficiencia: total > 0 ? Math.round((resueltos / total) * 100) : 0 };
      })
      .filter((d) => d.total > 0);

    const pjMap = new Map();
    filteredPendientes.forEach((p) => {
      const j = p.jefe_sitio || 'Sin asignar';
      if (!pjMap.has(j)) pjMap.set(j, { total: 0, resueltos: 0, vencidos: 0 });
      const d = pjMap.get(j);
      d.total++;
      if (p.estado === 'resuelto') d.resueltos++;
      if (!['resuelto', 'cancelado'].includes(p.estado) && p.fecha_limite && new Date(p.fecha_limite) < hoy) d.vencidos++;
    });
    const pendPorJefe = [...pjMap.entries()]
      .map(([jefe, d]) => ({ jefe, ...d, eficiencia: d.total > 0 ? Math.round((d.resueltos / d.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    const pendPorComuna = (filtros.comunas.length ? filtros.comunas : ['8A', '8B', '10A']).map((c) => ({
      comuna: c,
      total: filteredPendientes.filter((p) => p.comuna === c).length,
      resueltos: filteredPendientes.filter((p) => p.comuna === c && p.estado === 'resuelto').length,
      activos: filteredPendientes.filter((p) => p.comuna === c && !['resuelto', 'cancelado'].includes(p.estado)).length,
    })).filter((d) => d.total > 0);

    // ── Slim exports para PDF (solo lo necesario) ──
    const ordersExport = filteredOrders.map((o) => ({
      id: o.id, created_date: o.created_date, completed_date: o.completed_date,
      status: o.status, type: o.type, priority: o.priority,
      title: o.title, project_name: o.project_name, assigned_name: o.assigned_name,
      location: o.location, materials_used: o.materials_used,
    }));
    const timeLogsExport = filteredTimeLogs.map((l) => ({
      id: l.id, created_date: l.created_date, hours: l.hours,
      employee_name: l.employee_name, user_name: l.user_name,
    }));

    return Response.json({
      sector: callerSector,
      filtros,
      kpis: {
        total: filteredOrders.length,
        completadas,
        canceladas,
        eficiencia,
        costoMaterialTotal,
        horasPromedio,
        timeLogsCount: filteredTimeLogs.length,
      },
      otsPorMes,
      otsPorTipo,
      eficienciaPorTecnico,
      costosPorProyecto,
      empleados,
      materiales,
      pendientes: {
        total: filteredPendientes.length,
        activos: pendActivos.length,
        resueltos: pendResueltos.length,
        vencidos: pendVencidos.length,
        sinAsignar: pendSinAsignar,
        tasaResolucion,
        mttr,
        backlog,
        aging,
        porEstado: pendPorEstado,
        porTipo: pendPorTipo,
        porPrioridad: pendPorPrioridad,
        porJefe: pendPorJefe,
        porComuna: pendPorComuna,
      },
      ordersExport,
      timeLogsExport,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}