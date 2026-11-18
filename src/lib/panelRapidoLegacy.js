/**
 * Panel rápido — cálculo "como hoy" (verificación).
 *
 * Toma los datos completos que usa el Dashboard clásico (getDashboardMetrics,
 * Direccion y Certificado) y calcula, con las MISMAS expresiones que
 * Dashboard.jsx y sus componentes, un resumen con la misma forma que devuelve
 * getDashboardSummary. Sirve para comparar valor por valor y, si algo difiere,
 * para mostrar en pantalla los valores del cálculo de siempre.
 */
import { startOfMonth, parseISO, subDays, differenceInDays } from 'date-fns';
import { esOtVencida } from '@/lib/otVencimiento';

const normCI = (s) => (s || '').trim().replace(/\s+/g, ' ').toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const normEmp = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ');
const normAddr = (s) => (s || '').toUpperCase().trim().replace(/\s+/g, ' ').replace(/,\s*CABA\s*$/, '').replace(/,\s*$/, '').trim();

const KPI_KEYS = [
  'activeProjects', 'totalProjects', 'activeClients', 'totalClients',
  'revenueThisMonth', 'revenueTrend', 'pendingInvoices',
  'lowStockItems', 'totalMaterials', 'overdueAssets',
  'pendientesActivos', 'pendientesResueltos', 'pendientesUrgentes',
];

function ultimos6Meses(now) {
  const keys = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

export function calcularResumenLegacy({ dash, direcciones = [], certs = [] }, filters, nowMs) {
  const now = new Date(nowMs);
  const allOrders = (dash?.orders || []).filter(o => !o.archivada);
  const projects = dash?.projects || [];
  const invoices = dash?.invoices || [];
  const materials = dash?.materials || [];
  const assets = dash?.assets || [];
  const employees = dash?.employees || [];
  const pendientes = dash?.pendientes || [];
  const meses = ultimos6Meses(now);
  const thisMonth = startOfMonth(now);

  const kpis = {};
  KPI_KEYS.forEach(k => { kpis[k] = dash?.[k] ?? null; });

  // ── Filtro de Jefe de Sitio (Dashboard.jsx) ──
  const empMap = {};
  employees.forEach(e => {
    if (e.full_name) empMap[normEmp(e.full_name)] = { email: (e.email || '').toLowerCase().trim(), user_id: e.user_id || '' };
  });
  const addrMap = {};
  direcciones.forEach(d => {
    if (d.direccion && d.jefe_sitio) addrMap[normAddr(d.direccion)] = d.jefe_sitio.trim();
  });
  const resolveJefe = (o) => {
    if (o.jefe_sitio) return o.jefe_sitio;
    const locNorm = normAddr(o.location);
    if (!locNorm) return null;
    if (addrMap[locNorm]) return addrMap[locNorm];
    if (locNorm.length >= 10) {
      let bestAddr = null;
      let bestLen = 0;
      for (const addr of Object.keys(addrMap)) {
        if (addr.length >= 10 && locNorm.startsWith(addr + ',') && addr.length > bestLen) {
          bestAddr = addr;
          bestLen = addr.length;
        }
      }
      if (bestAddr) return addrMap[bestAddr];
    }
    return null;
  };

  let jefeAliasSet = null;
  if (filters.jefeSitio) {
    const selectedInfo = empMap[normEmp(filters.jefeSitio)];
    if (!selectedInfo) {
      jefeAliasSet = { aliases: new Set([normCI(filters.jefeSitio)]), selectedInfo: null };
    } else {
      const aliases = new Set();
      aliases.add(normCI(filters.jefeSitio));
      allOrders.forEach(o => {
        const linked = (selectedInfo.email && (o.jefe_sitio_email || '').toLowerCase().trim() === selectedInfo.email)
                    || (selectedInfo.user_id && o.created_by_id === selectedInfo.user_id);
        if (!linked) return;
        if (o.jefe_sitio) aliases.add(normCI(o.jefe_sitio));
        const resolved = resolveJefe(o);
        if (resolved) aliases.add(normCI(resolved));
      });
      direcciones.forEach(d => {
        if (!d.jefe_sitio) return;
        const matchByName = normEmp(d.jefe_sitio) === normEmp(filters.jefeSitio);
        const matchByEmail = selectedInfo.email && d.jefe_sitio.toLowerCase().trim() === selectedInfo.email;
        if (matchByName || matchByEmail) aliases.add(normCI(d.jefe_sitio));
      });
      jefeAliasSet = { aliases, selectedInfo };
    }
  }

  const filterCutoff =
    filters.dateRange === '7d' ? subDays(now, 7)
    : filters.dateRange === '30d' ? subDays(now, 30)
    : filters.dateRange === '3m' ? subDays(now, 90)
    : null;

  let orders = allOrders;
  if (filterCutoff) {
    orders = orders.filter(o => {
      const d = o.updated_date || o.created_date;
      return d && new Date(d) >= filterCutoff;
    });
  }
  if (filters.jefeSitio) {
    orders = orders.filter(o => {
      const { aliases, selectedInfo } = jefeAliasSet;
      if (o.jefe_sitio && aliases.has(normCI(o.jefe_sitio))) return true;
      if (selectedInfo?.email && (o.jefe_sitio_email || '').toLowerCase().trim() === selectedInfo.email) return true;
      if (selectedInfo?.user_id && o.created_by_id === selectedInfo.user_id) return true;
      const resolved = resolveJefe(o);
      if (resolved && aliases.has(normCI(resolved))) return true;
      return false;
    });
  }
  if (filters.priority) orders = orders.filter(o => o.priority === filters.priority);

  const filteredProjects = !filterCutoff ? projects : projects.filter(p => {
    const d = p.updated_date || p.created_date;
    return d && new Date(d) >= filterCutoff;
  });

  const display = (s) => s.trim().replace(/\s+/g, ' ');
  const set = new Map();
  employees.forEach(e => {
    if (e.full_name && e.role && e.role.toLowerCase().includes('jefe')) {
      const key = normCI(e.full_name);
      if (!set.has(key)) set.set(key, display(e.full_name));
    }
  });
  direcciones.forEach(d => {
    if (d.jefe_sitio) {
      const key = normCI(d.jefe_sitio);
      if (!set.has(key)) set.set(key, display(d.jefe_sitio));
    }
  });
  allOrders.forEach(o => {
    if (o.jefe_sitio) {
      const key = normCI(o.jefe_sitio);
      if (!set.has(key)) set.set(key, display(o.jefe_sitio));
    }
  });
  const jefesOptions = Array.from(set.values()).sort((a, b) => a.localeCompare(b, 'es'));

  // ── Indicadores (Dashboard.jsx) ──
  const validOrders = orders.filter(o => o.status !== 'cancelada');
  const metrics = {
    pendingOrders: orders.filter(o => ['pendiente', 'asignada'].includes(o.status)).length,
    inProgressOrders: orders.filter(o => o.status === 'en_progreso').length,
    overdueOrders: orders.filter(o => esOtVencida(o, now)).length,
    completedThisMonth: orders.filter(o => o.completed_date && parseISO(o.completed_date) >= thisMonth && o.status === 'completada').length,
    efficiency: validOrders.length > 0 ? Math.round((orders.filter(o => o.status === 'completada').length / validOrders.length) * 100) : 0,
    urgentCount: orders.filter(o => ['pendiente', 'asignada', 'en_progreso', 'obra', 'pendiente_validacion'].includes(o.status) && ['urgente', 'alta'].includes(o.priority)).length,
    recentProjects: filteredProjects.filter(p => p.status === 'en_progreso').slice(0, 5)
      .map(p => ({ id: p.id, name: p.name, progress: p.progress, client_name: p.client_name })),
  };

  // ── OTsPendientesPanel ──
  const active = orders.filter(o => !['completada', 'cancelada'].includes(o.status));
  const statusCounts = {};
  ['pendiente', 'asignada', 'en_progreso', 'en_espera'].forEach(k => {
    statusCounts[k] = orders.filter(o => o.status === k).length;
  });
  const priorityCounts = {};
  ['urgente', 'alta', 'media', 'baja'].forEach(k => {
    priorityCounts[k] = active.filter(o => o.priority === k).length;
  });
  const ots = { activeCount: active.length, statusCounts, priorityCounts };

  // ── ActivityFeed ──
  const activity = [...orders]
    .filter(o => o.updated_date || o.created_date)
    .sort((a, b) => new Date(b.updated_date || b.created_date) - new Date(a.updated_date || a.created_date))
    .slice(0, 6)
    .map(o => ({
      id: o.id, title: o.title, priority: o.priority, location_qr_name: o.location_qr_name,
      status: o.status, updated_date: o.updated_date, created_date: o.created_date,
    }));

  // ── RevenueChart ──
  const rev = {};
  meses.forEach(k => { rev[k] = { key: k, facturado: 0, cobrado: 0 }; });
  invoices.forEach(inv => {
    const d = inv.issue_date || inv.created_date;
    if (!d) return;
    const key = d.substring(0, 7);
    if (rev[key]) {
      rev[key].facturado += inv.total || 0;
      if (inv.status === 'pagada') rev[key].cobrado += inv.total || 0;
    }
  });

  // ── CertificadosPanel ──
  const cutoff = filterCutoff || thisMonth;
  const thisMonthCerts = certs.filter(c => c.created_date && parseISO(c.created_date) >= cutoff);
  const certMes = {};
  meses.forEach(k => { certMes[k] = { key: k, cantidad: 0, monto: 0 }; });
  certs.forEach(c => {
    const d = c.created_date;
    if (!d) return;
    const key = d.substring(0, 7);
    if (certMes[key]) {
      certMes[key].cantidad += 1;
      certMes[key].monto += c.subtotal || 0;
    }
  });
  const abonosPorComuna = { '8A': 0, '8B': 0, '10A': 0, 'Sin comuna': 0 };
  certs.filter(c => c.tipo === 'abono_mensual').forEach(c => {
    const texto = `${c.emprendimiento || ''} ${c.obra_servicio || ''}`.toUpperCase();
    if (texto.includes('8A') || texto.includes('8 A')) abonosPorComuna['8A']++;
    else if (texto.includes('8B') || texto.includes('8 B')) abonosPorComuna['8B']++;
    else if (texto.includes('10A') || texto.includes('10 A')) abonosPorComuna['10A']++;
    else abonosPorComuna['Sin comuna']++;
  });
  const certsResumen = {
    countPeriodo: thisMonthCerts.length,
    emitidos: certs.filter(c => c.estado === 'emitido').length,
    aprobados: certs.filter(c => c.estado === 'aprobado').length,
    totalMes: thisMonthCerts.reduce((s, c) => s + (c.subtotal || 0), 0),
    monthly: Object.values(certMes),
    recent: thisMonthCerts.slice(0, 4).map(c => ({
      id: c.id, estado: c.estado, obra_servicio: c.obra_servicio, contratista: c.contratista, numero: c.numero,
    })),
    abonosPorComuna,
  };

  // ── KpisJefeSitio ──
  const jefesSitio = new Set(
    employees.filter(e => e.role && e.role.toLowerCase().includes('jefe')).map(e => e.full_name)
  );
  let jefesKpis = [];
  if (jefesSitio.size > 0) {
    const filterJefe = filters.jefeSitio;
    const jefesMap = {};
    const filteredPendientes = pendientes.filter(p => {
      if (filterJefe && p.jefe_sitio !== filterJefe) return false;
      if (filterCutoff) {
        const d = p.updated_date || p.created_date;
        if (!d || new Date(d) < filterCutoff) return false;
      }
      return true;
    });
    const filteredOrders = allOrders.filter(o => {
      if (filterJefe && o.assigned_name !== filterJefe) return false;
      if (filterCutoff) {
        const d = o.updated_date || o.created_date;
        if (!d || new Date(d) < filterCutoff) return false;
      }
      return true;
    });
    filteredPendientes.forEach(p => {
      if (!p.jefe_sitio || !jefesSitio.has(p.jefe_sitio)) return;
      if (!jefesMap[p.jefe_sitio]) jefesMap[p.jefe_sitio] = { pendientes: [], orders: [] };
      jefesMap[p.jefe_sitio].pendientes.push(p);
    });
    if (!filterJefe) {
      jefesSitio.forEach(nombre => {
        if (!jefesMap[nombre]) jefesMap[nombre] = { pendientes: [], orders: [] };
      });
    }
    filteredOrders.forEach(o => {
      const nombre = o.assigned_name;
      if (!nombre || !jefesSitio.has(nombre)) return;
      if (!jefesMap[nombre]) jefesMap[nombre] = { pendientes: [], orders: [] };
      jefesMap[nombre].orders.push(o);
    });
    jefesKpis = Object.entries(jefesMap).filter(([, d]) => d.pendientes.length > 0 || d.orders.length > 0).map(([nombre, data]) => {
      const totalPend = data.pendientes.length;
      const vencidos = data.pendientes.filter(p =>
        p.fecha_limite && parseISO(p.fecha_limite) < now && p.estado !== 'resuelto' && p.estado !== 'cancelado'
      ).length;
      const resueltos = data.pendientes.filter(p => p.estado === 'resuelto').length;
      const eficienciaPend = totalPend > 0 ? Math.round((resueltos / totalPend) * 100) : 100;
      const otsTotales = data.orders.length;
      const otsCompletadas = data.orders.filter(o => o.status === 'completada').length;
      const eficienciaOTs = otsTotales > 0 ? Math.round((otsCompletadas / otsTotales) * 100) : 100;
      const tiemposResolucion = data.pendientes
        .filter(p => p.estado === 'resuelto' && p.fecha_asignacion && p.fecha_resolucion)
        .map(p => differenceInDays(parseISO(p.fecha_resolucion), parseISO(p.fecha_asignacion)))
        .filter(d => d >= 0);
      const promedioResolucion = tiemposResolucion.length > 0
        ? Math.round(tiemposResolucion.reduce((a, b) => a + b, 0) / tiemposResolucion.length)
        : null;
      const score = Math.round((eficienciaPend * 0.5) + (eficienciaOTs * 0.3) + (vencidos === 0 ? 20 : Math.max(0, 20 - vencidos * 4)));
      return { nombre, totalPend, vencidos, resueltos, eficienciaPend, otsTotales, otsCompletadas, eficienciaOTs, promedioResolucion, score };
    }).sort((a, b) => b.score - a.score).slice(0, 10);
  }

  // ── MetricasOperacion ──
  const totalOrders = orders.length;
  const completadas = orders.filter(o => o.status === 'completada').length;
  const eficiencia = totalOrders > 0 ? Math.round((completadas / totalOrders) * 100) : 0;
  const urgentes = orders.filter(o => ['urgente', 'alta'].includes(o.priority) && !['completada', 'cancelada'].includes(o.status)).length;
  const vencidas = orders.filter(o => { try { return o.scheduled_date && parseISO(o.scheduled_date) < now && !['completada', 'cancelada'].includes(o.status); } catch { return false; } }).length;
  const activosOk = assets.filter(a => a.status === 'operativo').length;
  const stockOk = materials.filter(m => m.stock > m.min_stock || m.min_stock === 0).length;
  const empActivos = employees.filter(e => e.status === 'activo').length;
  const porMes = {};
  meses.forEach(k => { porMes[k] = { key: k, completadas: 0, creadas: 0 }; });
  orders.forEach(o => {
    const cd = o.created_date;
    if (cd) {
      const k = cd.substring(0, 7);
      if (porMes[k]) porMes[k].creadas += 1;
    }
    if (o.completed_date && o.status === 'completada') {
      const k = o.completed_date.substring(0, 7);
      if (porMes[k]) porMes[k].completadas += 1;
    }
  });
  const operacion = {
    eficiencia, urgentes, vencidas,
    proyActivos: projects.filter(p => p.status === 'en_progreso').length,
    empActivos,
    radar: [
      eficiencia,
      assets.length > 0 ? Math.round((activosOk / assets.length) * 100) : 100,
      materials.length > 0 ? Math.round((stockOk / materials.length) * 100) : 100,
      employees.length > 0 ? Math.round((empActivos / employees.length) * 100) : 100,
      Math.max(0, 100 - urgentes * 10),
      Math.max(0, 100 - vencidas * 10),
    ],
    porMes: Object.values(porMes),
  };

  return {
    nowMs, kpis, jefesOptions, metrics, ots, activity,
    revenue: Object.values(rev),
    certs: certsResumen,
    jefesKpis, operacion,
  };
}

// ── Comparación valor por valor ──
const SECCIONES = {
  kpis: 'Indicadores', metrics: 'OTs', ots: 'Órdenes de trabajo', activity: 'Actividad reciente',
  revenue: 'Facturación 6 meses', certs: 'Certificados', jefesKpis: 'KPIs por jefe',
  operacion: 'Métricas de operación', jefesOptions: 'Lista de jefes',
};
const SECCION_KEYS = Object.keys(SECCIONES);
const vacio = (v) => v === null || v === undefined;

function comparar(viejo, nuevo, path, out) {
  if (vacio(viejo) && vacio(nuevo)) return;
  const esObj = (v) => v !== null && typeof v === 'object';
  if (esObj(viejo) && esObj(nuevo)) {
    if (Array.isArray(viejo) && Array.isArray(nuevo) && viejo.length !== nuevo.length) {
      out.push({ valor: `${path} (cantidad)`, viejo: viejo.length, nuevo: nuevo.length });
    }
    const keys = new Set([...Object.keys(viejo), ...Object.keys(nuevo)]);
    keys.forEach(k => comparar(viejo[k], nuevo[k], Array.isArray(viejo) ? `${path}[${Number(k) + 1}]` : `${path} · ${k}`, out));
    return;
  }
  if (typeof viejo === 'number' && typeof nuevo === 'number') {
    if (Math.abs(viejo - nuevo) >= 0.005) out.push({ valor: path, viejo, nuevo });
    return;
  }
  if (viejo !== nuevo) out.push({ valor: path, viejo: viejo ?? null, nuevo: nuevo ?? null });
}

/** Devuelve [{ valor, viejo, nuevo }] con cada valor que no coincide. */
export function compararResumenes(viejo, nuevo) {
  const out = [];
  SECCION_KEYS.forEach(k => comparar(viejo?.[k], nuevo?.[k], SECCIONES[k], out));
  return out;
}