import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  Search, Clock, Lock, Archive, CheckCircle2, AlertCircle, TrendingUp, FileCheck, Download
} from 'lucide-react';
import { exportarComunaPDF, exportarFiltradoPDF } from '@/components/certificacion/ExportarComunaPDF';

const ESTADO_CONFIG = {
  listo_certificar:   { label: 'Listo para Certificar',    color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  faltan_actas:       { label: 'Faltan Actas',              color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  pendiente:          { label: 'Pendiente',                 color: 'bg-red-500/15 text-red-400 border-red-500/30' },
  observado:          { label: 'Observado',                 color: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
  falta_aprobar_mein: { label: 'Falta Aprobar MEIN',        color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
};

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

export default function CertificacionObrasPanel() {
  const [cicloVista, setCicloVista] = useState('activo');
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroComuna, setFiltroComuna] = useState('todas');

  const { data: todasObras = [], isLoading } = useQuery({
    queryKey: ['obras-certificacion'],
    queryFn: () => base44.entities.ObraCertificacion.list('-created_date', 1000),
  });

  const obrasActivas = useMemo(() => todasObras.filter(o => !o.ciclo_archivado), [todasObras]);

  const ciclosArchivados = useMemo(() => {
    const set = new Set(todasObras.filter(o => o.ciclo_archivado && o.ciclo).map(o => o.ciclo));
    return Array.from(set).sort().reverse();
  }, [todasObras]);

  const obras = useMemo(() => {
    if (cicloVista === 'activo') return obrasActivas;
    return todasObras.filter(o => o.ciclo === cicloVista && o.ciclo_archivado);
  }, [cicloVista, obrasActivas, todasObras]);

  const esArchivado = cicloVista !== 'activo';

  const filtered = obras.filter(o => {
    const matchSearch = !search ||
      o.titulo?.toLowerCase().includes(search.toLowerCase()) ||
      o.establecimiento?.toLowerCase().includes(search.toLowerCase()) ||
      o.jefe_sitio?.toLowerCase().includes(search.toLowerCase()) ||
      o.oc_numero?.includes(search) ||
      o.ada_numero?.includes(search);
    const matchEstado = filtroEstado === 'todos' ? true
      : filtroEstado === 'no_listo' ? o.estado_cobro !== 'listo_certificar'
      : o.estado_cobro === filtroEstado;
    const matchComuna = filtroComuna === 'todas' || o.comuna === filtroComuna;
    return matchSearch && matchEstado && matchComuna;
  });

  // KPIs
  const totalMonto       = obras.reduce((s, o) => s + (o.monto_a_cobrar || 0), 0);
  const listoCertificar  = obras.filter(o => o.estado_cobro === 'listo_certificar').length;
  const faltanActas      = obras.filter(o => o.estado_cobro === 'faltan_actas').length;
  const pendientes       = obras.filter(o => o.estado_cobro === 'pendiente').length;
  const observados       = obras.filter(o => o.estado_cobro === 'observado').length;
  const faltaAprobarMein = obras.filter(o => o.estado_cobro === 'falta_aprobar_mein').length;

  const comunas = ['8A', '8B', '10A'];
  const resumenPorComuna = comunas.map(c => {
    const obrasComuna  = obras.filter(o => o.comuna === c);
    const montoTotal   = obrasComuna.reduce((s, o) => s + (o.monto_a_cobrar || 0), 0);
    const montoParcial = obrasComuna.filter(o => o.estado_cobro === 'listo_certificar').reduce((s, o) => s + (o.monto_a_cobrar || 0), 0);
    const cantListo    = obrasComuna.filter(o => o.estado_cobro === 'listo_certificar').length;
    return { comuna: c, montoTotal, montoParcial, cantListo, total: obrasComuna.length };
  }).filter(r => r.total > 0);

  return (
    <div className="space-y-6">
      {/* Selector ciclo */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={cicloVista} onValueChange={setCicloVista}>
          <SelectTrigger className="h-9 w-48 text-sm">
            {esArchivado
              ? <Lock className="h-3.5 w-3.5 text-muted-foreground mr-2 shrink-0" />
              : <Clock className="h-3.5 w-3.5 text-primary mr-2 shrink-0" />}
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="activo">
              <span className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-primary" />Ciclo activo</span>
            </SelectItem>
            {ciclosArchivados.length > 0 && (
              <>
                <div className="px-2 py-1 text-xs text-muted-foreground border-t border-border mt-1 pt-2">Ciclos archivados</div>
                {ciclosArchivados.map(c => (
                  <SelectItem key={c} value={c}>
                    <span className="flex items-center gap-2"><Archive className="h-3.5 w-3.5 text-muted-foreground" />{c}</span>
                  </SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>
        {esArchivado && (
          <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
            <Lock className="h-3 w-3" /> Solo lectura
          </Badge>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          Total a cobrar: <strong className="text-foreground">{fmt(totalMonto)}</strong>
        </span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Listo Certificar', val: listoCertificar, color: 'emerald', Icon: CheckCircle2 },
          { label: 'Faltan Actas',     val: faltanActas,     color: 'yellow',  Icon: Clock },
          { label: 'Pendiente',        val: pendientes,      color: 'red',     Icon: AlertCircle },
          { label: 'Observados',       val: observados,      color: 'slate',   Icon: TrendingUp },
          { label: 'Falta MEIN',       val: faltaAprobarMein,color: 'purple',  Icon: FileCheck },
        ].map(({ label, val, color, Icon }) => (
          <Card key={label} className={`border-${color}-500/20 bg-${color}-500/5`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`h-4 w-4 text-${color}-400`} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <p className={`text-2xl font-bold text-${color}-400`}>{val}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Resumen por comuna */}
      {resumenPorComuna.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {resumenPorComuna.map(({ comuna, montoTotal, montoParcial, cantListo, total }) => (
            <Card key={comuna} className="border-border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Comuna {comuna}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{total} obra{total !== 1 ? 's' : ''}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary"
                      title={`PDF Comuna ${comuna}`}
                      onClick={() => exportarComunaPDF(comuna, obras.filter(o => o.comuna === comuna).sort((a, b) => {
                        const order = { listo_certificar: 0, faltan_actas: 1, pendiente: 2, observado: 3 };
                        return (order[a.estado_cobro] ?? 9) - (order[b.estado_cobro] ?? 9);
                      }))}>
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Monto total</span>
                    <span className="text-sm font-bold">{fmt(montoTotal)}</span>
                  </div>
                  <div className="w-full h-px bg-border" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Listo ({cantListo})
                    </span>
                    <span className="text-sm font-bold text-emerald-400">{fmt(montoParcial)}</span>
                  </div>
                  {montoTotal > 0 && (
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (montoParcial / montoTotal) * 100)}%` }} />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar obra, jefe, N° OC/ADA..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filtroComuna} onValueChange={setFiltroComuna}>
          <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Comuna" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las comunas</SelectItem>
            <SelectItem value="8A">8A</SelectItem>
            <SelectItem value="8B">8B</SelectItem>
            <SelectItem value="10A">10A</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            <SelectItem value="no_listo">⚠️ No listo</SelectItem>
            <SelectItem value="listo_certificar">Listo para Certificar</SelectItem>
            <SelectItem value="faltan_actas">Faltan Actas</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="observado">Observado</SelectItem>
            <SelectItem value="falta_aprobar_mein">Falta Aprobar MEIN</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" className="gap-2 shrink-0" disabled={filtered.length === 0}
          onClick={() => exportarFiltradoPDF(
            filtered.sort((a, b) => {
              const order = { listo_certificar: 0, faltan_actas: 1, pendiente: 2, observado: 3, falta_aprobar_mein: 4 };
              return (order[a.estado_cobro] ?? 9) - (order[b.estado_cobro] ?? 9);
            }),
            { comuna: filtroComuna, estado: filtroEstado, search }
          )}>
          <Download className="h-4 w-4" /> PDF ({filtered.length})
        </Button>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileCheck className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No hay obras{search || filtroEstado !== 'todos' ? ' con esos filtros' : ''}.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(obra => {
            const estadoCfg = ESTADO_CONFIG[obra.estado_cobro] || ESTADO_CONFIG.pendiente;
            return (
              <Card key={obra.id} className="border-border hover:border-primary/20 transition-all">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-sm text-foreground truncate">{obra.titulo}</span>
                        <Badge className={`text-xs border shrink-0 ${estadoCfg.color}`}>{estadoCfg.label}</Badge>
                        {obra.prioridad === 'urgente' && <Badge className="text-xs bg-red-500/15 text-red-400 border-red-500/30">Urgente</Badge>}
                        {obra.prioridad === 'alta'    && <Badge className="text-xs bg-orange-500/15 text-orange-400 border-orange-500/30">Alta</Badge>}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        {obra.establecimiento && <span>{obra.establecimiento}</span>}
                        {obra.jefe_sitio     && <span>JS: {obra.jefe_sitio}</span>}
                        {obra.comuna         && <span>Comuna {obra.comuna}</span>}
                        {obra.oc_numero      && <span>OC: {obra.oc_numero}</span>}
                        {obra.ada_numero     && <span>MEIN: {obra.ada_numero}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-primary">{fmt(obra.monto_a_cobrar)}</div>
                      {obra.porcentaje_avance > 0 && (
                        <div className="text-xs text-muted-foreground">{obra.porcentaje_avance}% avance</div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}