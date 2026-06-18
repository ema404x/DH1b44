import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { differenceInDays, parseISO } from 'date-fns';
import { Users, ChevronDown, ChevronRight, Search, AlertTriangle, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import JefeSitioCard from './JefeSitioCard';

function calcUrgencia(ordenes) {
  const vencidas = ordenes.filter(o => o.estado === 'vencida').length;
  const hoy = new Date();
  const proximas = ordenes.filter(o => {
    if (o.estado !== 'pendiente' || !o.fecha_limite) return false;
    return differenceInDays(parseISO(o.fecha_limite), hoy) <= 3;
  }).length;
  if (vencidas > 0) return 'critico';
  if (proximas > 0) return 'alerta';
  return 'normal';
}

export default function TableroJefeSitio() {
  const [search, setSearch] = useState('');
  const [expandedJefe, setExpandedJefe] = useState(null);
  const qc = useQueryClient();

  const { data: ordenes = [], isLoading: loadOrdenes } = useQuery({
    queryKey: ['ordenes-rutina-tablero'],
    queryFn: () => base44.entities.OrdenRutina.list('-fecha_generada', 500),
    staleTime: 60_000,
  });

  const { data: edificios = [], isLoading: loadEdificios } = useQuery({
    queryKey: ['edificios'],
    queryFn: () => base44.entities.Edificio.list('nombre', 300),
    staleTime: 300_000,
  });

  const isLoading = loadOrdenes || loadEdificios;

  // Mapa edificioId → jefe_sitio
  const edificioJefeMap = useMemo(() => {
    const m = {};
    for (const e of edificios) m[e.id] = e.jefe_sitio || 'Sin asignar';
    return m;
  }, [edificios]);

  // Agrupar órdenes activas (no ejecutadas) por jefe → escuela
  const gruposPorJefe = useMemo(() => {
    const activas = ordenes.filter(o => o.estado !== 'ejecutada' && o.estado !== 'derivada_tom');
    const jefeMap = {};

    for (const o of activas) {
      const jefe = edificioJefeMap[o.edificio_id] || o.edificio_nombre?.split(' ')[0] || 'Sin asignar';
      if (!jefeMap[jefe]) jefeMap[jefe] = {};
      const escuela = o.edificio_nombre || 'Sin edificio';
      if (!jefeMap[jefe][escuela]) jefeMap[jefe][escuela] = { edificio_id: o.edificio_id, ordenes: [] };
      jefeMap[jefe][escuela].ordenes.push(o);
    }

    return Object.entries(jefeMap)
      .map(([jefe, escuelas]) => {
        const todasOrdenes = Object.values(escuelas).flatMap(e => e.ordenes);
        return {
          jefe,
          escuelas: Object.entries(escuelas).map(([nombre, data]) => ({ nombre, ...data }))
            .sort((a, b) => {
              const ua = calcUrgencia(a.ordenes);
              const ub = calcUrgencia(b.ordenes);
              const order = { critico: 0, alerta: 1, normal: 2 };
              return order[ua] - order[ub];
            }),
          totalOrdenes: todasOrdenes.length,
          vencidas: todasOrdenes.filter(o => o.estado === 'vencida').length,
          urgencia: calcUrgencia(todasOrdenes),
        };
      })
      .sort((a, b) => {
        const order = { critico: 0, alerta: 1, normal: 2 };
        return order[a.urgencia] - order[b.urgencia] || b.vencidas - a.vencidas;
      });
  }, [ordenes, edificioJefeMap]);

  const totalJefes = gruposPorJefe.length;
  const totalCriticos = gruposPorJefe.filter(g => g.urgencia === 'critico').length;
  const totalVencidas = ordenes.filter(o => o.estado === 'vencida').length;
  const totalEjecutadas = ordenes.filter(o => o.estado === 'ejecutada').length;

  const filtered = useMemo(() => {
    if (!search.trim()) return gruposPorJefe;
    const q = search.toLowerCase();
    return gruposPorJefe.filter(g =>
      g.jefe.toLowerCase().includes(q) ||
      g.escuelas.some(e => e.nombre.toLowerCase().includes(q))
    );
  }, [gruposPorJefe, search]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-white/30" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Jefes de Sitio', value: totalJefes, icon: Users, color: '#60a5fa', sub: 'con rutinas activas' },
          { label: 'En estado crítico', value: totalCriticos, icon: AlertTriangle, color: '#f87171', sub: 'jefes con vencimientos' },
          { label: 'Rutinas vencidas', value: totalVencidas, icon: Clock, color: '#facc15', sub: 'requieren acción urgente' },
          { label: 'Ejecutadas', value: totalEjecutadas, icon: CheckCircle2, color: '#34d399', sub: 'total histórico' },
        ].map(({ label, value, icon: Icon, color, sub }) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
              <Icon className="h-5 w-5" style={{ color }} />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
              <p className="text-xs font-semibold text-white/70 leading-tight">{label}</p>
              <p className="text-[10px] text-white/35 mt-0.5">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
        <Input
          placeholder="Buscar jefe de sitio o escuela…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10 bg-white/5 border-white/15 text-white placeholder:text-white/30"
        />
      </div>

      {/* Lista de jefes */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-white/30">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No se encontraron jefes de sitio</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(grupo => (
            <JefeSitioCard
              key={grupo.jefe}
              grupo={grupo}
              expanded={expandedJefe === grupo.jefe}
              onToggle={() => setExpandedJefe(prev => prev === grupo.jefe ? null : grupo.jefe)}
              onOrdenUpdated={() => qc.invalidateQueries({ queryKey: ['ordenes-rutina-tablero'] })}
            />
          ))}
        </div>
      )}
    </div>
  );
}