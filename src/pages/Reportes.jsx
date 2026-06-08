import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, AreaChart, Area, ComposedChart, Scatter, ScatterChart
} from 'recharts';
import {
  BarChart2, TrendingUp, Clock, Package, Wrench, CheckCircle2, AlertTriangle, Download,
  Filter, FileText, Target, Users, Activity, Zap, RefreshCw, CalendarDays, ClipboardList
} from 'lucide-react';
import { exportKPIsPDF } from '@/utils/exportPDF';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, eachMonthOfInterval, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);
const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

function KpiMetric({ title, value, subtitle, icon: IconComponent, color = 'blue', trend }) {
  const colorMap = {
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    green: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30',
    amber: 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
    red: 'from-red-500/20 to-red-600/10 border-red-500/30',
  };

  const iconColorMap = {
    blue: 'text-blue-400', green: 'text-emerald-400', amber: 'text-amber-400',
    purple: 'text-purple-400', red: 'text-red-400',
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -5 }}>
      <Card className={`border bg-gradient-to-br ${colorMap[color]} backdrop-blur-xl shadow-lg border-slate-700/50`}>
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start justify-between mb-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${iconColorMap[color]}`}>
              {IconComponent && <IconComponent className="h-5 w-5" />}
            </div>
            {trend && (
              <Badge className={`text-xs ${trend > 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
              </Badge>
            )}
          </div>
          <div className="text-2xl font-bold text-white">{value}</div>
          <div className="text-xs font-semibold text-slate-400 mt-2 uppercase tracking-wide">{title}</div>
          {subtitle && <div className="text-xs text-slate-500 mt-1">{subtitle}</div>}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function Reportes() {
  const [resumenSemanal, setResumenSemanal] = useState(null);
  const [loadingResumen, setLoadingResumen] = useState(false);
  const [resumenFecha, setResumenFecha] = useState(null);

  const fetchResumenSemanal = async () => {
    setLoadingResumen(true);
    try {
      const res = await base44.functions.invoke('resumenSemanal', {});
      setResumenSemanal(res.data);
      setResumenFecha(new Date());
    } finally {
      setLoadingResumen(false);
    }
  };

  const [dateFrom, setDateFrom] = useState(format(subMonths(new Date(), 5), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [comunaFilter, setComunaFilter] = useState('all');
  const [jefeFilter, setJefeFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [tecnicoFilter, setTecnicoFilter] = useState('all');

  // Reportes usa keys propias para no contaminar el caché del Dashboard.
  // Los datos analíticos toleran 5 min de desfase (staleTime alto = menos refetches).
  // Límites razonables: los reportes no necesitan más de N registros para ser útiles.
  const STALE_5M  = 5  * 60 * 1000;
  const STALE_10M = 10 * 60 * 1000;

  const { data: orders = [] }    = useQuery({ queryKey: ['workorders-reportes'],  queryFn: () => base44.entities.WorkOrder.list('-created_date', 1000),    staleTime: STALE_5M  });
  const { data: projects = [] }  = useQuery({ queryKey: ['projects-reportes'],    queryFn: () => base44.entities.Project.list('-updated_date', 300),        staleTime: STALE_10M });
  const { data: timeLogs = [] }  = useQuery({ queryKey: ['timelogs-reportes'],    queryFn: () => base44.entities.TimeLog.list('-created_date', 500),        staleTime: STALE_10M });
  const { data: materials = [] } = useQuery({ queryKey: ['materials'],            queryFn: () => base44.entities.Material.list('-updated_date', 300),       staleTime: STALE_10M });
  const { data: employees = [] } = useQuery({ queryKey: ['employees'],            queryFn: () => base44.entities.Employee.list('-updated_date', 200),       staleTime: STALE_10M });
  const { data: locations = [] } = useQuery({ queryKey: ['locations-reportes'],   queryFn: () => base44.entities.LocationData.list('-updated_date', 500),   staleTime: STALE_10M });
  const { data: pendientes = [] }= useQuery({ queryKey: ['pendientes-reportes'],  queryFn: () => base44.entities.Pendiente.list('-created_date', 1000),     staleTime: STALE_5M  });

  // Get unique filter options
  const comunasUnicas = ['8A', '8B', '10A'];
  // Solo empleados cuyo rol incluye "jefe"
  const jefesUnicos = employees
    .filter(e => e.role && e.role.toLowerCase().includes('jefe'))
    .map(e => e.full_name)
    .filter(Boolean)
    .sort();
  const tecnicosUnicos = [...new Set(employees.map(e => e.full_name).filter(Boolean))].sort();

  // Build location → jefe/comuna lookup for enriching orders
  const locationLookup = useMemo(() => {
    const map = {};
    locations.forEach(l => { map[l.ubic_tecnica] = l; map[l.establecimiento] = l; });
    return map;
  }, [locations]);

  // Filter data
  const filteredOrders = useMemo(() => {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    return orders.filter(o => {
      const date = o.created_date ? new Date(o.created_date) : null;
      const inRange = !date || (date >= from && date <= to);
      const inProject = projectFilter === 'all' || o.project_name === projectFilter;
      const matchTecnico = tecnicoFilter === 'all' || o.assigned_name === tecnicoFilter;

      // Jefe: buscamos en la ubicación de la orden
      const loc = locationLookup[o.location_qr_name] || locationLookup[o.location] || {};
      const matchJefe = jefeFilter === 'all' || loc.jefe_sitio === jefeFilter;
      const matchComuna = comunaFilter === 'all' || loc.comuna === comunaFilter;

      return inRange && inProject && matchComuna && matchJefe && matchTecnico;
    });
  }, [orders, dateFrom, dateTo, projectFilter, comunaFilter, jefeFilter, tecnicoFilter, locationLookup]);

  // Gráficos por mes
  const months = eachMonthOfInterval({ start: new Date(dateFrom), end: new Date(dateTo) });
  const otsPorMes = months.map(month => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const monthOrders = filteredOrders.filter(o => {
      const d = o.created_date ? new Date(o.created_date) : null;
      return d && isWithinInterval(d, { start, end });
    });
    return {
      mes: format(month, 'MMM yy', { locale: es }),
      total: monthOrders.length,
      completadas: monthOrders.filter(o => o.status === 'completada').length,
      pendientes: monthOrders.filter(o => ['pendiente', 'asignada'].includes(o.status)).length,
      en_progreso: monthOrders.filter(o => o.status === 'en_progreso').length,
    };
  });

  // OTs por tipo
  const typeLabels = {
    mantenimiento_preventivo: 'Preventivo', mantenimiento_correctivo: 'Correctivo',
    instalacion: 'Instalación', inspeccion: 'Inspección', reparacion: 'Reparación', emergencia: 'Emergencia'
  };
  const otsPorTipo = Object.entries(typeLabels).map(([key, label]) => ({
    name: label,
    value: filteredOrders.filter(o => o.type === key).length,
  })).filter(d => d.value > 0);

  // Eficiencia por técnico
  const eficienciaPorTecnico = Object.entries(
    filteredOrders.reduce((acc, o) => {
      if (!o.assigned_name) return acc;
      if (!acc[o.assigned_name]) acc[o.assigned_name] = { total: 0, completadas: 0 };
      acc[o.assigned_name].total++;
      if (o.status === 'completada') acc[o.assigned_name].completadas++;
      return acc;
    }, {})
  ).map(([name, data]) => ({
    name,
    total: data.total,
    completadas: data.completadas,
    eficiencia: data.total > 0 ? Math.round((data.completadas / data.total) * 100) : 0
  })).sort((a, b) => b.eficiencia - a.eficiencia).slice(0, 8);

  // Costos por proyecto
  const costosPorProyecto = Object.entries(
    filteredOrders.reduce((acc, o) => {
      if (!o.project_name) return acc;
      if (!acc[o.project_name]) acc[o.project_name] = 0;
      acc[o.project_name] += (o.materials_used || []).reduce((s, m) => s + (m.quantity * m.unit_cost || 0), 0);
      return acc;
    }, {})
  ).map(([name, costo]) => ({ name, costo }))
    .sort((a, b) => b.costo - a.costo)
    .slice(0, 6);

  // KPIs Pendientes
  const pendientesActivos = pendientes.filter(p => !['resuelto', 'cancelado'].includes(p.estado));
  const pendientesResueltos = pendientes.filter(p => p.estado === 'resuelto');
  const tasaResolucionPend = pendientes.length > 0 ? Math.round((pendientesResueltos.length / pendientes.length) * 100) : 0;

  // Vencidos: fecha_limite pasada y no resuelto
  const hoy = new Date();
  const pendientesVencidos = pendientesActivos.filter(p => p.fecha_limite && new Date(p.fecha_limite) < hoy);

  // Pendientes por estado
  const pendientesPorEstado = ['pendiente', 'asignado', 'en_progreso', 'resuelto', 'cancelado'].map(estado => ({
    name: { pendiente: 'Pendiente', asignado: 'Asignado', en_progreso: 'En Progreso', resuelto: 'Resuelto', cancelado: 'Cancelado' }[estado],
    value: pendientes.filter(p => p.estado === estado).length,
  })).filter(d => d.value > 0);

  // Pendientes por tipo
  const pendientesPorTipo = ['mantenimiento', 'obra', 'inspeccion', 'emergencia'].map(tipo => ({
    name: { mantenimiento: 'Mantenimiento', obra: 'Obra', inspeccion: 'Inspección', emergencia: 'Emergencia' }[tipo],
    value: pendientes.filter(p => p.tipo === tipo).length,
  })).filter(d => d.value > 0);

  // Pendientes por prioridad
  const pendientesPorPrioridad = ['urgente', 'alta', 'media', 'baja'].map(p => ({
    name: { urgente: 'Urgente', alta: 'Alta', media: 'Media', baja: 'Baja' }[p],
    total: pendientes.filter(x => x.prioridad === p).length,
    resueltos: pendientes.filter(x => x.prioridad === p && x.estado === 'resuelto').length,
  })).filter(d => d.total > 0).map(d => ({ ...d, eficiencia: Math.round((d.resueltos / d.total) * 100) }));

  // Pendientes por jefe de sitio
  const pendientesPorJefe = Object.entries(
    pendientes.reduce((acc, p) => {
      const j = p.jefe_sitio || 'Sin asignar';
      if (!acc[j]) acc[j] = { total: 0, resueltos: 0, vencidos: 0 };
      acc[j].total++;
      if (p.estado === 'resuelto') acc[j].resueltos++;
      if (!['resuelto','cancelado'].includes(p.estado) && p.fecha_limite && new Date(p.fecha_limite) < hoy) acc[j].vencidos++;
      return acc;
    }, {})
  ).map(([jefe, data]) => ({
    jefe: jefe.split(' ').slice(0, 2).join(' '),
    ...data,
    eficiencia: data.total > 0 ? Math.round((data.resueltos / data.total) * 100) : 0,
  })).sort((a, b) => b.total - a.total).slice(0, 8);

  // Pendientes por comuna
  const pendientesPorComuna = ['8A', '8B', '10A'].map(c => ({
    comuna: c,
    total: pendientes.filter(p => p.comuna === c).length,
    resueltos: pendientes.filter(p => p.comuna === c && p.estado === 'resuelto').length,
    activos: pendientes.filter(p => p.comuna === c && !['resuelto','cancelado'].includes(p.estado)).length,
  })).filter(d => d.total > 0);

  // KPIs
  const completadas = filteredOrders.filter(o => o.status === 'completada').length;
  const eficiencia = filteredOrders.length > 0 ? Math.round((completadas / filteredOrders.length) * 100) : 0;
  const horasPromedio = timeLogs.length > 0 ? Math.round(timeLogs.reduce((s, l) => s + (l.hours || 0), 0) / timeLogs.length * 10) / 10 : 0;
  const costoMaterialTotal = filteredOrders.reduce((s, o) => s + (o.materials_used || []).reduce((ms, m) => ms + (m.quantity * m.unit_cost || 0), 0), 0);

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.1 } }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 space-y-6">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-teal-500/30 rounded-full blur-3xl opacity-20 animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
                <BarChart2 className="h-6 w-6 text-white" />
              </div>
              Reportes Gerenciales
            </h1>
            <p className="text-slate-400 mt-1">Análisis integral de proyectos, operaciones e inventario</p>
          </div>
        </div>
      </motion.div>

      {/* Filtros Avanzados */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="border-0 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl shadow-lg">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="h-4 w-4 text-teal-400" />
              <span className="text-sm font-semibold text-white">Filtros Avanzados</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase block mb-2">Desde</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="h-9 text-xs bg-slate-700/50 border-slate-600/50 text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase block mb-2">Hasta</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="h-9 text-xs bg-slate-700/50 border-slate-600/50 text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase block mb-2">Comuna</label>
                <Select value={comunaFilter} onValueChange={setComunaFilter}>
                  <SelectTrigger className="h-9 text-xs bg-slate-700/50 border-slate-600/50 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {comunasUnicas.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase block mb-2">Jefe de Sitio</label>
                <Select value={jefeFilter} onValueChange={setJefeFilter}>
                  <SelectTrigger className="h-9 text-xs bg-slate-700/50 border-slate-600/50 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {jefesUnicos.map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase block mb-2">Proyecto</label>
                <Select value={projectFilter} onValueChange={setProjectFilter}>
                  <SelectTrigger className="h-9 text-xs bg-slate-700/50 border-slate-600/50 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {projects.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase block mb-2">Técnico</label>
                <Select value={tecnicoFilter} onValueChange={setTecnicoFilter}>
                  <SelectTrigger className="h-9 text-xs bg-slate-700/50 border-slate-600/50 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {tecnicosUnicos.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* KPIs */}
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div variants={item}>
          <KpiMetric title="Órdenes Totales" value={filteredOrders.length} subtitle={`${completadas} completadas`} icon={Wrench} color="blue" />
        </motion.div>
        <motion.div variants={item}>
          <KpiMetric title="Tasa Cumplimiento" value={`${eficiencia}%`} subtitle="Completadas/Totales" icon={CheckCircle2} color="green" />
        </motion.div>
        <motion.div variants={item}>
          <KpiMetric title="Costo Materiales" value={fmt(costoMaterialTotal)} subtitle="Total invertido" icon={Package} color="amber" />
        </motion.div>
        <motion.div variants={item}>
          <KpiMetric title="Prom. Horas/Registro" value={`${horasPromedio}h`} subtitle={`${timeLogs.length} registros`} icon={Clock} color="purple" />
        </motion.div>
      </motion.div>

      {/* Tabs */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
        <Tabs defaultValue="operaciones" className="w-full">
          <TabsList className="grid w-full grid-cols-6 bg-slate-800/50 border border-slate-700/50">
            <TabsTrigger value="operaciones" className="gap-1.5 text-xs"><Activity className="h-3.5 w-3.5" /> Operaciones</TabsTrigger>
            <TabsTrigger value="personal" className="gap-1.5 text-xs"><Users className="h-3.5 w-3.5" /> Personal</TabsTrigger>
            <TabsTrigger value="financiero" className="gap-1.5 text-xs"><TrendingUp className="h-3.5 w-3.5" /> Financiero</TabsTrigger>
            <TabsTrigger value="inventario" className="gap-1.5 text-xs"><Package className="h-3.5 w-3.5" /> Inventario</TabsTrigger>
            <TabsTrigger value="pendientes" className="gap-1.5 text-xs"><ClipboardList className="h-3.5 w-3.5" /> Pendientes</TabsTrigger>
            <TabsTrigger value="semanal" className="gap-1.5 text-xs"><CalendarDays className="h-3.5 w-3.5" /> Semanal</TabsTrigger>
          </TabsList>

          {/* Operaciones */}
          <TabsContent value="operaciones" className="mt-4 space-y-4">
            <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <motion.div variants={item}>
                <Card className="border-0 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl shadow-lg">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-white">Órdenes por Mes</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={otsPorMes}>
                        <defs>
                          <linearGradient id="colorCompletadas" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', color: '#e2e8f0' }} />
                        <Area type="monotone" dataKey="completadas" stroke="#10b981" fillOpacity={1} fill="url(#colorCompletadas)" name="Completadas" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={item}>
                <Card className="border-0 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl shadow-lg">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-white">Órdenes por Tipo</CardTitle></CardHeader>
                  <CardContent className="flex items-center justify-center">
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={otsPorTipo} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                          {otsPorTipo.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={item} className="lg:col-span-2">
                <Card className="border-0 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl shadow-lg">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-white">Evolución: Completadas vs Pendientes</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <ComposedChart data={otsPorMes}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                        <Legend wrapperStyle={{ fontSize: 11, color: '#cbd5e1' }} />
                        <Bar dataKey="completadas" fill="#10b981" name="Completadas" radius={[4,4,0,0]} />
                        <Line type="monotone" dataKey="pendientes" stroke="#f59e0b" name="Pendientes" strokeWidth={2} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          </TabsContent>

          {/* Personal */}
          <TabsContent value="personal" className="mt-4 space-y-4">
            <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <motion.div variants={item} className="lg:col-span-2">
                <Card className="border-0 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl shadow-lg">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-white">Eficiencia por Técnico (OTs)</CardTitle></CardHeader>
                  <CardContent>
                    {eficienciaPorTecnico.length === 0 ? (
                      <div className="text-center py-12 text-slate-500">Sin órdenes asignadas</div>
                    ) : (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={eficienciaPorTecnico}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} angle={-45} textAnchor="end" height={80} />
                          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} domain={[0,100]} />
                          <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} formatter={(v, n) => [n === 'eficiencia' ? `${v}%` : v, n === 'eficiencia' ? 'Eficiencia' : n === 'total' ? 'Total OTs' : 'Completadas']} />
                          <Legend wrapperStyle={{ fontSize: 11, color: '#cbd5e1' }} />
                          <Bar dataKey="total" fill="#334155" name="Total OTs" radius={[4,4,0,0]} />
                          <Bar dataKey="completadas" fill="#10b981" name="Completadas" radius={[4,4,0,0]} />
                          <Bar dataKey="eficiencia" fill="#06b6d4" name="Eficiencia %" radius={[4,4,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={item} className="lg:col-span-2">
                <Card className="border-0 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl shadow-lg">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-white">Plantel de Empleados</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-80 overflow-y-auto pr-1">
                      {employees.length === 0 ? (
                        <p className="text-sm text-slate-500 col-span-3 text-center py-6">Sin empleados registrados</p>
                      ) : employees.map(e => {
                        const otsEmp = orders.filter(o => o.assigned_name === e.full_name);
                        const completadas = otsEmp.filter(o => o.status === 'completada').length;
                        const statusColors = { activo: 'bg-emerald-500/20 text-emerald-300', licencia: 'bg-amber-500/20 text-amber-300', vacaciones: 'bg-blue-500/20 text-blue-300', inactivo: 'bg-slate-500/20 text-slate-400' };
                        return (
                          <div key={e.id} className="bg-slate-700/30 rounded-lg border border-slate-600/30 p-3 flex flex-col gap-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-white truncate">{e.full_name}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${statusColors[e.status] || 'bg-slate-500/20 text-slate-400'}`}>{e.status || 'activo'}</span>
                            </div>
                            <span className="text-xs text-slate-400 capitalize">{e.specialty || e.role || '—'}</span>
                            <div className="text-[11px] text-slate-500 mt-1">
                              {otsEmp.length} OTs · {completadas} completadas
                              {otsEmp.length > 0 && <span className="ml-1 text-cyan-400">({Math.round(completadas/otsEmp.length*100)}%)</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          </TabsContent>

          {/* Financiero */}
          <TabsContent value="financiero" className="mt-4 space-y-4">
            <motion.div variants={container} initial="hidden" animate="show">
              <motion.div variants={item}>
                <Card className="border-0 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl shadow-lg">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-white">Costos por Proyecto</CardTitle></CardHeader>
                  <CardContent>
                    {costosPorProyecto.length === 0 ? (
                      <div className="text-center py-12 text-slate-500">Sin datos de costos</div>
                    ) : (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={costosPorProyecto} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                          <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#94a3b8' }} width={120} />
                          <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} formatter={(v) => fmt(v)} />
                          <Bar dataKey="costo" fill="#f59e0b" radius={[0,4,4,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          </TabsContent>

          {/* Inventario */}
          <TabsContent value="inventario" className="mt-4 space-y-4">
            <motion.div variants={container} initial="hidden" animate="show">
              <motion.div variants={item}>
                <Card className="border-0 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl shadow-lg">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-white">Stock vs Mínimo</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {materials.filter(m => m.min_stock > 0).length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-8">Sin materiales con stock mínimo</p>
                      ) : materials.filter(m => m.min_stock > 0).map(m => {
                        const pct = Math.min((m.stock / m.min_stock) * 100, 100);
                        const isLow = m.stock <= m.min_stock;
                        return (
                          <div key={m.id} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="font-medium text-slate-300 truncate">{m.name}</span>
                              <span className={isLow ? 'text-red-400 font-bold' : 'text-emerald-400'}>
                                {m.stock} / {m.min_stock}
                              </span>
                            </div>
                            <div className="w-full bg-slate-700/50 rounded-full h-2">
                              <div className={`h-2 rounded-full transition-all ${isLow ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          </TabsContent>
          {/* Pendientes */}
          <TabsContent value="pendientes" className="mt-4 space-y-4">
            {/* KPIs Pendientes */}
            <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <motion.div variants={item}>
                <KpiMetric title="Total Pendientes" value={pendientes.length} subtitle={`${pendientesActivos.length} activos`} icon={ClipboardList} color="blue" />
              </motion.div>
              <motion.div variants={item}>
                <KpiMetric title="Tasa Resolución" value={`${tasaResolucionPend}%`} subtitle={`${pendientesResueltos.length} resueltos`} icon={CheckCircle2} color="green" />
              </motion.div>
              <motion.div variants={item}>
                <KpiMetric title="Vencidos" value={pendientesVencidos.length} subtitle="Fecha límite superada" icon={AlertTriangle} color="red" />
              </motion.div>
              <motion.div variants={item}>
                <KpiMetric title="Sin Asignar" value={pendientes.filter(p => !p.jefe_sitio && !['resuelto','cancelado'].includes(p.estado)).length} subtitle="Requieren atención" icon={Target} color="amber" />
              </motion.div>
            </motion.div>

            <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Por estado */}
              <motion.div variants={item}>
                <Card className="border-0 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl shadow-lg">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-white">Distribución por Estado</CardTitle></CardHeader>
                  <CardContent className="flex items-center justify-center">
                    {pendientesPorEstado.length === 0 ? (
                      <div className="text-center py-12 text-slate-500">Sin datos</div>
                    ) : (
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie data={pendientesPorEstado} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                            {pendientesPorEstado.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Por prioridad */}
              <motion.div variants={item}>
                <Card className="border-0 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl shadow-lg">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-white">Eficiencia por Prioridad</CardTitle></CardHeader>
                  <CardContent>
                    {pendientesPorPrioridad.length === 0 ? (
                      <div className="text-center py-12 text-slate-500">Sin datos</div>
                    ) : (
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={pendientesPorPrioridad}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                          <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} formatter={(v, n) => [n === 'eficiencia' ? `${v}%` : v, n === 'eficiencia' ? 'Eficiencia %' : n === 'total' ? 'Total' : 'Resueltos']} />
                          <Legend wrapperStyle={{ fontSize: 11, color: '#cbd5e1' }} />
                          <Bar dataKey="total" fill="#334155" name="Total" radius={[4,4,0,0]} />
                          <Bar dataKey="resueltos" fill="#10b981" name="Resueltos" radius={[4,4,0,0]} />
                          <Bar dataKey="eficiencia" fill="#06b6d4" name="Eficiencia %" radius={[4,4,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Por jefe de sitio */}
              <motion.div variants={item} className="lg:col-span-2">
                <Card className="border-0 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl shadow-lg">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-white">Eficiencia por Jefe de Sitio</CardTitle></CardHeader>
                  <CardContent>
                    {pendientesPorJefe.length === 0 ? (
                      <div className="text-center py-12 text-slate-500">Sin jefes asignados</div>
                    ) : (
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={pendientesPorJefe}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis dataKey="jefe" tick={{ fontSize: 10, fill: '#94a3b8' }} angle={-30} textAnchor="end" height={70} />
                          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                          <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} formatter={(v, n) => [n === 'eficiencia' ? `${v}%` : v, { total: 'Total', resueltos: 'Resueltos', vencidos: 'Vencidos', eficiencia: 'Eficiencia %' }[n] || n]} />
                          <Legend wrapperStyle={{ fontSize: 11, color: '#cbd5e1' }} />
                          <Bar dataKey="total" fill="#3b82f6" name="Total" radius={[4,4,0,0]} />
                          <Bar dataKey="resueltos" fill="#10b981" name="Resueltos" radius={[4,4,0,0]} />
                          <Bar dataKey="vencidos" fill="#ef4444" name="Vencidos" radius={[4,4,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Por comuna */}
              <motion.div variants={item} className="lg:col-span-2">
                <Card className="border-0 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl shadow-lg">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-white">Pendientes por Comuna</CardTitle></CardHeader>
                  <CardContent>
                    {pendientesPorComuna.length === 0 ? (
                      <div className="text-center py-12 text-slate-500">Sin datos por comuna</div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {pendientesPorComuna.map((c, i) => (
                          <div key={c.comuna} className="bg-slate-700/30 rounded-xl border border-slate-600/30 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-lg font-bold text-white">Comuna {c.comuna}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">{c.total} total</span>
                            </div>
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-xs">
                                <span className="text-slate-400">Resueltos</span>
                                <span className="text-emerald-400 font-semibold">{c.resueltos}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-slate-400">Activos</span>
                                <span className="text-amber-400 font-semibold">{c.activos}</span>
                              </div>
                              <div className="w-full bg-slate-600/50 rounded-full h-2 mt-2">
                                <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${c.total > 0 ? (c.resueltos / c.total) * 100 : 0}%` }} />
                              </div>
                              <div className="text-xs text-slate-500 text-right">{c.total > 0 ? Math.round((c.resueltos/c.total)*100) : 0}% resuelto</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          </TabsContent>

          {/* Resumen Semanal */}
          <TabsContent value="semanal" className="mt-4 space-y-4">
            <Card className="border-0 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl shadow-lg">
              <CardContent className="pt-6 pb-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-white font-semibold text-base">Resumen Semanal Operativo</h3>
                    <p className="text-slate-400 text-xs mt-1">
                      {resumenFecha ? `Última actualización: ${resumenFecha.toLocaleString('es-AR')}` : 'Generá el resumen para ver el estado actual'}
                    </p>
                  </div>
                  <Button onClick={fetchResumenSemanal} disabled={loadingResumen} className="gap-2">
                    {loadingResumen ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    {loadingResumen ? 'Generando...' : 'Generar Resumen'}
                  </Button>
                </div>

                {!resumenSemanal && !loadingResumen && (
                  <div className="text-center py-16 text-slate-500">
                    <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Hacé clic en "Generar Resumen" para ver el estado operativo semanal</p>
                  </div>
                )}

                {loadingResumen && (
                  <div className="text-center py-16 text-slate-400">
                    <RefreshCw className="h-10 w-10 mx-auto mb-3 animate-spin opacity-50" />
                    <p className="text-sm">Analizando datos...</p>
                  </div>
                )}

                {resumenSemanal?.resumenGlobal && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      {[
                        { label: 'Pendientes Vencidos', value: resumenSemanal.resumenGlobal.vencidos, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
                        { label: 'Resueltos esta semana', value: resumenSemanal.resumenGlobal.resueltosSemana, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
                        { label: 'OTs completadas', value: resumenSemanal.resumenGlobal.otsCompletadasSemana, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
                        { label: 'Emergencias activas', value: resumenSemanal.resumenGlobal.emergenciasActivas, color: resumenSemanal.resumenGlobal.emergenciasActivas > 0 ? 'text-red-400' : 'text-slate-400', bg: resumenSemanal.resumenGlobal.emergenciasActivas > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-700/30 border-slate-600/30' },
                      ].map((stat, i) => (
                        <div key={i} className={`rounded-xl border p-4 text-center ${stat.bg}`}>
                          <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
                          <div className="text-xs text-slate-400 mt-1">{stat.label}</div>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-slate-700/30 rounded-xl border border-slate-600/30 p-4 flex items-center gap-4">
                        <AlertTriangle className="h-8 w-8 text-amber-400 flex-shrink-0" />
                        <div>
                          <div className="text-xl font-bold text-white">{resumenSemanal.resumenGlobal.totalPendientes}</div>
                          <div className="text-xs text-slate-400">Pendientes SAP sin resolver</div>
                        </div>
                      </div>
                      <div className="bg-slate-700/30 rounded-xl border border-slate-600/30 p-4 flex items-center gap-4">
                        <Wrench className="h-8 w-8 text-blue-400 flex-shrink-0" />
                        <div>
                          <div className="text-xl font-bold text-white">{resumenSemanal.resumenGlobal.otsNuevasSemana}</div>
                          <div className="text-xs text-slate-400">OTs nuevas esta semana</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </motion.div>
    </div>
  );
}