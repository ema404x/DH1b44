import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, Clock, Lock, Archive, CheckCircle2, AlertCircle, FileCheck, Download, Building2 } from 'lucide-react';
import { exportarComunaPDF, exportarFiltradoPDF } from '@/components/certificacion/ExportarComunaPDF';

const ESTADO = {
  listo_certificar:   { label: 'Listo',         color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400' },
  faltan_actas:       { label: 'Faltan Actas',   color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',   dot: 'bg-yellow-400' },
  pendiente:          { label: 'Pendiente',      color: 'bg-red-500/15 text-red-400 border-red-500/30',             dot: 'bg-red-400' },
  observado:          { label: 'Observado',      color: 'bg-slate-500/15 text-slate-400 border-slate-500/30',       dot: 'bg-slate-400' },
  falta_aprobar_mein: { label: 'Falta MEIN',     color: 'bg-purple-500/15 text-purple-400 border-purple-500/30',   dot: 'bg-purple-400' },
};

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

const ORDEN_ESTADO = { listo_certificar: 0, faltan_actas: 1, pendiente: 2, observado: 3, falta_aprobar_mein: 4 };
const sortObras = (arr) => [...arr].sort((a, b) => (ORDEN_ESTADO[a.estado_cobro] ?? 9) - (ORDEN_ESTADO[b.estado_cobro] ?? 9));

export default function CertificacionObrasPanel() {
  const [cicloVista, setCicloVista] = useState('activo');
  const [search, setSearch]         = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroComuna, setFiltroComuna] = useState('todas');

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

  const esArchivado = cicloVista !== 'activo';
  const q = search.toLowerCase();

  const filtered = useMemo(() => obras.filter(o => {
    const matchS = !q ||
      o.titulo?.toLowerCase().includes(q) || o.establecimiento?.toLowerCase().includes(q) ||
      o.jefe_sitio?.toLowerCase().includes(q) || o.oc_numero?.includes(search) || o.ada_numero?.includes(search);
    const matchE = filtroEstado === 'todos' ? true
      : filtroEstado === 'no_listo' ? o.estado_cobro !== 'listo_certificar'
      : o.estado_cobro === filtroEstado;
    const matchC = filtroComuna === 'todas' || o.comuna === filtroComuna;
    return matchS && matchE && matchC;
  }), [obras, q, filtroEstado, filtroComuna, search]);

  // Totales
  const totalMonto      = obras.reduce((s, o) => s + (o.monto_a_cobrar || 0), 0);
  const montoListo      = obras.filter(o => o.estado_cobro === 'listo_certificar').reduce((s, o) => s + (o.monto_a_cobrar || 0), 0);
  const cntByEstado     = Object.keys(ESTADO).reduce((acc, k) => { acc[k] = obras.filter(o => o.estado_cobro === k).length; return acc; }, {});

  const comunaStats = ['8A','8B','10A'].map(c => {
    const oc = obras.filter(o => o.comuna === c);
    if (!oc.length) return null;
    const total  = oc.reduce((s, o) => s + (o.monto_a_cobrar || 0), 0);
    const listo  = oc.filter(o => o.estado_cobro === 'listo_certificar').reduce((s, o) => s + (o.monto_a_cobrar || 0), 0);
    const pct    = total > 0 ? Math.min(100, (listo / total) * 100) : 0;
    return { comuna: c, total, listo, pct, count: oc.length, cntListo: oc.filter(o => o.estado_cobro === 'listo_certificar').length };
  }).filter(Boolean);

  return (
    <div className="space-y-5">

      {/* Header bar */}
      <div className="flex flex-wrap items-center gap-3 bg-muted/30 border border-border rounded-xl px-4 py-3">
        <Select value={cicloVista} onValueChange={setCicloVista}>
          <SelectTrigger className="h-8 w-44 text-xs border-0 bg-transparent shadow-none focus:ring-0">
            {esArchivado
              ? <Lock className="h-3 w-3 text-muted-foreground mr-1.5 shrink-0" />
              : <Clock className="h-3 w-3 text-primary mr-1.5 shrink-0" />}
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="activo">
              <span className="flex items-center gap-2 text-xs"><Clock className="h-3 w-3 text-primary" />Ciclo activo</span>
            </SelectItem>
            {ciclosArchivados.length > 0 && <>
              <div className="px-2 pt-2 pb-1 text-xs text-muted-foreground border-t border-border">Historial</div>
              {ciclosArchivados.map(c => (
                <SelectItem key={c} value={c}>
                  <span className="flex items-center gap-2 text-xs"><Archive className="h-3 w-3 text-muted-foreground" />{c}</span>
                </SelectItem>
              ))}
            </>}
          </SelectContent>
        </Select>

        {esArchivado && (
          <Badge variant="outline" className="text-xs gap-1 text-muted-foreground border-dashed">
            <Lock className="h-2.5 w-2.5" /> Solo lectura
          </Badge>
        )}

        <div className="ml-auto flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Total</span>
            <span className="font-bold text-foreground">{fmt(totalMonto)}</span>
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-muted-foreground">Listo</span>
            <span className="font-bold text-emerald-400">{fmt(montoListo)}</span>
          </div>
          <div className="w-px h-4 bg-border" />
          <span className="text-muted-foreground">{obras.length} obras</span>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-5 gap-2">
        {Object.entries(ESTADO).map(([key, cfg]) => (
          <button key={key}
            onClick={() => setFiltroEstado(filtroEstado === key ? 'todos' : key)}
            className={`rounded-xl border p-3 text-left transition-all hover:opacity-100 ${
              filtroEstado === key ? `${cfg.color} opacity-100` : 'border-border bg-card opacity-70 hover:border-primary/30'
            }`}>
            <div className={`text-xl font-bold ${filtroEstado === key ? '' : 'text-foreground'}`}>{cntByEstado[key] || 0}</div>
            <div className="text-xs text-muted-foreground mt-0.5 leading-tight">{cfg.label}</div>
          </button>
        ))}
      </div>

      {/* Comunas */}
      {comunaStats.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {comunaStats.map(({ comuna, total, listo, pct, count, cntListo }) => (
            <Card key={comuna} className="border-border bg-card/60 overflow-hidden">
              <CardContent className="p-0">
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-semibold">Comuna {comuna}</span>
                      <span className="text-xs text-muted-foreground">· {count} obras</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary"
                      onClick={() => exportarComunaPDF(comuna, sortObras(obras.filter(o => o.comuna === comuna)))}>
                      <Download className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-end justify-between mb-2">
                    <div>
                      <div className="text-xs text-muted-foreground">Total</div>
                      <div className="text-base font-bold">{fmt(total)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-emerald-400">Listo ({cntListo})</div>
                      <div className="text-base font-bold text-emerald-400">{fmt(listo)}</div>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-right text-xs text-muted-foreground mt-1">{Math.round(pct)}% listo</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Buscar obra, jefe, OC, MEIN..." value={search}
            onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <Select value={filtroComuna} onValueChange={setFiltroComuna}>
          <SelectTrigger className="h-9 text-sm w-full sm:w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            {['8A','8B','10A'].map(c => <SelectItem key={c} value={c}>Comuna {c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="gap-1.5 shrink-0 h-9" disabled={filtered.length === 0}
          onClick={() => exportarFiltradoPDF(sortObras(filtered), { comuna: filtroComuna, estado: filtroEstado, search })}>
          <Download className="h-3.5 w-3.5" /> PDF ({filtered.length})
        </Button>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="h-7 w-7 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileCheck className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Sin resultados{search || filtroEstado !== 'todos' || filtroComuna !== 'todas' ? ' para los filtros aplicados' : ''}.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {sortObras(filtered).map(obra => {
            const cfg = ESTADO[obra.estado_cobro] || ESTADO.pendiente;
            return (
              <div key={obra.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card/50 hover:bg-card hover:border-primary/20 transition-all">
                {/* Estado dot */}
                <div className={`h-2 w-2 rounded-full shrink-0 ${cfg.dot}`} />

                {/* Info */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground truncate">{obra.titulo}</span>
                    <Badge className={`text-xs border px-1.5 py-0 shrink-0 ${cfg.color}`}>{cfg.label}</Badge>
                    {obra.prioridad === 'urgente' && <Badge className="text-xs bg-red-500/15 text-red-400 border-red-500/30 px-1.5 py-0">Urgente</Badge>}
                    {obra.prioridad === 'alta'    && <Badge className="text-xs bg-orange-500/15 text-orange-400 border-orange-500/30 px-1.5 py-0">Alta</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    {obra.establecimiento && <span>{obra.establecimiento}</span>}
                    {obra.jefe_sitio      && <span>JS: {obra.jefe_sitio}</span>}
                    {obra.comuna          && <span>C.{obra.comuna}</span>}
                    {obra.oc_numero       && <span>OC: {obra.oc_numero}</span>}
                    {obra.ada_numero      && <span>MEIN: {obra.ada_numero}</span>}
                  </div>
                </div>

                {/* Monto */}
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-primary">{fmt(obra.monto_a_cobrar)}</div>
                  {obra.porcentaje_avance > 0 && (
                    <div className="text-xs text-muted-foreground">{obra.porcentaje_avance}% avance</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}