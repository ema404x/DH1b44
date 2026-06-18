import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, RefreshCw, Play, AlertTriangle, Wrench } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';
import { toast } from 'sonner';
import OrdenDetalleModal from './OrdenDetalleModal';

const ESTADO_CFG = {
  pendiente:     { label: 'Pendiente',     cls: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  en_proceso:    { label: 'En Proceso',    cls: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  ejecutada:     { label: 'Ejecutada',     cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  vencida:       { label: 'Vencida',       cls: 'bg-red-500/20 text-red-300 border-red-500/30' },
  derivada_tom:  { label: 'Derivada TOM',  cls: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
};

function Semaforo({ fechaLimite, estado }) {
  if (estado === 'ejecutada' || estado === 'derivada_tom') return null;
  const hoy = new Date();
  const limite = parseISO(fechaLimite);
  const dias = differenceInDays(limite, hoy);
  if (estado === 'vencida' || dias < 0) return <span className="w-3 h-3 rounded-full bg-red-500 inline-block" title="Vencida" />;
  if (dias <= 3) return <span className="w-3 h-3 rounded-full bg-yellow-400 animate-pulse inline-block" title={`Vence en ${dias}d`} />;
  return <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" title={`Vence en ${dias}d`} />;
}

export default function TableroOrdenes() {
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('all');
  const [filtroCiclo, setFiltroCiclo] = useState('all');
  const [filtroRubro, setFiltroRubro] = useState('all');
  const [filtroEdificio, setFiltroEdificio] = useState('all');
  const [ordenSeleccionada, setOrdenSeleccionada] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const qc = useQueryClient();

  const { data: ordenes = [], isLoading } = useQuery({
    queryKey: ['ordenes-rutina'],
    queryFn: () => base44.entities.OrdenRutina.list('-fecha_generada', 300),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const rubros = useMemo(() => [...new Set(ordenes.map(o => o.rubro_nombre).filter(Boolean))].sort(), [ordenes]);
  const ciclos = useMemo(() => [...new Set(ordenes.map(o => o.ciclo).filter(Boolean))].sort(), [ordenes]);
  const edificios = useMemo(() => [...new Set(ordenes.map(o => o.edificio_nombre).filter(Boolean))].sort(), [ordenes]);

  const filtered = useMemo(() => ordenes.filter(o => {
    const q = search.toLowerCase();
    const ms = !q || o.rutina_objeto?.toLowerCase().includes(q) || o.edificio_nombre?.toLowerCase().includes(q) || o.rubro_nombre?.toLowerCase().includes(q);
    const me = filtroEstado === 'all' || o.estado === filtroEstado;
    const mc = filtroCiclo === 'all' || o.ciclo === filtroCiclo;
    const mr = filtroRubro === 'all' || o.rubro_nombre === filtroRubro;
    const mf = filtroEdificio === 'all' || o.edificio_nombre === filtroEdificio;
    return ms && me && mc && mr && mf;
  }), [ordenes, search, filtroEstado, filtroCiclo, filtroRubro, filtroEdificio]);

  const stats = useMemo(() => ({
    pendiente: ordenes.filter(o => o.estado === 'pendiente').length,
    en_proceso: ordenes.filter(o => o.estado === 'en_proceso').length,
    vencida: ordenes.filter(o => o.estado === 'vencida').length,
    ejecutada: ordenes.filter(o => o.estado === 'ejecutada').length,
  }), [ordenes]);

  const ejecutarProcesamiento = async () => {
    setProcesando(true);
    try {
      const res = await base44.functions.invoke('procesarRutinas', {});
      const d = res.data;
      toast.success(`Procesado: ${d.ordenes_creadas} órdenes creadas, ${d.ordenes_vencidas} marcadas vencidas`);
      qc.invalidateQueries({ queryKey: ['ordenes-rutina'] });
    } catch {
      toast.error('Error al procesar rutinas');
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Pendientes', value: stats.pendiente, color: '#facc15' },
          { label: 'En Proceso', value: stats.en_proceso, color: '#60a5fa' },
          { label: 'Vencidas', value: stats.vencida, color: '#f87171' },
          { label: 'Ejecutadas', value: stats.ejecutada, color: '#34d399' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/5 px-4 py-4">
            <p className="text-2xl font-bold" style={{ color }}>{value}</p>
            <p className="text-xs text-white/50 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <Input placeholder="Buscar rutina, edificio, rubro…" value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-white/5 border-white/15 text-white placeholder:text-white/30" />
        </div>
        {[
          { val: filtroEstado, set: setFiltroEstado, opts: Object.entries(ESTADO_CFG).map(([v, c]) => ({ v, l: c.label })), ph: 'Estado' },
          { val: filtroCiclo, set: setFiltroCiclo, opts: ciclos.map(c => ({ v: c, l: c })), ph: 'Ciclo' },
          { val: filtroRubro, set: setFiltroRubro, opts: rubros.map(r => ({ v: r, l: r })), ph: 'Rubro' },
          { val: filtroEdificio, set: setFiltroEdificio, opts: edificios.map(e => ({ v: e, l: e })), ph: 'Edificio' },
        ].map(({ val, set, opts, ph }) => (
          <Select key={ph} value={val} onValueChange={set}>
            <SelectTrigger className="w-40 bg-white/5 border-white/15 text-white text-xs">
              <SelectValue placeholder={ph} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {opts.map(({ v, l }) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        ))}
        <Button onClick={ejecutarProcesamiento} disabled={procesando} size="sm"
          className="gap-2 ml-auto" style={{ background: '#D4AF37', color: '#0A2540', fontWeight: 700 }}>
          {procesando ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Procesar rutinas
        </Button>
      </div>

      {/* Tabla */}
      <div className="rounded-2xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10" style={{ background: 'rgba(212,175,55,0.08)' }}>
                {['', 'Edificio', 'Rubro', 'Rutina / Objeto', 'Ciclo', 'Generada', 'Límite', 'Estado', 'OT', 'SISMESC', 'Acciones'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-white/50">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr><td colSpan={11} className="py-16 text-center">
                  <RefreshCw className="h-5 w-5 animate-spin text-white/30 mx-auto" />
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={11} className="py-16 text-center text-white/30">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p>No hay órdenes que coincidan</p>
                </td></tr>
              ) : filtered.map(o => {
                const eCfg = ESTADO_CFG[o.estado] || ESTADO_CFG.pendiente;
                return (
                  <tr key={o.id}
                    onClick={() => setOrdenSeleccionada(o)}
                    className="cursor-pointer transition-colors hover:bg-white/5">
                    <td className="px-4 py-3 w-8">
                      {o.fecha_limite && <Semaforo fechaLimite={o.fecha_limite} estado={o.estado} />}
                    </td>
                    <td className="px-4 py-3 text-xs text-white/70 whitespace-nowrap">{o.edificio_nombre || '—'}</td>
                    <td className="px-4 py-3 text-xs text-white/50 max-w-28 truncate">{o.rubro_nombre}</td>
                    <td className="px-4 py-3 text-sm font-medium text-white max-w-52">
                      <p className="truncate">{o.rutina_objeto}</p>
                      {o.carga_sismesc && <span className="text-[10px] text-emerald-400">SISMESC</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-white/50 whitespace-nowrap">{o.ciclo}</td>
                    <td className="px-4 py-3 text-xs text-white/50 whitespace-nowrap tabular-nums">{o.fecha_generada}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap tabular-nums font-medium"
                      style={{ color: o.estado === 'vencida' ? '#f87171' : 'rgba(255,255,255,0.6)' }}>
                      {o.fecha_limite}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`text-[10px] border ${eCfg.cls}`}>{eCfg.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {o.work_order_id
                        ? <span title="OT generada"><Wrench className="h-3.5 w-3.5 text-blue-400 mx-auto" /></span>
                        : <span className="text-white/15 text-xs">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-center">
                      {o.carga_sismesc && (
                        <span className={`text-xs font-bold ${(o.adjuntos || []).length > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {(o.adjuntos || []).length > 0 ? '✓' : '✗'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={e => { e.stopPropagation(); setOrdenSeleccionada(o); }}
                        className="text-xs px-3 py-1 rounded-lg border transition-colors"
                        style={{ borderColor: 'rgba(212,175,55,0.4)', color: '#D4AF37' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(212,175,55,0.1)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        Ver
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {ordenSeleccionada && (
        <OrdenDetalleModal
          orden={ordenSeleccionada}
          onClose={() => setOrdenSeleccionada(null)}
          onUpdated={() => {
            qc.invalidateQueries({ queryKey: ['ordenes-rutina'] });
            setOrdenSeleccionada(null);
          }}
        />
      )}
    </div>
  );
}