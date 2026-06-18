import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, ChevronRight, ChevronDown, RefreshCw, Clock, AlertCircle, CheckCircle2, FileText, ClipboardList } from 'lucide-react';

const CICLO_COLORS = {
  Semanal: 'bg-red-500/20 text-red-300 border-red-500/30',
  Quincenal: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  Mensual: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  Bimestral: 'bg-lime-500/20 text-lime-300 border-lime-500/30',
  Trimestral: 'bg-green-500/20 text-green-300 border-green-500/30',
  Cuatrimestral: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
  Semestral: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  Anual: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  Bienal: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
};

function RutinaRow({ rutina }) {
  const [open, setOpen] = useState(false);
  const cicloClr = CICLO_COLORS[rutina.ciclo] || 'bg-slate-500/20 text-slate-300';

  return (
    <div className="border border-white/8 rounded-xl mb-2 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 transition-colors text-left gap-3"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {open ? <ChevronDown className="h-4 w-4 text-white/40 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-white/40 flex-shrink-0" />}
          <span className="text-sm font-medium text-white truncate">{rutina.objeto}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge variant="outline" className={`text-[10px] border ${cicloClr}`}>{rutina.ciclo}</Badge>
          <Badge variant="outline" className={`text-[10px] border ${rutina.tipo === 'informe' ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-blue-500/15 text-blue-300 border-blue-500/30'}`}>
            {rutina.tipo === 'informe' ? 'Informe' : 'Mant.'}
          </Badge>
          {rutina.requiere_informe_matriculado && (
            <Badge variant="outline" className="text-[10px] border bg-purple-500/15 text-purple-300 border-purple-500/30">Matriculado</Badge>
          )}
          {rutina.carga_sismesc && (
            <Badge variant="outline" className="text-[10px] border bg-emerald-500/15 text-emerald-300 border-emerald-500/30">SISMESC</Badge>
          )}
          <span className="text-[11px] text-white/40 ml-1">Plazo: {rutina.plazo_dias}d</span>
        </div>
      </button>
      {open && (
        <div className="px-5 py-4 bg-black/20 space-y-3">
          {rutina.acciones && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: '#D4AF37' }}>Acciones</p>
              <p className="text-sm text-white/80 leading-relaxed">{rutina.acciones}</p>
            </div>
          )}
          {rutina.observaciones_tom && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-amber-400 mb-1">Obs. TOM / APH</p>
              <p className="text-sm text-amber-200/80">{rutina.observaciones_tom}</p>
            </div>
          )}
          {rutina.estacionalidad && (
            <div className="flex items-center gap-2 text-xs text-white/50">
              <Clock className="h-3.5 w-3.5" />
              <span>Estacionalidad / Condición: <span className="text-white/70">{rutina.estacionalidad}</span></span>
            </div>
          )}
          <div className="flex gap-4 text-xs text-white/40 pt-1">
            <span>Ciclo: <b className="text-white/70">{rutina.ciclo}</b></span>
            <span>Frecuencia: <b className="text-white/70">{rutina.frecuencia_dias} días</b></span>
            <span>Plazo SLA: <b className="text-white/70">{rutina.plazo_dias} días</b></span>
          </div>
        </div>
      )}
    </div>
  );
}

function ItemGroup({ itemNombre, rutinas }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 mb-2 text-left w-full group"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 text-white/30" /> : <ChevronRight className="h-3.5 w-3.5 text-white/30" />}
        <span className="text-xs font-semibold uppercase tracking-wider text-white/50 group-hover:text-white/70 transition-colors">{itemNombre}</span>
        <span className="text-[10px] text-white/30 ml-1">({rutinas.length})</span>
      </button>
      {open && (
        <div className="ml-3">
          {rutinas.map(r => <RutinaRow key={r.id} rutina={r} />)}
        </div>
      )}
    </div>
  );
}

function RubroSection({ rubroNombre, rutinas }) {
  const [open, setOpen] = useState(true);

  const porItem = useMemo(() => {
    const map = {};
    for (const r of rutinas) {
      if (!map[r.item]) map[r.item] = [];
      map[r.item].push(r);
    }
    return map;
  }, [rutinas]);

  return (
    <div className="mb-4 rounded-2xl border border-white/10 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors"
        style={{ background: 'linear-gradient(90deg, rgba(212,175,55,0.12) 0%, rgba(10,37,64,0.6) 100%)' }}
      >
        <div className="flex items-center gap-3">
          {open ? <ChevronDown className="h-5 w-5" style={{ color: '#D4AF37' }} /> : <ChevronRight className="h-5 w-5" style={{ color: '#D4AF37' }} />}
          <span className="text-base font-bold text-white">{rubroNombre}</span>
        </div>
        <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold border"
          style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37', borderColor: 'rgba(212,175,55,0.3)' }}>
          {rutinas.length} rutinas
        </span>
      </button>
      {open && (
        <div className="px-5 py-4 bg-black/20">
          {Object.entries(porItem).map(([item, rs]) => (
            <ItemGroup key={item} itemNombre={item} rutinas={rs} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CatalogoRutinas() {
  const [search, setSearch] = useState('');

  const { data: rutinas = [], isLoading } = useQuery({
    queryKey: ['rutinas-catalogo'],
    queryFn: () => base44.entities.RutinaCatalogo.list('rubro_nombre', 200),
    staleTime: 300_000,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return rutinas;
    const q = search.toLowerCase();
    return rutinas.filter(r =>
      r.objeto?.toLowerCase().includes(q) ||
      r.rubro_nombre?.toLowerCase().includes(q) ||
      r.item?.toLowerCase().includes(q) ||
      r.acciones?.toLowerCase().includes(q)
    );
  }, [rutinas, search]);

  const porRubro = useMemo(() => {
    const map = {};
    for (const r of filtered) {
      if (!map[r.rubro_nombre]) map[r.rubro_nombre] = [];
      map[r.rubro_nombre].push(r);
    }
    return map;
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
        {[
          { label: 'Total rutinas', value: rutinas.length, icon: ClipboardList, color: '#D4AF37' },
          { label: 'Mantenimiento', value: rutinas.filter(r => r.tipo === 'mantenimiento').length, icon: RefreshCw, color: '#60a5fa' },
          { label: 'Informes', value: rutinas.filter(r => r.tipo === 'informe').length, icon: FileText, color: '#a78bfa' },
          { label: 'Rubros', value: Object.keys(porRubro).length, icon: CheckCircle2, color: '#34d399' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 flex items-center gap-3">
            <Icon className="h-5 w-5 flex-shrink-0" style={{ color }} />
            <div>
              <p className="text-xl font-bold text-white">{value}</p>
              <p className="text-xs text-white/50">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
        <Input
          placeholder="Buscar rutina, rubro, ítem, acciones…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10 bg-white/5 border-white/15 text-white placeholder:text-white/30 focus:border-yellow-500/50"
        />
      </div>

      {/* Rubros */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-6 w-6 animate-spin text-white/40" />
        </div>
      ) : rutinas.length === 0 ? (
        <div className="text-center py-20 text-white/40">
          <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No hay rutinas cargadas</p>
          <p className="text-sm mt-1">Importá el catálogo desde el panel de administración</p>
        </div>
      ) : (
        Object.entries(porRubro).map(([rubro, rs]) => (
          <RubroSection key={rubro} rubroNombre={rubro} rutinas={rs} />
        ))
      )}
    </div>
  );
}