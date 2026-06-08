import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search, Clock, Lock, Archive, CheckCircle2, AlertCircle, FileCheck,
  Download, Building2, TrendingUp, TrendingDown, BarChart3, Minus, AlertTriangle, Calendar
} from 'lucide-react';
import { exportarComunaPDF, exportarFiltradoPDF } from '@/components/certificacion/ExportarComunaPDF';

// ── Constantes ────────────────────────────────────────────────────────────────
const ESTADO = {
  listo_certificar:   { label: 'Listo',       fullLabel: 'Listo para Certificar',  color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400', barColor: 'bg-emerald-500' },
  faltan_actas:       { label: 'Faltan Actas', fullLabel: 'Faltan Cargar Actas',    color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',   dot: 'bg-yellow-400',  barColor: 'bg-yellow-500' },
  pendiente:          { label: 'Pendiente',    fullLabel: 'Pendiente',              color: 'bg-red-500/15 text-red-400 border-red-500/30',             dot: 'bg-red-400',     barColor: 'bg-red-500' },
  observado:          { label: 'Observado',    fullLabel: 'Observado',              color: 'bg-slate-500/15 text-slate-400 border-slate-500/30',       dot: 'bg-slate-400',   barColor: 'bg-slate-500' },
  falta_aprobar_mein: { label: 'Falta MEIN',  fullLabel: 'Falta Aprobar Orden MEIN', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30', dot: 'bg-purple-400',  barColor: 'bg-purple-500' },
};

const ORDEN = { listo_certificar: 0, faltan_actas: 1, pendiente: 2, observado: 3, falta_aprobar_mein: 4 };
const sortObras = (arr) => [...arr].sort((a, b) => (ORDEN[a.estado_cobro] ?? 9) - (ORDEN[b.estado_cobro] ?? 9));

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);
const fmtPct = (n) => `${(n || 0).toFixed(1)}%`;
const pctOf = (a, b) => b > 0 ? ((a / b) * 100) : 0;

// ── Helpers ───────────────────────────────────────────────────────────────────
function calcStats(obras) {
  const totalObras     = obras.length;
  const montoContrato  = obras.reduce((s, o) => s + (o.monto_contrato  || 0), 0);
  const montoCobrar    = obras.reduce((s, o) => s + (o.monto_a_cobrar  || 0), 0);
  const montoListo     = obras.filter(o => o.estado_cobro === 'listo_certificar').reduce((s, o) => s + (o.monto_a_cobrar || 0), 0);
  const cntListo       = obras.filter(o => o.estado_cobro === 'listo_certificar').length;
  const urgentes       = obras.filter(o => o.prioridad === 'urgente').length;
  const tasaCertif     = pctOf(cntListo, totalObras);
  const tasaMonto      = pctOf(montoListo, montoCobrar);
  const obrasConFecha  = obras.filter(o => o.fecha_fin_estimada);
  const vencidas       = obrasConFecha.filter(o => {
    const d = new Date(o.fecha_fin_estimada);
    return d < new Date() && o.estado_cobro !== 'listo_certificar';
  });
  return { totalObras, montoContrato, montoCobrar, montoListo, cntListo, urgentes, tasaCertif, tasaMonto, vencidas };
}

function DeltaBadge({ current, prev, isMoney }) {
  if (prev === undefined || prev === null) return null;
  const delta = current - prev;
  if (Math.abs(delta) < 1) return <span className="text-xs text-muted-foreground">—</span>;
  const up = delta > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  const cl = up ? 'text-emerald-400' : 'text-red-400';
  const label = isMoney ? fmt(Math.abs(delta)) : `${Math.abs(delta).toFixed(0)}`;
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${cl}`}>
      <Icon className="h-3 w-3" />{up ? '+' : '-'}{label}
    </span>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function CertificacionObrasPanel() {
  const [cicloVista, setCicloVista]     = useState('activo');
  const [search, setSearch]             = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroComuna, setFiltroComuna] = useState('todas');
  const [activeTab, setActiveTab]       = useState('resumen');

  const { data: todasObras = [], isLoading } = useQuery({
    queryKey: ['obras-certificacion'],
    queryFn: () => base44.entities.ObraCertificacion.list('-created_date', 1000),
  });

  const obrasActivas = useMemo(() => todasObras.filter(o => !o.ciclo_archivado), [todasObras]);

  const ciclosArchivados = useMemo(() => {
    const s = new Set(todasObras.filter(o => o.ciclo_archivado && o.ciclo).map(o => o.ciclo));
    return Array.from(s).sort().reverse();
  }, [todasObras]);

  const obras = useMemo(() =>
    cicloVista === 'activo' ? obrasActivas : todasObras.filter(o => o.ciclo === cicloVista && o.ciclo_archivado),
    [cicloVista, obrasActivas, todasObras]
  );

  // Stats del ciclo anterior para comparar
  const prevCicloObras = useMemo(() => {
    if (cicloVista !== 'activo' || ciclosArchivados.length === 0) return null;
    const prevCiclo = ciclosArchivados[0];
    return todasObras.filter(o => o.ciclo === prevCiclo && o.ciclo_archivado);
  }, [cicloVista, ciclosArchivados, todasObras]);

  const stats     = useMemo(() => calcStats(obras), [obras]);
  const prevStats = useMemo(() => prevCicloObras ? calcStats(prevCicloObras) : null, [prevCicloObras]);

  const esArchivado = cicloVista !== 'activo';
  const q = search.toLowerCase();

  const filtered = useMemo(() => {
    return obras.filter(o => {
      const matchS = !q ||
        o.titulo?.toLowerCase().includes(q) || o.establecimiento?.toLowerCase().includes(q) ||
        o.direccion?.toLowerCase().includes(q) || o.jefe_sitio?.toLowerCase().includes(q) ||
        o.inspector?.toLowerCase().includes(q) || o.oc_numero?.includes(search) || o.ada_numero?.includes(search);
      const matchE = filtroEstado === 'todos' ? true
        : filtroEstado === 'no_listo' ? o.estado_cobro !== 'listo_certificar'
        : o.estado_cobro === filtroEstado;
      const matchC = filtroComuna === 'todas' || o.comuna === filtroComuna;
      return matchS && matchE && matchC;
    });
  }, [obras, q, filtroEstado, filtroComuna, search]);

  const comunaStats = useMemo(() => ['8A','8B','10A'].map(c => {
    const oc      = obras.filter(o => o.comuna === c);
    if (!oc.length) return null;
    const contrato = oc.reduce((s, o) => s + (o.monto_contrato || 0), 0);
    const cobrar   = oc.reduce((s, o) => s + (o.monto_a_cobrar || 0), 0);
    const listo    = oc.filter(o => o.estado_cobro === 'listo_certificar').reduce((s, o) => s + (o.monto_a_cobrar || 0), 0);
    const cntListo = oc.filter(o => o.estado_cobro === 'listo_certificar').length;
    const byEstado = Object.keys(ESTADO).map(k => ({ k, cnt: oc.filter(o => o.estado_cobro === k).length }));
    return { comuna: c, contrato, cobrar, listo, cntListo, count: oc.length, pct: pctOf(listo, cobrar), byEstado };
  }).filter(Boolean), [obras]);

  // Evolución histórica (ciclos archivados, 6 últimos)
  const historico = useMemo(() => {
    return ciclosArchivados.slice(0, 6).reverse().map(ciclo => {
      const oc = todasObras.filter(o => o.ciclo === ciclo && o.ciclo_archivado);
      return {
        ciclo,
        total: oc.length,
        cobrar: oc.reduce((s, o) => s + (o.monto_a_cobrar || 0), 0),
        listo:  oc.filter(o => o.estado_cobro === 'listo_certificar').reduce((s, o) => s + (o.monto_a_cobrar || 0), 0),
        tasa:   pctOf(oc.filter(o => o.estado_cobro === 'listo_certificar').length, oc.length),
      };
    });
  }, [ciclosArchivados, todasObras]);

  const maxCobrar = useMemo(() => Math.max(...historico.map(h => h.cobrar), stats.montoCobrar, 1), [historico, stats]);

  return (
    <div className="space-y-5">

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 border border-border/60 rounded-xl bg-muted/20 px-4 py-2.5">
        <Select value={cicloVista} onValueChange={v => { setCicloVista(v); setFiltroEstado('todos'); setFiltroComuna('todas'); setSearch(''); }}>
          <SelectTrigger className="h-8 w-48 text-xs border-border/50 bg-background/50">
            {esArchivado ? <Lock className="h-3 w-3 text-muted-foreground mr-1.5 shrink-0" />
                         : <Clock className="h-3 w-3 text-primary mr-1.5 shrink-0" />}
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="activo">
              <span className="flex items-center gap-2 text-xs"><Clock className="h-3 w-3 text-primary" />Ciclo activo</span>
            </SelectItem>
            {ciclosArchivados.length > 0 && <>
              <div className="px-2 pt-2 pb-1 text-xs text-muted-foreground border-t border-border">Historial de ciclos</div>
              {ciclosArchivados.map(c => (
                <SelectItem key={c} value={c}>
                  <span className="flex items-center gap-2 text-xs"><Archive className="h-3 w-3 text-muted-foreground" />{c}</span>
                </SelectItem>
              ))}
            </>}
          </SelectContent>
        </Select>

        {esArchivado && (
          <Badge variant="outline" className="text-xs gap-1 text-muted-foreground border-dashed border-border/50">
            <Lock className="h-2.5 w-2.5" /> Solo lectura
          </Badge>
        )}

        {/* Alertas inline */}
        {stats.urgentes > 0 && (
          <Badge className="gap-1 bg-red-500/15 text-red-400 border border-red-500/30 text-xs">
            <AlertTriangle className="h-3 w-3" /> {stats.urgentes} urgente{stats.urgentes > 1 ? 's' : ''}
          </Badge>
        )}
        {stats.vencidas.length > 0 && (
          <Badge className="gap-1 bg-orange-500/15 text-orange-400 border border-orange-500/30 text-xs">
            <Calendar className="h-3 w-3" /> {stats.vencidas.length} vencida{stats.vencidas.length > 1 ? 's' : ''}
          </Badge>
        )}

        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          <span>{obras.length} obra{obras.length !== 1 ? 's' : ''}</span>
          <span className="w-px h-4 bg-border inline-block" />
          <span>A cobrar: <strong className="text-foreground">{fmt(stats.montoCobrar)}</strong></span>
          <span className="w-px h-4 bg-border inline-block" />
          <span className="text-emerald-400">Listo: <strong>{fmt(stats.montoListo)}</strong></span>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/30 border border-border/50 h-9">
          <TabsTrigger value="resumen" className="text-xs gap-1.5 data-[state=active]:bg-background">
            <BarChart3 className="h-3.5 w-3.5" /> Resumen ejecutivo
          </TabsTrigger>
          <TabsTrigger value="obras" className="text-xs gap-1.5 data-[state=active]:bg-background">
            <FileCheck className="h-3.5 w-3.5" /> Obras ({filtered.length})
          </TabsTrigger>
          {historico.length > 0 && (
            <TabsTrigger value="historico" className="text-xs gap-1.5 data-[state=active]:bg-background">
              <TrendingUp className="h-3.5 w-3.5" /> Evolución histórica
            </TabsTrigger>
          )}
        </TabsList>

        {/* ══ TAB: RESUMEN ══════════════════════════════════════════════════ */}
        <TabsContent value="resumen" className="mt-4 space-y-4">

          {/* KPIs principales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Total a cobrar */}
            <Card className="border-primary/20 bg-primary/5 col-span-2 md:col-span-1">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Monto Total a Cobrar</p>
                <p className="text-xl font-bold text-foreground">{fmt(stats.montoCobrar)}</p>
                {prevStats && <DeltaBadge current={stats.montoCobrar} prev={prevStats.montoCobrar} isMoney />}
              </CardContent>
            </Card>
            {/* Monto listo */}
            <Card className="border-emerald-500/20 bg-emerald-500/5">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Listo para Certificar</p>
                <p className="text-xl font-bold text-emerald-400">{fmt(stats.montoListo)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stats.cntListo} de {stats.totalObras} obras · {fmtPct(stats.tasaMonto)}</p>
              </CardContent>
            </Card>
            {/* Tasa certificación */}
            <Card className="border-border">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Tasa de Certificación</p>
                <p className="text-xl font-bold text-foreground">{fmtPct(stats.tasaCertif)}</p>
                <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${stats.tasaCertif}%` }} />
                </div>
              </CardContent>
            </Card>
            {/* Requieren atención */}
            <Card className="border-orange-500/20 bg-orange-500/5">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Requieren Atención</p>
                <p className="text-xl font-bold text-orange-400">
                  {stats.totalObras - stats.cntListo}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {stats.urgentes > 0 ? `${stats.urgentes} urgente${stats.urgentes > 1 ? 's' : ''}` : 'Sin urgencias'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Barra de distribución de estados */}
          <Card className="border-border/60">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Distribución por estado</span>
                <span className="text-xs text-muted-foreground">{obras.length} obras totales</span>
              </div>
              {/* Barra compuesta */}
              <div className="flex h-3 rounded-full overflow-hidden gap-px">
                {Object.entries(ESTADO).map(([key, cfg]) => {
                  const cnt = obras.filter(o => o.estado_cobro === key).length;
                  const pct = pctOf(cnt, obras.length);
                  if (pct < 1) return null;
                  return <div key={key} className={`${cfg.barColor} opacity-80`} style={{ width: `${pct}%` }} title={`${cfg.label}: ${cnt}`} />;
                })}
              </div>
              {/* Leyenda */}
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {Object.entries(ESTADO).map(([key, cfg]) => {
                  const cnt  = obras.filter(o => o.estado_cobro === key).length;
                  const monto = obras.filter(o => o.estado_cobro === key).reduce((s, o) => s + (o.monto_a_cobrar || 0), 0);
                  if (!cnt) return null;
                  return (
                    <button key={key} onClick={() => { setFiltroEstado(filtroEstado === key ? 'todos' : key); setActiveTab('obras'); }}
                      className="flex items-center gap-1.5 group">
                      <div className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                      <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                        {cfg.label} <strong className="text-foreground">{cnt}</strong>
                        <span className="text-muted-foreground/60 ml-1">({fmt(monto)})</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Por Comuna */}
          {comunaStats.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {comunaStats.map(({ comuna, contrato, cobrar, listo, cntListo, count, pct, byEstado }) => (
                <Card key={comuna} className="border-border/60 overflow-hidden">
                  <CardHeader className="px-4 pt-4 pb-2 flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <CardTitle className="text-sm font-semibold">Comuna {comuna}</CardTitle>
                      <span className="text-xs text-muted-foreground">· {count}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1 text-muted-foreground hover:text-primary"
                      onClick={() => exportarComunaPDF(comuna, sortObras(obras.filter(o => o.comuna === comuna)))}>
                      <Download className="h-3 w-3" />
                    </Button>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-muted-foreground">A cobrar</div>
                        <div className="font-bold text-foreground mt-0.5">{fmt(cobrar)}</div>
                      </div>
                      <div>
                        <div className="text-emerald-400">Listo ({cntListo})</div>
                        <div className="font-bold text-emerald-400 mt-0.5">{fmt(listo)}</div>
                      </div>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                    {/* mini distribución de estados */}
                    <div className="flex gap-1.5 flex-wrap">
                      {byEstado.filter(e => e.cnt > 0).map(({ k, cnt }) => (
                        <span key={k} className={`text-xs px-1.5 py-0 rounded border ${ESTADO[k]?.color}`}>{ESTADO[k]?.label} {cnt}</span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Obras vencidas */}
          {stats.vencidas.length > 0 && (
            <Card className="border-orange-500/20 bg-orange-500/5">
              <CardHeader className="pb-2 px-4 pt-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-400" />
                  <CardTitle className="text-sm text-orange-300">Obras con fecha vencida pendientes de cobro</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-1.5">
                {stats.vencidas.slice(0, 5).map(o => (
                  <div key={o.id} className="flex items-center justify-between text-xs py-1.5 border-b border-orange-500/10 last:border-0">
                    <div className="flex items-center gap-2">
                      <div className={`h-1.5 w-1.5 rounded-full ${ESTADO[o.estado_cobro]?.dot || 'bg-orange-400'}`} />
                      <span className="text-foreground/80 truncate max-w-xs">{o.titulo}</span>
                      {o.comuna && <Badge className="text-xs px-1 py-0 bg-muted text-muted-foreground border-border">C.{o.comuna}</Badge>}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-muted-foreground">{new Date(o.fecha_fin_estimada).toLocaleDateString('es-AR')}</span>
                      <span className="font-semibold text-orange-300">{fmt(o.monto_a_cobrar)}</span>
                    </div>
                  </div>
                ))}
                {stats.vencidas.length > 5 && (
                  <p className="text-xs text-muted-foreground pt-1">+{stats.vencidas.length - 5} más</p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ══ TAB: OBRAS ════════════════════════════════════════════════════ */}
        <TabsContent value="obras" className="mt-4 space-y-3">
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Buscar obra, jefe, dirección, OC, MEIN..." value={search}
                onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
            </div>
            <Select value={filtroComuna} onValueChange={setFiltroComuna}>
              <SelectTrigger className="h-9 text-sm w-full sm:w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {['8A','8B','10A'].map(c => <SelectItem key={c} value={c}>Comuna {c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger className="h-9 text-sm w-full sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                <SelectItem value="no_listo">⚠️ No listo</SelectItem>
                {Object.entries(ESTADO).map(([k, v]) => <SelectItem key={k} value={k}>{v.fullLabel}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="gap-1.5 shrink-0 h-9" disabled={filtered.length === 0}
              onClick={() => exportarFiltradoPDF(sortObras(filtered), { comuna: filtroComuna, estado: filtroEstado, search })}>
              <Download className="h-3.5 w-3.5" /> PDF ({filtered.length})
            </Button>
          </div>

          {/* Tabla de obras */}
          {isLoading ? (
            <div className="flex justify-center py-16">
              <div className="h-7 w-7 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <FileCheck className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Sin resultados para los filtros aplicados.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 overflow-hidden">
              {/* Cabecera */}
              <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-0 bg-muted/40 border-b border-border/60 text-xs font-semibold text-muted-foreground">
                <div className="px-4 py-2.5">Obra / Establecimiento</div>
                <div className="px-3 py-2.5 text-right">Contrato</div>
                <div className="px-3 py-2.5 text-right">A Cobrar</div>
                <div className="px-3 py-2.5 text-center">Avance</div>
                <div className="px-3 py-2.5">Estado</div>
                <div className="px-3 py-2.5">JS / Inspector</div>
              </div>
              {/* Filas */}
              {sortObras(filtered).map((obra, idx) => {
                const cfg = ESTADO[obra.estado_cobro] || ESTADO.pendiente;
                const isVencida = obra.fecha_fin_estimada && new Date(obra.fecha_fin_estimada) < new Date() && obra.estado_cobro !== 'listo_certificar';
                return (
                  <div key={obra.id}
                    className={`flex flex-col md:grid md:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] items-start md:items-center gap-2 md:gap-0 px-4 md:px-0 py-3 md:py-0 border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors ${idx % 2 === 0 ? '' : 'bg-muted/10'}`}>
                    {/* Obra */}
                    <div className="md:px-4 md:py-3 flex items-start gap-2 min-w-0">
                      <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${cfg.dot}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-medium text-foreground truncate">{obra.titulo}</span>
                          {obra.prioridad === 'urgente' && <Badge className="text-xs bg-red-500/15 text-red-400 border-red-500/30 px-1 py-0">Urgente</Badge>}
                          {isVencida && <Badge className="text-xs bg-orange-500/15 text-orange-400 border-orange-500/30 px-1 py-0">Vencida</Badge>}
                        </div>
                        <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground mt-0.5">
                          {obra.establecimiento && <span>{obra.establecimiento}</span>}
                          {obra.comuna && <span>C.{obra.comuna}</span>}
                          {obra.oc_numero && <span className="font-mono">OC:{obra.oc_numero}</span>}
                          {obra.ada_numero && <span className="font-mono">MEIN:{obra.ada_numero}</span>}
                        </div>
                      </div>
                    </div>
                    {/* Contrato */}
                    <div className="md:px-3 md:py-3 text-xs text-right">
                      <span className="md:hidden text-muted-foreground mr-1">Contrato:</span>
                      <span className="text-foreground/80">{obra.monto_contrato ? fmt(obra.monto_contrato) : <span className="text-muted-foreground">—</span>}</span>
                    </div>
                    {/* A Cobrar */}
                    <div className="md:px-3 md:py-3 text-right">
                      <span className="md:hidden text-xs text-muted-foreground mr-1">A Cobrar:</span>
                      <span className="text-sm font-bold text-primary">{fmt(obra.monto_a_cobrar)}</span>
                    </div>
                    {/* Avance */}
                    <div className="md:px-3 md:py-3 text-center">
                      {obra.porcentaje_avance > 0 ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs font-semibold text-foreground">{obra.porcentaje_avance}%</span>
                          <div className="w-14 h-1 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${obra.porcentaje_avance}%` }} />
                          </div>
                        </div>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                    {/* Estado */}
                    <div className="md:px-3 md:py-3">
                      <Badge className={`text-xs border px-1.5 py-0 ${cfg.color}`}>{cfg.label}</Badge>
                      {obra.motivo_observacion && (
                        <p className="text-xs text-muted-foreground mt-0.5 max-w-xs truncate" title={obra.motivo_observacion}>{obra.motivo_observacion}</p>
                      )}
                    </div>
                    {/* JS / Inspector */}
                    <div className="md:px-3 md:py-3 text-xs text-muted-foreground">
                      {obra.jefe_sitio && <div className="truncate">{obra.jefe_sitio}</div>}
                      {obra.inspector  && <div className="truncate text-muted-foreground/60">{obra.inspector}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ══ TAB: HISTÓRICO ════════════════════════════════════════════════ */}
        {historico.length > 0 && (
          <TabsContent value="historico" className="mt-4 space-y-4">
            <Card className="border-border/60">
              <CardHeader className="pb-3 px-5 pt-5">
                <CardTitle className="text-sm font-semibold">Evolución por ciclo — Monto a cobrar</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Últimos {historico.length} ciclos archivados</p>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-3">
                {historico.map((h, i) => (
                  <div key={h.ciclo} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <button onClick={() => setCicloVista(h.ciclo)}
                        className="text-foreground/80 hover:text-primary transition-colors font-medium">{h.ciclo}</button>
                      <div className="flex items-center gap-4 text-muted-foreground">
                        <span>{h.total} obras</span>
                        <span className="text-emerald-400">{fmtPct(h.tasa)} certif.</span>
                        <span className="font-semibold text-foreground">{fmt(h.cobrar)}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 h-5 rounded overflow-hidden">
                      <div className="bg-emerald-500/70 rounded-l flex items-center justify-center text-xs text-emerald-100 font-medium px-1"
                        style={{ width: `${pctOf(h.listo, h.cobrar)}%`, minWidth: h.listo > 0 ? '2%' : '0' }}>
                        {pctOf(h.listo, h.cobrar) > 15 ? fmt(h.listo) : ''}
                      </div>
                      <div className="bg-muted/60 rounded-r flex-1 flex items-center justify-center text-xs text-muted-foreground px-1">
                        {pctOf(h.cobrar - h.listo, h.cobrar) > 15 ? fmt(h.cobrar - h.listo) : ''}
                      </div>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border/40">
                  <div className="flex items-center gap-1.5"><div className="h-2 w-3 bg-emerald-500/70 rounded" /> Listo certificar</div>
                  <div className="flex items-center gap-1.5"><div className="h-2 w-3 bg-muted/60 rounded" /> Pendiente cobro</div>
                </div>
              </CardContent>
            </Card>

            {/* Tabla comparativa */}
            <Card className="border-border/60">
              <CardHeader className="pb-2 px-5 pt-4">
                <CardTitle className="text-sm font-semibold">Comparativa por ciclo</CardTitle>
              </CardHeader>
              <CardContent className="px-0 pb-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/50 bg-muted/30">
                        <th className="text-left px-5 py-2 font-semibold text-muted-foreground">Ciclo</th>
                        <th className="text-right px-4 py-2 font-semibold text-muted-foreground">Obras</th>
                        <th className="text-right px-4 py-2 font-semibold text-muted-foreground">Monto a Cobrar</th>
                        <th className="text-right px-4 py-2 font-semibold text-muted-foreground">Certificado</th>
                        <th className="text-right px-4 py-2 font-semibold text-muted-foreground">Tasa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...historico].reverse().map((h, i) => (
                        <tr key={h.ciclo} className={`border-b border-border/30 hover:bg-muted/20 ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                          <td className="px-5 py-2.5">
                            <button onClick={() => setCicloVista(h.ciclo)} className="text-primary hover:underline font-medium">{h.ciclo}</button>
                          </td>
                          <td className="px-4 py-2.5 text-right text-foreground/80">{h.total}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-foreground">{fmt(h.cobrar)}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-emerald-400">{fmt(h.listo)}</td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={`font-bold ${h.tasa >= 70 ? 'text-emerald-400' : h.tasa >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                              {fmtPct(h.tasa)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}