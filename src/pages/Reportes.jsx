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
  Filter, FileText, Target, Users, Activity, Zap
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
  const [dateFrom, setDateFrom] = useState(format(subMonths(new Date(), 5), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [comunaFilter, setComunaFilter] = useState('all');
  const [jefeFilter, setJefeFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');

  // Fetch all data
  const { data: orders = [] } = useQuery({ queryKey: ['workorders'], queryFn: () => base44.entities.WorkOrder.list() });
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list() });
  const { data: timeLogs = [] } = useQuery({ queryKey: ['timelogs_all'], queryFn: () => base44.entities.TimeLog.list() });
  const { data: materials = [] } = useQuery({ queryKey: ['materials'], queryFn: () => base44.entities.Material.list() });
  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: () => base44.entities.Employee.list() });
  const { data: locations = [] } = useQuery({ queryKey: ['locations'], queryFn: () => base44.entities.LocationData.list() });

  // Get unique filter options
  const comunasUnicas = ['8A', '8B', '10A'];
  const jefesUnicos = [...new Set(locations.map(l => l.jefe_sitio).filter(Boolean))];

  // Filter data
  const filteredOrders = useMemo(() => {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    return orders.filter(o => {
      const date = o.created_date ? new Date(o.created_date) : null;
      const inRange = !date || (date >= from && date <= to);
      const inProject = projectFilter === 'all' || o.project_name === projectFilter;

      // Para OTs podemos usar comuna y jefe de sitio desde LocationQR o asignación
      let matchComuna = comunaFilter === 'all' || true;
      let matchJefe = jefeFilter === 'all' || true;

      return inRange && inProject && matchComuna && matchJefe;
    });
  }, [orders, dateFrom, dateTo, projectFilter, comunaFilter, jefeFilter]);

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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
          <TabsList className="grid w-full grid-cols-4 bg-slate-800/50 border border-slate-700/50">
            <TabsTrigger value="operaciones" className="gap-1.5 text-xs"><Activity className="h-3.5 w-3.5" /> Operaciones</TabsTrigger>
            <TabsTrigger value="personal" className="gap-1.5 text-xs"><Users className="h-3.5 w-3.5" /> Personal</TabsTrigger>
            <TabsTrigger value="financiero" className="gap-1.5 text-xs"><TrendingUp className="h-3.5 w-3.5" /> Financiero</TabsTrigger>
            <TabsTrigger value="inventario" className="gap-1.5 text-xs"><Package className="h-3.5 w-3.5" /> Inventario</TabsTrigger>
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
            <motion.div variants={container} initial="hidden" animate="show">
              <motion.div variants={item}>
                <Card className="border-0 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl shadow-lg">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-white">Eficiencia por Técnico</CardTitle></CardHeader>
                  <CardContent>
                    {eficienciaPorTecnico.length === 0 ? (
                      <div className="text-center py-12 text-slate-500">Sin datos</div>
                    ) : (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={eficienciaPorTecnico}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} angle={-45} textAnchor="end" height={80} />
                          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                          <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} formatter={(v) => [`${v}%`, 'Eficiencia']} />
                          <Bar dataKey="eficiencia" fill="#06b6d4" name="Eficiencia" radius={[4,4,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
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
        </Tabs>
      </motion.div>
    </div>
  );
}