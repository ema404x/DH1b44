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
  BarChart3, Building2, Search, Download, RefreshCw, Zap, Droplets, Wind, Settings
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import ImportarCalefaccionModal from '@/components/calefaccion/ImportarCalefaccionModal';
import TablaEquipos from '@/components/calefaccion/TablaEquipos';
import EscuelaCard from '@/components/calefaccion/EscuelaCard';
import ProgressRing from '@/components/calefaccion/ProgressRing';

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

const CATEGORIAS = [
  { id: 'calefaccion', label: 'Calefacción', icon: Flame, iconBg: 'from-orange-500 to-red-600', tipos: ['estufas', 'radiadores', 'conductos', 'calderas', 'vrv', 'vrv_bajo_silueta', 'aire_acondicionado_calor'] },
  { id: 'electricidad', label: 'Electricidad', icon: Zap, iconBg: 'from-yellow-500 to-amber-600', tipos: [], emptyLabel: 'Sin datos de electricidad todavía.' },
  { id: 'plomeria', label: 'Plomería', icon: Droplets, iconBg: 'from-blue-500 to-cyan-600', tipos: [], emptyLabel: 'Sin datos de plomería todavía.' },
  { id: 'ventilacion', label: 'Ventilación', icon: Wind, iconBg: 'from-teal-500 to-emerald-600', tipos: ['aire_acondicionado_calor', 'conductos'] },
  { id: 'todos', label: 'Todos', icon: Settings, iconBg: 'from-slate-500 to-slate-600', tipos: null },
];

const PIE_ESTADO = [
  { key: 'critico', name: 'Crítico', color: '#ef4444' },
  { key: 'alerta',  name: 'Alerta',  color: '#f97316' },
  { key: 'normal',  name: 'Normal',  color: '#3b82f6' },
  { key: 'optimo',  name: 'Óptimo',  color: '#10b981' },
];

const RING_STATE_COLOR = { optimo: '#10b981', normal: '#3b82f6', alerta: '#f97316', critico: '#ef4444' };

export default function Calefaccion() {
  const [showImport, setShowImport]       = useState(false);
  const [categoriaId, setCategoriaId]     = useState('calefaccion');
  const [filtroComuna, setFiltroComuna]   = useState('todas');
  const [filtroEstado, setFiltroEstado]   = useState('todos');
  const [filtroTipo, setFiltroTipo]       = useState('todos');
  const [busqueda, setBusqueda]           = useState('');
  const [activeTab, setActiveTab]         = useState('dashboard');

  const categoria = CATEGORIAS.find(c => c.id === categoriaId) || CATEGORIAS[0];
  const CatIcon   = categoria.icon;

  const { data: equipos = [], isLoading, refetch } = useQuery({
    queryKey: ['calefaccion'],
    queryFn: () => base44.entities.EquipamientoCalefaccion.list('-created_date', 5000),
  });

  const equiposCategoria = useMemo(() => {
    if (categoria.tipos === null) return equipos;
    if (!categoria.tipos || categoria.tipos.length === 0) return [];
    return equipos.filter(e => categoria.tipos.includes(e.tipo_equipo));
  }, [equipos, categoria]);

  const equiposFiltrados = useMemo(() => {
    return equiposCategoria.filter(e => {
      if (filtroComuna !== 'todas' && e.comuna !== filtroComuna) return false;
      if (filtroEstado !== 'todos' && e.estado !== filtroEstado) return false;
      if (filtroTipo   !== 'todos' && e.tipo_equipo !== filtroTipo) return false;
      if (busqueda && !e.escuela?.toLowerCase().includes(busqueda.toLowerCase()) &&
          !e.jefe_sitio?.toLowerCase().includes(busqueda.toLowerCase())) return false;
      return true;
    });
  }, [equiposCategoria, filtroComuna, filtroEstado, filtroTipo, busqueda]);

  const kpis = useMemo(() => {
    const total      = equiposCategoria.reduce((s, e) => s + (e.cantidad_total || 0), 0);
    const funciona   = equiposCategoria.reduce((s, e) => s + (e.cantidad_funciona || 0), 0);
    const noFunciona = total - funciona;
    const escuelasSet = new Set(equiposCategoria.map(e => e.escuela));
    const escuelasCritico = new Set(equiposCategoria.filter(e => e.estado === 'critico').map(e => e.escuela));
    const escuelasAlerta  = new Set(equiposCategoria.filter(e => e.estado === 'alerta').map(e => e.escuela));
    const pct = total > 0 ? Math.round((funciona / total) * 100) : 0;
    return {
      total, funciona, noFunciona, pct,
      escuelas: escuelasSet.size,
      criticos: escuelasCritico.size,
      alertas:  escuelasAlerta.size,
      registrosCriticos: equiposCategoria.filter(e => e.estado === 'critico').length,
      registrosAlertas:  equiposCategoria.filter(e => e.estado === 'alerta').length,
    };
  }, [equiposCategoria]);

  const porEstado = useMemo(() => {
    const counts = {};
    equiposCategoria.forEach(e => { counts[e.estado] = (counts[e.estado] || 0) + (e.cantidad_total || 0); });
    return PIE_ESTADO.map(s => ({ ...s, value: counts[s.key] || 0 })).filter(d => d.value > 0);
  }, [equiposCategoria]);

  const porTipo = useMemo(() => {
    const map = {};
    equiposCategoria.forEach(e => {
      const k = e.tipo_equipo;
      if (!map[k]) map[k] = { tipo: TIPO_LABELS[k] || k, total: 0, funciona: 0, no_funciona: 0 };
      map[k].total += e.cantidad_total || 0;
      map[k].funciona += e.cantidad_funciona || 0;
      map[k].no_funciona += e.cantidad_no_funciona || 0;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [equiposCategoria]);

  const porComuna = useMemo(() => {
    const COMUNAS_VALIDAS = ['8A', '8B', '10A'];
    const map = {};
    equiposCategoria.forEach(e => {
      const k = COMUNAS_VALIDAS.includes(e.comuna) ? e.comuna : '8A';
      if (!map[k]) map[k] = { comuna: k, total: 0, funciona: 0, escuelas: new Set(), escuelasCriticas: new Set() };
      map[k].total    += e.cantidad_total || 0;
      map[k].funciona += e.cantidad_funciona || 0;
      map[k].escuelas.add(e.escuela);
      if (e.estado === 'critico') map[k].escuelasCriticas.add(e.escuela);
    });
    return Object.values(map).map(c => ({
      ...c,
      no_funciona: c.total - c.funciona,
      escuelas:    c.escuelas.size,
      criticos:    c.escuelasCriticas.size,
    })).sort((a, b) => a.comuna.localeCompare(b.comuna));
  }, [equiposCategoria]);

  // Grupos de escuelas para el dashboard card-centric
  const escuelasGrupo = useMemo(() => {
    const map = {};
    equiposFiltrados.forEach(e => {
      if (!map[e.escuela]) map[e.escuela] = { escuela: e.escuela, jefe_sitio: e.jefe_sitio, comuna: e.comuna, registros: [] };
      map[e.escuela].registros.push(e);
    });
    return Object.values(map);
  }, [equiposFiltrados]);

  const escuelasCriticas = useMemo(() => {
    const map = {};
    equiposCategoria.filter(e => e.estado === 'critico' || e.estado === 'alerta').forEach(e => {
      if (!map[e.escuela]) map[e.escuela] = { escuela: e.escuela, jefe: e.jefe_sitio, comuna: e.comuna, problemas: [] };
      map[e.escuela].problemas.push({ tipo: TIPO_LABELS[e.tipo_equipo] || e.tipo_equipo, no_funciona: e.cantidad_no_funciona, estado: e.estado });
    });
    return Object.values(map).sort((a, b) => b.problemas.length - a.problemas.length);
  }, [equiposCategoria]);

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
    const a = document.createElement('a'); a.href = url; a.download = `infraestructura-${categoriaId}.csv`; a.click();
  };

  const TABS = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'alertas',   label: `Alertas${kpis.criticos + kpis.alertas > 0 ? ` (${kpis.criticos + kpis.alertas})` : ''}` },
    { id: 'tabla',     label: 'Detalle' },
  ];

  const isEmpty = equiposCategoria.length === 0;

  return (
    <div className="min-h-screen bg-[#0d1117] p-4 md:p-6 space-y-4">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${categoria.iconBg} flex items-center justify-center shadow-lg`}>
            <CatIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Plan de Infraestructura</h1>
            <p className="text-xs text-slate-400">{kpis.escuelas} establecimientos · {equiposCategoria.length} registros</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="h-8 px-3 border-slate-700 bg-slate-800/60 text-slate-300 hover:bg-slate-700">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="h-8 px-3 border-slate-700 bg-slate-800/60 text-slate-300 hover:bg-slate-700 gap-1.5">
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button size="sm" onClick={() => setShowImport(true)} className="h-8 px-3 gap-1.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold">
            <Upload className="h-3.5 w-3.5" /> Importar Excel
          </Button>
        </div>
      </div>

      {/* ── Categorías ── */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIAS.map(cat => {
          const Icon   = cat.icon;
          const active = cat.id === categoriaId;
          return (
            <button
              key={cat.id}
              onClick={() => { setCategoriaId(cat.id); setActiveTab('dashboard'); setFiltroComuna('todas'); setFiltroEstado('todos'); setFiltroTipo('todos'); setBusqueda(''); }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm font-medium border transition-all ${
                active
                  ? `bg-gradient-to-r ${cat.iconBg} text-white border-transparent shadow`
                  : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:border-slate-600 hover:text-white'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-slate-800/50 rounded-xl p-1 w-fit border border-slate-700/40">
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

      {/* ── Filters (Detalle tab) ── */}
      {activeTab === 'tabla' && (
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar escuela o jefe..." className="bg-slate-800 border-slate-700 text-white pl-8 h-8 w-52 text-sm" />
          </div>
          <Select value={filtroComuna} onValueChange={setFiltroComuna}>
            <SelectTrigger className="w-36 h-8 bg-slate-800 border-slate-700 text-white text-sm"><SelectValue placeholder="Comuna" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las comunas</SelectItem>
              <SelectItem value="8A">Comuna 8A</SelectItem>
              <SelectItem value="8B">Comuna 8B</SelectItem>
              <SelectItem value="10A">Comuna 10A</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroEstado} onValueChange={setFiltroEstado}>
            <SelectTrigger className="w-32 h-8 bg-slate-800 border-slate-700 text-white text-sm"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="critico">Crítico</SelectItem>
              <SelectItem value="alerta">Alerta</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="optimo">Óptimo</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="w-40 h-8 bg-slate-800 border-slate-700 text-white text-sm"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los tipos</SelectItem>
              {Object.entries(TIPO_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-xs text-slate-500 self-center">{equiposFiltrados.length} registros</span>
        </div>
      )}

      {/* ── Dashboard filters (card view) ── */}
      {activeTab === 'dashboard' && !isEmpty && (
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar escuela..." className="bg-slate-800/60 border-slate-700 text-white pl-8 h-8 w-48 text-sm" />
          </div>
          <Select value={filtroComuna} onValueChange={setFiltroComuna}>
            <SelectTrigger className="w-36 h-8 bg-slate-800/60 border-slate-700 text-white text-sm"><SelectValue placeholder="Comuna" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las comunas</SelectItem>
              <SelectItem value="8A">Comuna 8A</SelectItem>
              <SelectItem value="8B">Comuna 8B</SelectItem>
              <SelectItem value="10A">Comuna 10A</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroEstado} onValueChange={setFiltroEstado}>
            <SelectTrigger className="w-32 h-8 bg-slate-800/60 border-slate-700 text-white text-sm"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="critico">Crítico</SelectItem>
              <SelectItem value="alerta">Alerta</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="optimo">Óptimo</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-slate-500 self-center">{escuelasGrupo.length} escuelas</span>
        </div>
      )}

      {/* ── Content ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
          <RefreshCw className="h-5 w-5 animate-spin" /> Cargando datos...
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="h-16 w-16 rounded-2xl bg-slate-800 flex items-center justify-center">
            <CatIcon className="h-8 w-8 text-slate-600" />
          </div>
          <div>
            <p className="text-lg font-semibold text-white">Sin datos de {categoria.label.toLowerCase()}</p>
            <p className="text-sm text-slate-400 mt-1">{categoria.emptyLabel || 'Importá el Excel de relevamiento para comenzar'}</p>
          </div>
          {(categoria.id === 'calefaccion' || categoria.id === 'todos') && (
            <Button onClick={() => setShowImport(true)} className="gap-2 bg-orange-500 hover:bg-orange-600 mt-2">
              <Upload className="h-4 w-4" /> Importar Excel
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* ═══════════════ DASHBOARD TAB ═══════════════ */}
          {activeTab === 'dashboard' && (
            <div className="space-y-5">
              {/* Cards grid por escuela */}
              {escuelasGrupo.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">Sin escuelas con los filtros seleccionados</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-4">
                  {escuelasGrupo.map((g) => (
                    <EscuelaCard
                      key={g.escuela}
                      escuela={g.escuela}
                      jefe_sitio={g.jefe_sitio}
                      comuna={g.comuna}
                      registros={g.registros}
                      tipoLabels={TIPO_LABELS}
                    />
                  ))}
                </div>
              )}

              {/* ── Tabla por tipo ── */}
              <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-700/50 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-orange-400" /> Unidades por Tipo de Equipo
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700/40">
                        <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Tipo</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Operativas</th>
                        <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Con fallas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {porTipo.map((t, i) => (
                        <tr key={i} className="border-b border-slate-700/20 hover:bg-slate-700/20 transition-colors">
                          <td className="px-5 py-2.5 text-white text-sm font-medium">{t.tipo}</td>
                          <td className="px-4 py-2.5 text-right">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="text-white font-bold text-sm">{Math.round(t.funciona).toLocaleString()}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">Operativas</span>
                            </span>
                          </td>
                          <td className="px-5 py-2.5 text-right">
                            {t.no_funciona > 0 ? (
                              <span className="inline-flex items-center gap-1.5">
                                <span className="text-red-400 font-bold text-sm">{Math.round(t.no_funciona).toLocaleString()}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30 font-medium">Con fallas</span>
                              </span>
                            ) : (
                              <span className="text-slate-500 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Distribución y por comuna ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Pie */}
                <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5">
                  <h3 className="text-sm font-bold text-white mb-1">Distribución por Estado</h3>
                  <p className="text-xs text-slate-400 mb-3">En unidades de equipo</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={porEstado} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                        label={({ percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {porEstado.map((entry) => <Cell key={entry.key} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(v, n) => [v.toLocaleString() + ' uds.', n]}
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11, color: '#cbd5e1' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Por comuna — progress rings */}
                <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5">
                  <h3 className="text-sm font-bold text-white mb-1">Operatividad por Comuna</h3>
                  <p className="text-xs text-slate-400 mb-4">Porcentaje calculado sobre unidades relevadas</p>
                  <div className="flex flex-wrap gap-4 justify-around">
                    {porComuna.map(c => {
                      const pct = c.total > 0 ? Math.round((c.funciona / c.total) * 100) : 0;
                      const color = pct < 50 ? '#ef4444' : pct < 75 ? '#f97316' : pct < 90 ? '#3b82f6' : '#10b981';
                      return (
                        <div key={c.comuna} className="flex flex-col items-center gap-2">
                          <ProgressRing pct={pct} size={80} stroke={7} color={color} />
                          <div className="text-center">
                            <p className="text-xs font-bold text-white">Comuna {c.comuna}</p>
                            <p className="text-[10px] text-slate-400">{c.escuelas} estab.</p>
                            {c.criticos > 0 && (
                              <p className="text-[10px] text-red-400">{c.criticos} crít.</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════ ALERTAS TAB ═══════════════ */}
          {activeTab === 'alertas' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">{escuelasCriticas.length} establecimientos con equipos críticos o en alerta</p>
              {escuelasCriticas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                  <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                  <p className="text-lg font-semibold text-white">Sin alertas activas</p>
                  <p className="text-sm text-slate-400">Todos los equipos de {categoria.label.toLowerCase()} están operando normalmente</p>
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
                              <p className="text-xs text-slate-400 mt-0.5">{e.jefe || 'Sin jefe asignado'} · {e.comuna ? `Comuna ${e.comuna}` : 'Comuna sin datos'}</p>
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

          {/* ═══════════════ TABLA TAB ═══════════════ */}
          {activeTab === 'tabla' && (
            <TablaEquipos equipos={equiposFiltrados} estadoConfig={ESTADO_CONFIG} tipoLabels={TIPO_LABELS} />
          )}
        </>
      )}

      <ImportarCalefaccionModal open={showImport} onClose={() => setShowImport(false)} onSuccess={() => { setShowImport(false); refetch(); }} />
    </div>
  );
}