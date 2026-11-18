// base44/shared/dashboardSummary.ts
//
// Resumen del Dashboard ("Panel rápido"). Calcula en el servidor los mismos
// valores que hoy calcula el navegador en src/pages/Dashboard.jsx y sus
// componentes (OTsPendientesPanel, RevenueChart, CertificadosPanel,
// KpisJefeSitio, MetricasOperacion), con los mismos criterios.
//
// Fechas: los registros guardan fechas SIN zona horaria y el navegador las
// interpreta en hora local. Para dar los mismos números, todo el cálculo usa
// la hora (nowMs) y la zona (tz = getTimezoneOffset en minutos) del cliente.

import { esOtVencida } from './otVencimiento.ts';

const DAY = 86400000;
const pad = (n) => String(n).padStart(2, '0');
const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d+))?)?)?(Z|[+-]\d{2}(?::?\d{2})?)?$/i;

function parseMs(v, tz, soloFechaLocal) {
  if (v == null || v === '') return NaN;
  const s = String(v).trim();
  const m = RE_FECHA.exec(s);
  if (!m) return Date.parse(s);
  const base = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0),
    m[7] ? Math.floor(Number('0.' + m[7]) * 1000) : 0);
  if (m[4] === undefined) return soloFechaLocal ? base + tz * 60000 : base;
  if (m[8]) {
    if (m[8].toUpperCase() === 'Z') return base;
    const z = m[8].replace(':', '');
    const mins = (+z.slice(1, 3)) * 60 + (+(z.slice(3, 5) || 0));
    return base - (z[0] === '-' ? -1 : 1) * mins * 60000;
  }
  return base + tz * 60000; // sin zona → hora local del cliente
}
// Equivalente a `new Date(str)` del navegador (solo-fecha = UTC).
const jsDateMs = (v, tz) => parseMs(v, tz, false);
// Equivalente a parseISO de date-fns (solo-fecha = medianoche local).
const parseISOMs = (v, tz) => parseMs(v, tz, true);

function mesCliente(nowMs, tz) {
  const l = new Date(nowMs - tz * 60000);
  return { y: l.getUTCFullYear(), m: l.getUTCMonth() };
}
function ultimos6Meses(nowMs, tz) {
  const { y, m } = mesCliente(nowMs, tz);
  const keys = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - i, 1));
    keys.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`);
  }
  return keys;
}

const normCI = (s) => (s || '').trim().replace(/\s+/g, ' ').toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const normEmp = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ');
const normAddr = (s) => (s || '').toUpperCase().trim().replace(/\s+/g, ' ').replace(/,\s*CABA\s*$/, '').replace(/,\s*$/, '').trim();

// Desempate determinista del orden de origen. La base no garantiza el orden
// entre registros con la MISMA fecha de orden (ej. importados en el mismo
// milisegundo): cambia de una consulta a otra. Acá solo se reordenan, por id,
// los tramos consecutivos con fecha idéntica; el resto del orden no se toca.
// Espejo de desempatar() en src/lib/panelRapidoLegacy.js.
function desempatar(arr, campo) {
  const out = [];
  let i = 0;
  while (i < arr.length) {
    let j = i + 1;
    const k = String(arr[i]?.[campo] ?? '');
    while (j < arr.length && String(arr[j]?.[campo] ?? '') === k) j++;
    const tramo = arr.slice(i, j);
    if (tramo.length > 1) tramo.sort((a, b) => (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0));
    out.push(...tramo);
    i = j;
  }
  return out;
}

export function buildPanelSummary(raw, opts) {
  const { dateRange, jefeSitio, priority, nowMs, tz } = opts;
  const now = new Date(nowMs);
  const projects = desempatar(raw.projects || [], 'created_date');
  const invoices = raw.invoices || [];
  const materials = raw.materials || [];
  const assets = raw.assets || [];
  const employees = desempatar(raw.employees || [], 'created_date');
  const pendientes = desempatar(raw.pendientes || [], 'created_date');
  const direcciones = desempatar(raw.direcciones || [], 'created_date');
  const certs = desempatar(raw.certs || [], 'created_date');
  const allOrders = desempatar(raw.orders || [], 'updated_date').filter((o) => !o.archivada);

  const thisMonth = (() => { const { y, m } = mesCliente(nowMs, tz); return Date.UTC(y, m, 1) + tz * 60000; })();
  const meses = ultimos6Meses(nowMs, tz);
  const cutoff = dateRange === '7d' ? nowMs - 7 * DAY
    : dateRange === '30d' ? nowMs - 30 * DAY
    : dateRange === '3m' ? nowMs - 90 * DAY
    : null;
  const enRango = (r) => {
    const d = r.updated_date || r.created_date;
    return !!d && jsDateMs(d, tz) >= cutoff;
  };

  // ── Filtro de Jefe de Sitio (Dashboard.jsx) ──
  const empMap = {};
  employees.forEach((e) => {
    if (e.full_name) empMap[normEmp(e.full_name)] = { email: (e.email || '').toLowerCase().trim(), user_id: e.user_id || '' };
  });
  const addrMap = {};
  direcciones.forEach((d) => {
    if (d.direccion && d.jefe_sitio) addrMap[normAddr(d.direccion)] = d.jefe_sitio.trim();
  });
  const addrKeys = Object.keys(addrMap);
  const resolveJefe = (o) => {
    if (o.jefe_sitio) return o.jefe_sitio;
    const locNorm = normAddr(o.location);
    if (!locNorm) return null;
    if (addrMap[locNorm]) return addrMap[locNorm];
    if (locNorm.length >= 10) {
      let bestAddr = null;
      let bestLen = 0;
      for (const addr of addrKeys) {
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
  if (jefeSitio) {
    const selectedInfo = empMap[normEmp(jefeSitio)];
    if (!selectedInfo) {
      jefeAliasSet = { aliases: new Set([normCI(jefeSitio)]), selectedInfo: null };
    } else {
      const aliases = new Set();
      aliases.add(normCI(jefeSitio));
      allOrders.forEach((o) => {
        const linked = (selectedInfo.email && (o.jefe_sitio_email || '').toLowerCase().trim() === selectedInfo.email)
          || (selectedInfo.user_id && o.created_by_id === selectedInfo.user_id);
        if (!linked) return;
        if (o.jefe_sitio) aliases.add(normCI(o.jefe_sitio));
        const resolved = resolveJefe(o);
        if (resolved) aliases.add(normCI(resolved));
      });
      direcciones.forEach((d) => {
        if (!d.jefe_sitio) return;
        const matchByName = normEmp(d.jefe_sitio) === normEmp(jefeSitio);
        const matchByEmail = selectedInfo.email && d.jefe_sitio.toLowerCase().trim() === selectedInfo.email;
        if (matchByName || matchByEmail) aliases.add(normCI(d.jefe_sitio));
      });
      jefeAliasSet = { aliases, selectedInfo };
    }
  }

  let orders = allOrders;
  if (cutoff !== null) orders = orders.filter(enRango);
  if (jefeSitio) {
    orders = orders.filter((o) => {
      const { aliases, selectedInfo } = jefeAliasSet;
      if (o.jefe_sitio && aliases.has(normCI(o.jefe_sitio))) return true;
      if (selectedInfo?.email && (o.jefe_sitio_email || '').toLowerCase().trim() === selectedInfo.email) return true;
      if (selectedInfo?.user_id && o.created_by_id === selectedInfo.user_id) return true;
      const resolved = resolveJefe(o);
      if (resolved && aliases.has(normCI(resolved))) return true;
      return false;
    });
  }
  if (priority) orders = orders.filter((o) => o.priority === priority);

  const filteredProjects = cutoff === null ? projects : projects.filter(enRango);

  // Opciones del filtro de jefes (el cliente las ordena alfabéticamente).
  const display = (s) => s.trim().replace(/\s+/g, ' ');
  const jefesSet = new Map();
  employees.forEach((e) => {
    if (e.full_name && e.role && e.role.toLowerCase().includes('jefe')) {
      const key = normCI(e.full_name);
      if (!jefesSet.has(key)) jefesSet.set(key, display(e.full_name));
    }
  });
  direcciones.forEach((d) => {
    if (d.jefe_sitio) {
      const key = normCI(d.jefe_sitio);
      if (!jefesSet.has(key)) jefesSet.set(key, display(d.jefe_sitio));
    }
  });
  allOrders.forEach((o) => {
    if (o.jefe_sitio) {
      const key = normCI(o.jefe_sitio);
      if (!jefesSet.has(key)) jefesSet.set(key, display(o.jefe_sitio));
    }
  });

  // ── Indicadores dependientes del filtro (Dashboard.jsx) ──
  const completadasN = orders.filter((o) => o.status === 'completada').length;
  const validOrders = orders.filter((o) => o.status !== 'cancelada').length;
  const metrics = {
    pendingOrders: orders.filter((o) => ['pendiente', 'asignada'].includes(o.status)).length,
    inProgressOrders: orders.filter((o) => o.status === 'en_progreso').length,
    overdueOrders: orders.filter((o) => esOtVencida(o, now)).length,
    completedThisMonth: orders.filter((o) => o.completed_date && parseISOMs(o.completed_date, tz) >= thisMonth && o.status === 'completada').length,
    efficiency: validOrders > 0 ? Math.round((completadasN / validOrders) * 100) : 0,
    urgentCount: orders.filter((o) => ['pendiente', 'asignada', 'en_progreso', 'obra', 'pendiente_validacion'].includes(o.status) && ['urgente', 'alta'].includes(o.priority)).length,
    recentProjects: filteredProjects.filter((p) => p.status === 'en_progreso').slice(0, 5)
      .map((p) => ({ id: p.id, name: p.name, progress: p.progress, client_name: p.client_name })),
  };

  // ── Órdenes de Trabajo: estado y prioridad (OTsPendientesPanel) ──
  const active = orders.filter((o) => !['completada', 'cancelada'].includes(o.status));
  const statusCounts = {};
  ['pendiente', 'asignada', 'en_progreso', 'en_espera'].forEach((k) => {
    statusCounts[k] = orders.filter((o) => o.status === k).length;
  });
  const priorityCounts = {};
  ['urgente', 'alta', 'media', 'baja'].forEach((k) => {
    priorityCounts[k] = active.filter((o) => o.priority === k).length;
  });
  const ots = { activeCount: active.length, statusCounts, priorityCounts };

  // ── Actividad reciente (ActivityFeed) ──
  const fechaAct = (o) => jsDateMs(o.updated_date || o.created_date, tz);
  const activity = [...orders]
    .filter((o) => o.updated_date || o.created_date)
    .sort((a, b) => fechaAct(b) - fechaAct(a))
    .slice(0, 6)
    .map((o) => ({
      id: o.id, title: o.title, priority: o.priority, location_qr_name: o.location_qr_name,
      status: o.status, updated_date: o.updated_date, created_date: o.created_date,
    }));

  // ── Facturación últimos 6 meses (RevenueChart) ──
  const rev = {};
  meses.forEach((k) => { rev[k] = { key: k, facturado: 0, cobrado: 0 }; });
  invoices.forEach((inv) => {
    const d = inv.issue_date || inv.created_date;
    if (!d) return;
    const key = String(d).substring(0, 7);
    if (rev[key]) {
      rev[key].facturado += inv.total || 0;
      if (inv.status === 'pagada') rev[key].cobrado += inv.total || 0;
    }
  });

  // ── Certificados (CertificadosPanel) ──
  const certCutoff = cutoff !== null ? cutoff : thisMonth;
  const periodoCerts = certs.filter((c) => c.created_date && parseISOMs(c.created_date, tz) >= certCutoff);
  const certMes = {};
  meses.forEach((k) => { certMes[k] = { key: k, cantidad: 0, monto: 0 }; });
  certs.forEach((c) => {
    const d = c.created_date;
    if (!d) return;
    const key = String(d).substring(0, 7);
    if (certMes[key]) {
      certMes[key].cantidad += 1;
      certMes[key].monto += c.subtotal || 0;
    }
  });
  const abonosPorComuna = { '8A': 0, '8B': 0, '10A': 0, 'Sin comuna': 0 };
  certs.filter((c) => c.tipo === 'abono_mensual').forEach((c) => {
    const texto = `${c.emprendimiento || ''} ${c.obra_servicio || ''}`.toUpperCase();
    if (texto.includes('8A') || texto.includes('8 A')) abonosPorComuna['8A']++;
    else if (texto.includes('8B') || texto.includes('8 B')) abonosPorComuna['8B']++;
    else if (texto.includes('10A') || texto.includes('10 A')) abonosPorComuna['10A']++;
    else abonosPorComuna['Sin comuna']++;
  });
  const certsResumen = {
    countPeriodo: periodoCerts.length,
    emitidos: certs.filter((c) => c.estado === 'emitido').length,
    aprobados: certs.filter((c) => c.estado === 'aprobado').length,
    totalMes: periodoCerts.reduce((s, c) => s + (c.subtotal || 0), 0),
    monthly: Object.values(certMes),
    recent: periodoCerts.slice(0, 4).map((c) => ({
      id: c.id, estado: c.estado, obra_servicio: c.obra_servicio, contratista: c.contratista, numero: c.numero,
    })),
    abonosPorComuna,
  };

  // ── KPIs por Jefe de Sitio (KpisJefeSitio) ──
  const jefesSitio = new Set(
    employees.filter((e) => e.role && e.role.toLowerCase().includes('jefe')).map((e) => e.full_name),
  );
  let jefesKpis = [];
  if (jefesSitio.size > 0) {
    const jefesMap = {};
    const filteredPendientes = pendientes.filter((p) => {
      if (jefeSitio && p.jefe_sitio !== jefeSitio) return false;
      if (cutoff !== null && !enRango(p)) return false;
      return true;
    });
    const filteredOrders = allOrders.filter((o) => {
      if (jefeSitio && o.assigned_name !== jefeSitio) return false;
      if (cutoff !== null && !enRango(o)) return false;
      return true;
    });
    filteredPendientes.forEach((p) => {
      if (!p.jefe_sitio || !jefesSitio.has(p.jefe_sitio)) return;
      if (!jefesMap[p.jefe_sitio]) jefesMap[p.jefe_sitio] = { pendientes: [], orders: [] };
      jefesMap[p.jefe_sitio].pendientes.push(p);
    });
    if (!jefeSitio) {
      jefesSitio.forEach((nombre) => {
        if (!jefesMap[nombre]) jefesMap[nombre] = { pendientes: [], orders: [] };
      });
    }
    filteredOrders.forEach((o) => {
      const nombre = o.assigned_name;
      if (!nombre || !jefesSitio.has(nombre)) return;
      if (!jefesMap[nombre]) jefesMap[nombre] = { pendientes: [], orders: [] };
      jefesMap[nombre].orders.push(o);
    });
    jefesKpis = Object.entries(jefesMap)
      .filter(([, d]) => d.pendientes.length > 0 || d.orders.length > 0)
      .map(([nombre, data]) => {
        const totalPend = data.pendientes.length;
        const vencidos = data.pendientes.filter((p) =>
          p.fecha_limite && parseISOMs(p.fecha_limite, tz) < nowMs && p.estado !== 'resuelto' && p.estado !== 'cancelado').length;
        const resueltos = data.pendientes.filter((p) => p.estado === 'resuelto').length;
        const eficienciaPend = totalPend > 0 ? Math.round((resueltos / totalPend) * 100) : 100;
        const otsTotales = data.orders.length;
        const otsCompletadas = data.orders.filter((o) => o.status === 'completada').length;
        const eficienciaOTs = otsTotales > 0 ? Math.round((otsCompletadas / otsTotales) * 100) : 100;
        const tiempos = data.pendientes
          .filter((p) => p.estado === 'resuelto' && p.fecha_asignacion && p.fecha_resolucion)
          .map((p) => Math.trunc((parseISOMs(p.fecha_resolucion, tz) - parseISOMs(p.fecha_asignacion, tz)) / DAY))
          .filter((d) => d >= 0);
        const promedioResolucion = tiempos.length > 0
          ? Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length)
          : null;
        const score = Math.round((eficienciaPend * 0.5) + (eficienciaOTs * 0.3) + (vencidos === 0 ? 20 : Math.max(0, 20 - vencidos * 4)));
        return { nombre, totalPend, vencidos, resueltos, eficienciaPend, otsTotales, otsCompletadas, eficienciaOTs, promedioResolucion, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  // ── Métricas de operación (MetricasOperacion) ──
  const totalOrders = orders.length;
  const eficiencia = totalOrders > 0 ? Math.round((completadasN / totalOrders) * 100) : 0;
  const urgentes = orders.filter((o) => ['urgente', 'alta'].includes(o.priority) && !['completada', 'cancelada'].includes(o.status)).length;
  const vencidas = orders.filter((o) => o.scheduled_date && parseISOMs(o.scheduled_date, tz) < nowMs && !['completada', 'cancelada'].includes(o.status)).length;
  const activosOk = assets.filter((a) => a.status === 'operativo').length;
  const stockOk = materials.filter((m) => m.stock > m.min_stock || m.min_stock === 0).length;
  const empActivos = employees.filter((e) => e.status === 'activo').length;
  const porMes = {};
  meses.forEach((k) => { porMes[k] = { key: k, completadas: 0, creadas: 0 }; });
  orders.forEach((o) => {
    if (o.created_date) {
      const k = String(o.created_date).substring(0, 7);
      if (porMes[k]) porMes[k].creadas += 1;
    }
    if (o.completed_date && o.status === 'completada') {
      const k = String(o.completed_date).substring(0, 7);
      if (porMes[k]) porMes[k].completadas += 1;
    }
  });
  const operacion = {
    eficiencia, urgentes, vencidas,
    proyActivos: projects.filter((p) => p.status === 'en_progreso').length,
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
    jefesOptions: Array.from(jefesSet.values()),
    metrics, ots, activity,
    revenue: Object.values(rev),
    certs: certsResumen,
    jefesKpis, operacion,
  };
}