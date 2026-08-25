import React, { useState } from 'react';
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
  ResponsiveContainer, Legend, AreaChart, Area, ComposedChart,
} from 'recharts';
import {
  BarChart2, TrendingUp, Clock, Package, Wrench, CheckCircle2, AlertTriangle, Download,
  Filter, Target, Users, Activity, CalendarDays, ClipboardList, RefreshCw, RotateCcw, Building2,
} from 'lucide-react';
import { exportKPIsPDF } from '@/utils/exportPDF';
import { format, subMonths } from 'date-fns';
import { KpiSkeleton, TableSkeleton, KpiCard } from '@/components/reportes/shared';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);
const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];
const TOOLTIP_STYLE = { backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', color: '#e2e8f0' };

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

const SECTOR_LABEL = { escuela: 'Escuela', bapro: 'BAPRO' };

function ChartCard({ title, children, className = '' }) {
  return (
    <Card className={`border-0 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl shadow-lg ${className}`}>
      <CardHeader className="pb-2"><CardTitle className="text-sm text-white">{title}</CardTitle></CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
function Empty({ text = 'Sin datos' }) {
  return <div className="text-center py-12 text-slate-500 text-sm">{text}</div>;
}

export default function Reportes() {
  const [dateFrom, setDateFrom] = useState(format(subMonths(new Date(), 5), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [comuna, setComuna] = useState('all');
  const [jefe, setJefe] = useState('all');
  const [proyecto, setProyecto] = useState('all');
  const [tecnico, setTecnico] = useState('all');
  const [exportingPDF, setExportingPDF] = useState(false);
  const [resumenSemanal, setResumenSemanal] = useState(null);
  const [loadingResumen, setLoadingResumen] = useState(false);
  const [resumenFecha, setResumenFecha] = useState(null);

  // Un único round-trip: filtros + agregados sobre el total del sector (backend-first).
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['reportes-gerenciales', { dateFrom, dateTo, comuna, jefe, proyecto, tecnico }],
    queryFn: () => base44.functions.invoke('getReportesGerenciales', { dateFrom, dateTo, comuna, jefe, proyecto, tecnico }).then(r => r.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  });

  const filtros = data?.filtros || { comunas: [], jefes: [], proyectos: [], tecnicos: [] };
  const kpis = data?.kpis || { total: 0, completadas: 0, canceladas: 0, eficiencia: 0, costoMaterialTotal: 0, horasPromedio: 0, timeLogsCount: 0 };
  const otsPorMes = data?.otsPorMes || [];
  const otsPorTipo = data?.otsPorTipo || [];
  const eficienciaPorTecnico = data?.eficienciaPorTecnico || [];
  const costosPorProyecto = data?.costosPorProyecto || [];
  const empleados = data?.empleados || [];
  const materiales = data?.materiales || [];
  const pend = data?.pendientes || { total: 0, activos: 0, resueltos: 0, vencidos: 0, sinAsignar: 0, tasaResolucion: 0, mttr: null, backlog: null, aging: [], porEstado: [], porTipo: [], porPrioridad: [], porJefe: [], porComuna: [] };

  const anyFilterActive = [comuna, jefe, proyecto, tecnico].some(v => v !== 'all');
  const limpiarFiltros = () => { setComuna('all'); setJefe('all'); setProyecto('all'); setTecnico('all'); };

  const handleExportPDF = async () => {
    setExportingPDF(true);
    try {
      await exportKPIsPDF({ orders: data?.ordersExport || [], timeLogs: data?.timeLogsExport || [], materials: materiales, assets: [], dateFrom, dateTo });
    } catch (e) { console.error('Error exportando PDF:', e); }
    finally { setExportingPDF(false); }
  };

  const fetchResumenSemanal = async () => {
    setLoadingResumen(true);
    try {
      const res = await base44.functions.invoke('resumenSemanal', {});
      setResumenSemanal(res.data);
      setResumenFecha(new Date());
    } finally { setLoadingResumen(false); }
  };

  const chartLoading = isLoading && !data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 space-y-6 page-enter">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-teal-500/30 rounded-full blur-3xl opacity-20 animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
              <BarChart2 className="h-6 w-6 text-white" />
            </div>
            Reportes Gerenciales
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <p className="text-slate-400 text-sm">Análisis integral de proyectos, operaciones e inventario</p>
            {data?.sector && (
              <Badge className="gap-1 bg-teal-500/15 text-teal-300 border-teal-500/30">
                <Building2 className="h-3 w-3" /> {SECTOR_LABEL[data.sector] || data.sector}
              </Badge>
            )}
          </div>
        </div>
        <Button onClick={handleExportPDF} disabled={exportingPDF || chartLoading} className="gap-2 bg-teal-600 hover:bg-teal-500">
          {exportingPDF ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {exportingPDF ? 'Generando...' : 'Exportar PDF'}
        </Button>
      </motion.div>

      {/* Filtros Avanzados */}
      <Card className="border-0 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl shadow-lg">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-teal-400" />
              <span className="text-sm font-semibold text-white">Filtros Avanzados</span>
              {isFetching && !isLoading && <RefreshCw className="h-3 w-3 text-teal-400 animate-spin" />}
            </div>
            {anyFilterActive && (
              <Button variant="ghost" size="sm" onClick={limpiarFiltros} className="h-7 text-xs text-slate-300 hover:text-white gap-1">
                <RotateCcw className="h-3 w-3" /> Limpiar
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase block mb-2">Desde</label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 text-xs bg-slate-700/50 border-slate-600/50 text-white" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase block mb-2">Hasta</label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 text-xs bg-slate-700/50 border-slate-600/50 text-white" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase block mb-2">Comuna</label>
              <Select value={comuna} onValueChange={setComuna}>
                <SelectTrigger className="h-9 text-xs bg-slate-700/50 border-slate-600/50 text-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {filtros.comunas.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase block mb-2">Jefe de Sitio</label>
              <Select value={jefe} onValueChange={setJefe}>
                <SelectTrigger className="h-9 text-xs bg-slate-700/50 border-slate-600/50 text-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {filtros.jefes.map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase block mb-2">Proyecto</label>
              <Select value={proyecto} onValueChange={setProyecto}>
                <SelectTrigger className="h-9 text-xs bg-slate-700/50 border-slate-600/50 text-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {filtros.proyectos.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase block mb-2">Técnico</label>
              <Select value={tecnico} onValueChange={setTecnico}>
                <SelectTrigger className="h-9 text-xs bg-slate-700/50 border-slate-600/50 text-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {filtros.tecnicos.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      {chartLoading ? (
        <KpiSkeleton count={4} />
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div variants={item}><KpiCard label="Órdenes Totales" value={kpis.total} sub={`${kpis.completadas} completadas`} icon={Wrench} accent="blue" /></motion.div>
          <motion.div variants={item}><KpiCard label="Tasa Cumplimiento" value={`${kpis.eficiencia}%`} sub="Completadas / válidas" icon={CheckCircle2} accent="emerald" /></motion.div>
          <motion.div variants={item}><KpiCard label="Costo Materiales" value={fmt(kpis.costoMaterialTotal)} sub="Total invertido" icon={Package} accent="amber" /></motion.div>
          <motion.div variants={item}><KpiCard label="Prom. Horas/Registro" value={`${kpis.horasPromedio}h`} sub={`${kpis.timeLogsCount} registros`} icon={Clock} accent="purple" /></motion.div>
        </motion.div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="operaciones" className="w-full">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 bg-slate-800/50 border border-slate-700/50">
          <TabsTrigger value="operaciones" className="gap-1.5 text-xs"><Activity className="h-3.5 w-3.5" /> Operaciones</TabsTrigger>
          <TabsTrigger value="personal" className="gap-1.5 text-xs"><Users className="h-3.5 w-3.5" /> Personal</TabsTrigger>
          <TabsTrigger value="financiero" className="gap-1.5 text-xs"><TrendingUp className="h-3.5 w-3.5" /> Financiero</TabsTrigger>
          <TabsTrigger value="inventario" className="gap-1.5 text-xs"><Package className="h-3.5 w-3.5" /> Inventario</TabsTrigger>
          <TabsTrigger value="pendientes" className="gap-1.5 text-xs"><ClipboardList className="h-3.5 w-3.5" /> Pendientes</TabsTrigger>
          <TabsTrigger value="semanal" className="gap-1.5 text-xs"><CalendarDays className="h-3.5 w-3.5" /> Semanal</TabsTrigger>
        </TabsList>

        {/* Operaciones */}
        <TabsContent value="operaciones" className="mt-4 space-y-4">
          {chartLoading ? <TableSkeleton rows={6} cols={6} /> : (
            <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <motion.div variants={item}>
                <ChartCard title="Órdenes por Mes">
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={otsPorMes}>
                      <defs><linearGradient id="cCompl" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.8} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Area type="monotone" dataKey="completadas" stroke="#10b981" fillOpacity={1} fill="url(#cCompl)" name="Completadas" />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>
              </motion.div>
              <motion.div variants={item}>
                <ChartCard title="Órdenes por Tipo">
                  {otsPorTipo.length === 0 ? <Empty /> : (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={otsPorTipo} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                          {otsPorTipo.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>
              </motion.div>
              <motion.div variants={item} className="lg:col-span-2">
                <ChartCard title="Evolución: Completadas vs Pendientes">
                  {otsPorMes.length === 0 ? <Empty /> : (
                    <ResponsiveContainer width="100%" height={250}>
                      <ComposedChart data={otsPorMes}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Legend wrapperStyle={{ fontSize: 11, color: '#cbd5e1' }} />
                        <Bar dataKey="completadas" fill="#10b981" name="Completadas" radius={[4, 4, 0, 0]} />
                        <Line type="monotone" dataKey="pendientes" stroke="#f59e0b" name="Pendientes" strokeWidth={2} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>
              </motion.div>
            </motion.div>
          )}
        </TabsContent>

        {/* Personal */}
        <TabsContent value="personal" className="mt-4 space-y-4">
          {chartLoading ? <TableSkeleton rows={6} cols={6} /> : (
            <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <motion.div variants={item} className="lg:col-span-2">
                <ChartCard title="Eficiencia por Técnico (OTs)">
                  {eficienciaPorTecnico.length === 0 ? <Empty text="Sin órdenes asignadas" /> : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={eficienciaPorTecnico}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} angle={-45} textAnchor="end" height={80} />
                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} domain={[0, 100]} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [n === 'eficiencia' ? `${v}%` : v, n === 'eficiencia' ? 'Eficiencia' : n === 'total' ? 'Total OTs' : 'Completadas']} />
                        <Legend wrapperStyle={{ fontSize: 11, color: '#cbd5e1' }} />
                        <Bar dataKey="total" fill="#334155" name="Total OTs" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="completadas" fill="#10b981" name="Completadas" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="eficiencia" fill="#06b6d4" name="Eficiencia %" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>
              </motion.div>
              <motion.div variants={item} className="lg:col-span-2">
                <ChartCard title="Plantel de Empleados">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-80 overflow-y-auto pr-1">
                    {empleados.length === 0 ? <p className="text-sm text-slate-500 col-span-3 text-center py-6">Sin empleados registrados</p> : empleados.map(e => {
                      const statusColors = { activo: 'bg-emerald-500/20 text-emerald-300', licencia: 'bg-amber-500/20 text-amber-300', vacaciones: 'bg-blue-500/20 text-blue-300', inactivo: 'bg-slate-500/20 text-slate-400' };
                      return (
                        <div key={e.id} className="bg-slate-700/30 rounded-lg border border-slate-600/30 p-3 flex flex-col gap-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-white truncate">{e.full_name || '—'}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${statusColors[e.status] || 'bg-slate-500/20 text-slate-400'}`}>{e.status || 'activo'}</span>
                          </div>
                          <span className="text-xs text-slate-400 capitalize">{e.specialty || e.role || '—'}</span>
                          <div className="text-[11px] text-slate-500 mt-1">
                            {e.ots} OTs · {e.completadas} completadas
                            {e.ots > 0 && <span className="ml-1 text-cyan-400">({Math.round(e.completadas / e.ots * 100)}%)</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ChartCard>
              </motion.div>
            </motion.div>
          )}
        </TabsContent>

        {/* Financiero */}
        <TabsContent value="financiero" className="mt-4 space-y-4">
          {chartLoading ? <TableSkeleton rows={6} cols={6} /> : (
            <motion.div variants={container} initial="hidden" animate="show">
              <motion.div variants={item}>
                <ChartCard title="Costos por Proyecto">
                  {costosPorProyecto.length === 0 ? <Empty text="Sin datos de costos" /> : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={costosPorProyecto} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#94a3b8' }} width={120} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => fmt(v)} />
                        <Bar dataKey="costo" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>
              </motion.div>
            </motion.div>
          )}
        </TabsContent>

        {/* Inventario */}
        <TabsContent value="inventario" className="mt-4 space-y-4">
          {chartLoading ? <TableSkeleton rows={6} cols={6} /> : (
            <motion.div variants={container} initial="hidden" animate="show">
              <motion.div variants={item}>
                <ChartCard title="Stock vs Mínimo">
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {materiales.length === 0 ? <p className="text-sm text-slate-500 text-center py-8">Sin materiales con stock mínimo</p> : materiales.map(m => {
                      const pct = Math.min((m.stock / m.min_stock) * 100, 100);
                      const isLow = m.stock <= m.min_stock;
                      return (
                        <div key={m.id} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-medium text-slate-300 truncate">{m.name}</span>
                            <span className={isLow ? 'text-red-400 font-bold' : 'text-emerald-400'}>{m.stock} / {m.min_stock}</span>
                          </div>
                          <div className="w-full bg-slate-700/50 rounded-full h-2">
                            <div className={`h-2 rounded-full transition-all ${isLow ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ChartCard>
              </motion.div>
            </motion.div>
          )}
        </TabsContent>

        {/* Pendientes */}
        <TabsContent value="pendientes" className="mt-4 space-y-4">
          {chartLoading ? <><KpiSkeleton count={4} /><TableSkeleton rows={6} cols={6} /></> : (
            <>
              <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <motion.div variants={item}><KpiCard label="Total Pendientes" value={pend.total} sub={`${pend.activos} activos`} icon={ClipboardList} accent="blue" /></motion.div>
                <motion.div variants={item}><KpiCard label="Tasa Resolución" value={`${pend.tasaResolucion}%`} sub={`${pend.resueltos} resueltos`} icon={CheckCircle2} accent="emerald" /></motion.div>
                <motion.div variants={item}><KpiCard label="Vencidos" value={pend.vencidos} sub="Fecha límite superada" icon={AlertTriangle} accent="red" /></motion.div>
                <motion.div variants={item}><KpiCard label="Sin Asignar" value={pend.sinAsignar} sub="Requieren atención" icon={Target} accent="amber" /></motion.div>
              </motion.div>

              <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <motion.div variants={item}><KpiCard label="MTTR (días)" value={pend.mttr !== null ? `${pend.mttr}d` : '—'} sub="Tiempo medio resolución" icon={Clock} accent="purple" /></motion.div>
                <motion.div variants={item}><KpiCard label="Backlog Ratio" value={pend.backlog !== null ? `${pend.backlog}x` : '—'} sub="Activos / resueltos" icon={Activity} accent="blue" /></motion.div>
                <motion.div variants={item}>
                  <Card className="border-0 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl shadow-lg border-slate-700/50">
                    <CardContent className="pt-5 pb-5">
                      <div className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wide">Aging de Pendientes Activos</div>
                      <div className="space-y-2">
                        {pend.aging.map(a => {
                          const maxCount = Math.max(...pend.aging.map(x => x.count), 1);
                          const pct = (a.count / maxCount) * 100;
                          const color = a.rango === '0-7d' ? 'bg-emerald-500' : a.rango === '8-30d' ? 'bg-amber-500' : a.rango === '31-60d' ? 'bg-orange-500' : 'bg-red-500';
                          return (
                            <div key={a.rango} className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-400 w-12 flex-shrink-0">{a.rango}</span>
                              <div className="flex-1 bg-slate-700/50 rounded-full h-3 overflow-hidden">
                                <div className={`h-3 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs text-white font-bold w-6 text-right tabular-nums">{a.count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>

              <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <motion.div variants={item}>
                  <ChartCard title="Distribución por Estado">
                    {pend.porEstado.length === 0 ? <Empty /> : (
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie data={pend.porEstado} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                            {pend.porEstado.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={TOOLTIP_STYLE} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </ChartCard>
                </motion.div>
                <motion.div variants={item}>
                  <ChartCard title="Eficiencia por Prioridad">
                    {pend.porPrioridad.length === 0 ? <Empty /> : (
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={pend.porPrioridad}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [n === 'eficiencia' ? `${v}%` : v, n === 'eficiencia' ? 'Eficiencia %' : n === 'total' ? 'Total' : 'Resueltos']} />
                          <Legend wrapperStyle={{ fontSize: 11, color: '#cbd5e1' }} />
                          <Bar dataKey="total" fill="#334155" name="Total" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="resueltos" fill="#10b981" name="Resueltos" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="eficiencia" fill="#06b6d4" name="Eficiencia %" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </ChartCard>
                </motion.div>
                <motion.div variants={item} className="lg:col-span-2">
                  <ChartCard title="Eficiencia por Jefe de Sitio">
                    {pend.porJefe.length === 0 ? <Empty text="Sin jefes asignados" /> : (
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={pend.porJefe}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis dataKey="jefe" tick={{ fontSize: 10, fill: '#94a3b8' }} angle={-30} textAnchor="end" height={70} />
                          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [v, { total: 'Total', resueltos: 'Resueltos', vencidos: 'Vencidos', eficiencia: 'Eficiencia %' }[n] || n]} />
                          <Legend wrapperStyle={{ fontSize: 11, color: '#cbd5e1' }} />
                          <Bar dataKey="total" fill="#3b82f6" name="Total" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="resueltos" fill="#10b981" name="Resueltos" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="vencidos" fill="#ef4444" name="Vencidos" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </ChartCard>
                </motion.div>
                <motion.div variants={item} className="lg:col-span-2">
                  <ChartCard title="Pendientes por Comuna">
                    {pend.porComuna.length === 0 ? <Empty text="Sin datos por comuna" /> : (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {pend.porComuna.map(c => (
                          <div key={c.comuna} className="bg-slate-700/30 rounded-xl border border-slate-600/30 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-lg font-bold text-white">Comuna {c.comuna}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">{c.total} total</span>
                            </div>
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-xs"><span className="text-slate-400">Resueltos</span><span className="text-emerald-400 font-semibold">{c.resueltos}</span></div>
                              <div className="flex justify-between text-xs"><span className="text-slate-400">Activos</span><span className="text-amber-400 font-semibold">{c.activos}</span></div>
                              <div className="w-full bg-slate-600/50 rounded-full h-2 mt-2">
                                <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${c.total > 0 ? (c.resueltos / c.total) * 100 : 0}%` }} />
                              </div>
                              <div className="text-xs text-slate-500 text-right">{c.total > 0 ? Math.round((c.resueltos / c.total) * 100) : 0}% resuelto</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ChartCard>
                </motion.div>
              </motion.div>
            </>
          )}
        </TabsContent>

        {/* Resumen Semanal */}
        <TabsContent value="semanal" className="mt-4 space-y-4">
          <Card className="border-0 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl shadow-lg">
            <CardContent className="pt-6 pb-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-white font-semibold text-base">Resumen Semanal Operativo</h3>
                  <p className="text-slate-400 text-xs mt-1">{resumenFecha ? `Última actualización: ${resumenFecha.toLocaleString('es-AR')}` : 'Generá el resumen para ver el estado actual'}</p>
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
                      <div><div className="text-xl font-bold text-white">{resumenSemanal.resumenGlobal.totalPendientes}</div><div className="text-xs text-slate-400">Pendientes SAP sin resolver</div></div>
                    </div>
                    <div className="bg-slate-700/30 rounded-xl border border-slate-600/30 p-4 flex items-center gap-4">
                      <Wrench className="h-8 w-8 text-blue-400 flex-shrink-0" />
                      <div><div className="text-xl font-bold text-white">{resumenSemanal.resumenGlobal.otsNuevasSemana}</div><div className="text-xs text-slate-400">OTs nuevas esta semana</div></div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}