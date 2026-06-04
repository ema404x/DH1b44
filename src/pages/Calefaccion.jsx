import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Flame, AlertTriangle, CheckCircle2, XCircle, Upload,
  BarChart3, Building2, Search, Download, RefreshCw, Filter
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, RadarChart, PolarGrid, PolarAngleAxis, Radar
} from 'recharts';
import ImportarCalefaccionModal from '@/components/calefaccion/ImportarCalefaccionModal';
import TablaEquipos from '@/components/calefaccion/TablaEquipos';

const COLORS = ['#ef4444', '#f97316', '#3b82f6', '#10b981'];
const ESTADO_CONFIG = {
  critico: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', badge: 'bg-red-500/20 text-red-300 border-red-500/40', label: 'Crítico', icon: XCircle },
  alerta:  { color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30', badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40', label: 'Alerta', icon: AlertTriangle },
  normal:  { color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30', badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40', label: 'Normal', icon: Flame },
  optimo:  { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', label: 'Óptimo', icon: CheckCircle2 },
};

const TIPO_LABELS = {
  estufas: 'Estufas',
  radiadores: 'Radiadores',
  conductos: 'Conductos',
  calderas: 'Calderas',
  vrv: 'VRV',
  vrv_bajo_silueta: 'VRV Bajo Silueta',
  aire_acondicionado_calor: 'Aire Acond.',
  otros: 'Otros',
};

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

function KpiCard({ label, value, sub, icon: Icon, colorClass, bgClass }) {
  return (
    <motion.div variants={item}>
      <Card className={`border ${bgClass} bg-transparent`}>
        <CardContent className="p-4 flex items-center gap-4">
          <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${bgClass} shrink-0`}>
            <Icon className={`h-5 w-5 ${colorClass}`} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">{label}</p>
            <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
            {sub && <p className="text-xs text-slate-500">{sub}</p>}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function Calefaccion() {
  const [showImport, setShowImport] = useState(false);
  const [filtroComuna, setFiltroComuna] = useState('todas');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');

  const { data: equipos = [], isLoading, refetch } = useQuery({
    queryKey: ['calefaccion'],
    queryFn: () => base44.entities.EquipamientoCalefaccion.list('-created_date', 5000),
  });

  // Filtros
  const equiposFiltrados = useMemo(() => {
    return equipos.filter(e => {
      if (filtroComuna !== 'todas' && e.comuna !== filtroComuna) return false;
      if (filtroEstado !== 'todos' && e.estado !== filtroEstado) return false;
      if (filtroTipo !== 'todos' && e.tipo_equipo !== filtroTipo) return false;
      if (busqueda && !e.escuela?.toLowerCase().includes(busqueda.toLowerCase()) &&
          !e.jefe_sitio?.toLowerCase().includes(busqueda.toLowerCase())) return false;
      return true;
    });
  }, [equipos, filtroComuna, filtroEstado, filtroTipo, busqueda]);

  // KPIs globales
  const kpis = useMemo(() => {
    const total = equipos.reduce((s, e) => s + (e.cantidad_total || 0), 0);
    const funciona = equipos.reduce((s, e) => s + (e.cantidad_funciona || 0), 0);
    const criticos = equipos.filter(e => e.estado === 'critico').length;
    const alertas = equipos.filter(e => e.estado === 'alerta').length;
    const pct = total > 0 ? Math.round((funciona / total) * 100) : 0;
    return { total, funciona, criticos, alertas, pct, escuelas: new Set(equipos.map(e => e.escuela)).size };
  }, [equipos]);

  // Por estado (pie)
  const porEstado = useMemo(() => [
    { name: 'Crítico', value: equipos.filter(e => e.estado === 'critico').length },
    { name: 'Alerta',  value: equipos.filter(e => e.estado === 'alerta').length },
    { name: 'Normal',  value: equipos.filter(e => e.estado === 'normal').length },
    { name: 'Óptimo',  value: equipos.filter(e => e.estado === 'optimo').length },
  ].filter(d => d.value > 0), [equipos]);

  // Por tipo (bar)
  const porTipo = useMemo(() => {
    const map = {};
    equipos.forEach(e => {
      const k = e.tipo_equipo;
      if (!map[k]) map[k] = { tipo: TIPO_LABELS[k] || k, total: 0, funciona: 0, no_funciona: 0 };
      map[k].total += e.cantidad_total || 0;
      map[k].funciona += e.cantidad_funciona || 0;
      map[k].no_funciona += e.cantidad_no_funciona || 0;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [equipos]);

  // Por comuna (bar)
  const porComuna = useMemo(() => {
    const map = {};
    equipos.forEach(e => {
      const k = e.comuna || 'N/A';
      if (!map[k]) map[k] = { comuna: k, total: 0, funciona: 0, no_funciona: 0, criticos: 0 };
      map[k].total += e.cantidad_total || 0;
      map[k].funciona += e.cantidad_funciona || 0;
      map[k].no_funciona += e.cantidad_no_funciona || 0;
      if (e.estado === 'critico') map[k].criticos++;
    });
    return Object.values(map);
  }, [equipos]);

  // Escuelas críticas
  const escuelasCriticas = useMemo(() => {
    const map = {};
    equipos.filter(e => e.estado === 'critico' || e.estado === 'alerta').forEach(e => {
      if (!map[e.escuela]) map[e.escuela] = { escuela: e.escuela, jefe: e.jefe_sitio, comuna: e.comuna, problemas: [] };
      map[e.escuela].problemas.push({ tipo: TIPO_LABELS[e.tipo_equipo], no_funciona: e.cantidad_no_funciona, estado: e.estado });
    });
    return Object.values(map).sort((a, b) => b.problemas.length - a.problemas.length);
  }, [equipos]);

  const handleExportCSV = () => {
    const headers = ['Escuela', 'Jefe Sitio', 'Comuna', 'Tipo Equipo', 'Total', 'Funciona', 'No Funciona', '% Operativo', 'Estado'];
    const rows = equiposFiltrados.map(e => [
      e.escuela, e.jefe_sitio, e.comuna,
      TIPO_LABELS[e.tipo_equipo] || e.tipo_equipo,
      e.cantidad_total, e.cantidad_funciona, e.cantidad_no_funciona,
      e.porcentaje_operativo + '%', e.estado
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'calefaccion.csv'; a.click();
  };

  const TABS = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'alertas', label: `Alertas${kpis.criticos + kpis.alertas > 0 ? ` (${kpis.criticos + kpis.alertas})` : ''}` },
    { id: 'tabla', label: 'Detalle' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-6 space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Flame className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Plan de Calefacción</h1>
            <p className="text-xs text-slate-400">{kpis.escuelas} establecimientos · {equipos.length} registros</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5 border-slate-700 text-slate-300">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5 border-slate-700 text-slate-300">
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button size="sm" onClick={() => setShowImport(true)} className="gap-1.5 bg-orange-600 hover:bg-orange-700">
            <Upload className="h-3.5 w-3.5" /> Importar Excel
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/50 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === t.id ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
          <RefreshCw className="h-5 w-5 animate-spin" /> Cargando datos...
        </div>
      ) : equipos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="h-16 w-16 rounded-2xl bg-slate-800 flex items-center justify-center">
            <Flame className="h-8 w-8 text-slate-600" />
          </div>
          <div>
            <p className="text-lg font-semibold text-white">Sin datos de calefacción</p>
            <p className="text-sm text-slate-400 mt-1">Importá el Excel de relevamiento para comenzar</p>
          </div>
          <Button onClick={() => setShowImport(true)} className="gap-2 bg-orange-600 hover:bg-orange-700 mt-2">
            <Upload className="h-4 w-4" /> Importar Excel
          </Button>
        </div>
      ) : (
        <>
          {/* DASHBOARD TAB */}
          {activeTab === 'dashboard' && (
            <div className="space-y-5">
              {/* KPIs */}
              <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Total Equipos" value={kpis.total.toLocaleString()} sub={`${kpis.escuelas} establecimientos`} icon={Building2} colorClass="text-blue-400" bgClass="bg-blue-500/10 border-blue-500/30" />
                <KpiCard label="Operativos" value={`${kpis.pct}%`} sub={`${kpis.funciona.toLocaleString()} unidades`} icon={CheckCircle2} colorClass="text-emerald-400" bgClass="bg-emerald-500/10 border-emerald-500/30" />
                <KpiCard label="Críticos" value={kpis.criticos} sub="equipos < 50% operativo" icon={XCircle} colorClass="text-red-400" bgClass="bg-red-500/10 border-red-500/30" />
                <KpiCard label="En Alerta" value={kpis.alertas} sub="equipos 50-75% operativo" icon={AlertTriangle} colorClass="text-orange-400" bgClass="bg-orange-500/10 border-orange-500/30" />
              </motion.div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Por tipo */}
                <Card className="lg:col-span-2 border-0 bg-slate-800/40 backdrop-blur">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-white flex items-center gap-2"><BarChart3 className="h-4 w-4 text-orange-400" /> Equipos por Tipo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={porTipo}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="tipo" tick={{ fontSize: 10, fill: '#94a3b8' }} angle={-20} textAnchor="end" height={55} />
                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }} />
                        <Legend wrapperStyle={{ fontSize: 11, color: '#cbd5e1' }} />
                        <Bar dataKey="funciona" name="Funciona" fill="#10b981" radius={[4,4,0,0]} stackId="a" />
                        <Bar dataKey="no_funciona" name="No Funciona" fill="#ef4444" radius={[4,4,0,0]} stackId="a" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Por estado (pie) */}
                <Card className="border-0 bg-slate-800/40 backdrop-blur">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-white">Estado General</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center">
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={porEstado} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                          label={({ name, percent }) => `${(percent*100).toFixed(0)}%`}
                          labelLine={false}>
                          {porEstado.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                        <Legend wrapperStyle={{ fontSize: 11, color: '#cbd5e1' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Por comuna */}
                <Card className="lg:col-span-3 border-0 bg-slate-800/40 backdrop-blur">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-white">Operatividad por Comuna</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {porComuna.map(c => {
                        const pct = c.total > 0 ? Math.round((c.funciona / c.total) * 100) : 0;
                        const color = pct < 50 ? 'bg-red-500' : pct < 75 ? 'bg-orange-500' : pct < 90 ? 'bg-blue-500' : 'bg-emerald-500';
                        return (
                          <div key={c.comuna} className="bg-slate-700/30 rounded-xl border border-slate-600/30 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-lg font-bold text-white">Comuna {c.comuna}</span>
                              <span className={`text-sm font-bold ${pct < 50 ? 'text-red-400' : pct < 75 ? 'text-orange-400' : 'text-emerald-400'}`}>{pct}%</span>
                            </div>
                            <div className="w-full bg-slate-600/50 rounded-full h-2.5">
                              <div className={`h-2.5 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs text-center">
                              <div><p className="text-slate-400">Total</p><p className="font-bold text-white">{c.total}</p></div>
                              <div><p className="text-slate-400">Funcionan</p><p className="font-bold text-emerald-400">{c.funciona}</p></div>
                              <div><p className="text-slate-400">Fallas</p><p className="font-bold text-red-400">{c.no_funciona}</p></div>
                            </div>
                            {c.criticos > 0 && (
                              <div className="flex items-center gap-1.5 text-xs text-red-300 bg-red-500/10 rounded-lg px-2 py-1.5">
                                <AlertTriangle className="h-3 w-3" /> {c.criticos} tipo(s) de equipo en estado crítico
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* ALERTAS TAB */}
          {activeTab === 'alertas' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">{escuelasCriticas.length} establecimientos con equipos críticos o en alerta</p>
              {escuelasCriticas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                  <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                  <p className="text-lg font-semibold text-white">Sin alertas activas</p>
                  <p className="text-sm text-slate-400">Todos los equipos están operando normalmente</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {escuelasCriticas.map((e, idx) => (
                    <motion.div key={idx} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}>
                      <Card className="border border-slate-700/50 bg-slate-800/40 hover:border-slate-600/60 transition-all">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-white leading-tight">{e.escuela}</p>
                              <p className="text-xs text-slate-400 mt-0.5">{e.jefe} · Comuna {e.comuna}</p>
                            </div>
                            <Badge className={`shrink-0 text-xs ${e.problemas.some(p => p.estado === 'critico') ? 'bg-red-500/20 text-red-300 border-red-500/40' : 'bg-orange-500/20 text-orange-300 border-orange-500/40'}`}>
                              {e.problemas.some(p => p.estado === 'critico') ? '🔴 Crítico' : '🟠 Alerta'}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {e.problemas.map((p, i) => (
                              <div key={i} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border ${
                                p.estado === 'critico' ? 'bg-red-500/10 border-red-500/30 text-red-300' : 'bg-orange-500/10 border-orange-500/30 text-orange-300'
                              }`}>
                                <span className="font-medium">{p.tipo}</span>
                                {p.no_funciona > 0 && <span className="opacity-75">· {p.no_funciona} sin funcionar</span>}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TABLA TAB */}
          {activeTab === 'tabla' && (
            <div className="space-y-4">
              {/* Filtros */}
              <div className="flex flex-wrap gap-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar escuela o jefe..." className="bg-slate-800 border-slate-700 text-white pl-8 h-9 w-56 text-sm" />
                </div>
                <Select value={filtroComuna} onValueChange={setFiltroComuna}>
                  <SelectTrigger className="w-36 h-9 bg-slate-800 border-slate-700 text-white text-sm">
                    <SelectValue placeholder="Comuna" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas las comunas</SelectItem>
                    <SelectItem value="8A">Comuna 8A</SelectItem>
                    <SelectItem value="8B">Comuna 8B</SelectItem>
                    <SelectItem value="10A">Comuna 10A</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                  <SelectTrigger className="w-36 h-9 bg-slate-800 border-slate-700 text-white text-sm">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los estados</SelectItem>
                    <SelectItem value="critico">Crítico</SelectItem>
                    <SelectItem value="alerta">Alerta</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="optimo">Óptimo</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                  <SelectTrigger className="w-44 h-9 bg-slate-800 border-slate-700 text-white text-sm">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los tipos</SelectItem>
                    {Object.entries(TIPO_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
                <span className="text-xs text-slate-500 self-center">{equiposFiltrados.length} registros</span>
              </div>
              <TablaEquipos equipos={equiposFiltrados} estadoConfig={ESTADO_CONFIG} tipoLabels={TIPO_LABELS} />
            </div>
          )}
        </>
      )}

      <ImportarCalefaccionModal open={showImport} onClose={() => setShowImport(false)} onSuccess={() => { setShowImport(false); refetch(); }} />
    </div>
  );
}