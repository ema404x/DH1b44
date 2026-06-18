import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search, ChevronRight, ChevronDown, RefreshCw, Clock, AlertCircle,
  CheckCircle2, FileText, ClipboardList, Zap, Shield, Building2,
  AlertTriangle, Info, BookOpen, CalendarDays, Wrench
} from 'lucide-react';

const CICLO_COLORS = {
  Semanal:       'bg-red-500/20 text-red-300 border-red-500/30',
  Quincenal:     'bg-orange-500/20 text-orange-300 border-orange-500/30',
  Mensual:       'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  Bimestral:     'bg-lime-500/20 text-lime-300 border-lime-500/30',
  Trimestral:    'bg-green-500/20 text-green-300 border-green-500/30',
  Cuatrimestral: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
  Semestral:     'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  Anual:         'bg-blue-500/20 text-blue-300 border-blue-500/30',
  Bienal:        'bg-purple-500/20 text-purple-300 border-purple-500/30',
};

/* ──────────────────────────────────────────────────────────
   Panel de contexto documental (intro del Anexo 3)
────────────────────────────────────────────────────────── */
function PanelContexto() {
  const [open, setOpen] = useState(false);

  const conceptos = [
    {
      icon: Wrench,
      color: '#60a5fa',
      titulo: 'Por Mantenimiento (abono)',
      desc: 'Verificación, reparación menor, reposición de piezas chicas, limpieza, lubricación, ajuste. Cubierto por el contrato.'
    },
    {
      icon: Zap,
      color: '#f59e0b',
      titulo: 'TOM — Trabajo de Obra de Mantenimiento',
      desc: 'Reemplazos integrales, equipos nuevos, reparaciones estructurales, réplicas en APH. Se presupuestan y certifican por separado.'
    },
    {
      icon: Shield,
      color: '#a78bfa',
      titulo: 'Regla del 50%',
      desc: 'En cubiertas y carpinterías: si los elementos a reparar/reponer superan el 50% del total, la DGMESC puede derivar la intervención completa a TOM.'
    },
    {
      icon: Building2,
      color: '#34d399',
      titulo: 'Edificios APH',
      desc: 'Con protección histórica se aplica el Anexo 4 APH: retiro cuidadoso de partes en riesgo por mantenimiento y posterior restauración/réplica vía TOM, consensuado con la Inspección.'
    },
    {
      icon: CalendarDays,
      color: '#fb923c',
      titulo: 'Estacionalidad',
      desc: 'Calefacción: mar–sep | Refrigeración: sep–mar | Ventiladores: oct–mar | Iluminación y juegos: recesos de invierno (jul) y verano (feb). Las rutinas fuera de temporada no se generan.'
    },
    {
      icon: ClipboardList,
      color: '#f472b6',
      titulo: 'SISMESC',
      desc: 'Sistema de gestión de la DGMESC. Rutinas, informes firmados, comprobantes de fumigación, check lists y certificados de potabilidad se cargan obligatoriamente en la plataforma.'
    },
  ];

  return (
    <div className="rounded-2xl border mb-6 overflow-hidden" style={{ borderColor: 'rgba(212,175,55,0.25)', background: 'rgba(10,37,64,0.5)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors hover:bg-white/5"
      >
        <div className="flex items-center gap-3">
          <BookOpen className="h-5 w-5" style={{ color: '#D4AF37' }} />
          <div>
            <p className="text-sm font-bold text-white">Marco Contractual — Anexo 3 al PETP</p>
            <p className="text-xs text-white/50">DGMESC · Ministerio de Educación GCBA</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold border"
            style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37', borderColor: 'rgba(212,175,55,0.3)' }}>
            Referencia contractual
          </span>
          {open ? <ChevronDown className="h-4 w-4 text-white/40" /> : <ChevronRight className="h-4 w-4 text-white/40" />}
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5">
          {/* Propósito */}
          <div className="mb-4 p-3 rounded-xl bg-white/5 border border-white/10">
            <p className="text-xs text-white/70 leading-relaxed">
              Catálogo de <b className="text-white">96 rutinas de mantenimiento preventivo</b> que el contratista adjudicatario debe ejecutar sobre los edificios escolares de CABA.
              Define para cada componente del edificio: <b className="text-white">qué hay que hacer</b>, con qué <b className="text-white">periodicidad</b> y en qué <b className="text-white">plazo</b>.
              Es un <span style={{ color: '#D4AF37' }}>documento contractual</span>: marca el piso de cumplimiento del servicio.
              <br /><br />
              <span className="italic text-white/50">"Las rutinas que no sean aplicables a los edificios serán eliminadas"</span> — cada edificio activa solo su subconjunto del catálogo.
            </p>
          </div>

          {/* Conceptos clave */}
          <p className="text-[10px] uppercase tracking-widest font-semibold mb-3" style={{ color: '#D4AF37' }}>Conceptos clave</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {conceptos.map(({ icon: Icon, color, titulo, desc }) => (
              <div key={titulo} className="flex gap-3 p-3 rounded-xl border border-white/10 bg-white/5">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}22` }}>
                  <Icon className="h-4 w-4" style={{ color }} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">{titulo}</p>
                  <p className="text-[11px] text-white/50 mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Certificación profesional */}
          <div className="mt-4 p-3 rounded-xl border border-purple-500/30 bg-purple-500/10">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-purple-300" />
              <p className="text-xs font-bold text-purple-200">Certificación profesional obligatoria (~16 rutinas)</p>
            </div>
            <p className="text-[11px] text-purple-200/70 leading-relaxed">
              Informe firmado por arquitecto/ingeniero matriculado en: fundaciones, hormigón, estructura metálica y de madera,
              bovedilla, mampostería, cateo de cielorrasos, instalación eléctrica general, puesta a tierra y pararrayos,
              instalación de gas, contra incendio, calefacción y elevadores/plataformas (conservador inscripto en Registro de Verificadores).
            </p>
          </div>

          {/* Tipos de orden */}
          <div className="mt-3 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-emerald-300" />
              <p className="text-xs font-bold text-emerald-200">Órdenes tipificadas SISMESC</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { code: 'MEES', desc: 'Genera corte de césped adicional' },
                { code: 'MEPL', desc: 'Carga observaciones de cielorrasos' },
                { code: 'MEL', desc: 'Asociada a unidades enfriadoras' },
              ].map(({ code, desc }) => (
                <div key={code} className="flex items-start gap-2">
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex-shrink-0">{code}</span>
                  <span className="text-[11px] text-emerald-200/60">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Distribución de frecuencias
────────────────────────────────────────────────────────── */
function StatsFrequencia({ rutinas }) {
  const dist = useMemo(() => {
    const counts = {};
    for (const r of rutinas) counts[r.ciclo] = (counts[r.ciclo] || 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [rutinas]);

  if (!rutinas.length) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 mb-4">
      <p className="text-[10px] uppercase tracking-widest font-semibold mb-3" style={{ color: '#D4AF37' }}>Distribución por frecuencia</p>
      <div className="flex flex-wrap gap-2">
        {dist.map(([ciclo, n]) => (
          <div key={ciclo} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${CICLO_COLORS[ciclo] || 'bg-slate-500/20 text-slate-300 border-slate-500/30'}`}>
            <span>{ciclo}</span>
            <span className="opacity-60 font-normal">·</span>
            <span>{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Fila de rutina individual
────────────────────────────────────────────────────────── */
function RutinaRow({ rutina }) {
  const [open, setOpen] = useState(false);
  const cicloClr = CICLO_COLORS[rutina.ciclo] || 'bg-slate-500/20 text-slate-300';
  const esTOM = rutina.observaciones_tom && rutina.observaciones_tom.trim().length > 0;

  return (
    <div className="border border-white/8 rounded-xl mb-2 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start justify-between px-4 py-3 bg-white/5 hover:bg-white/10 transition-colors text-left gap-3"
      >
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          {open ? <ChevronDown className="h-4 w-4 text-white/40 flex-shrink-0 mt-0.5" /> : <ChevronRight className="h-4 w-4 text-white/40 flex-shrink-0 mt-0.5" />}
          <span className="text-sm font-medium text-white leading-snug">{rutina.objeto}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
          <Badge variant="outline" className={`text-[10px] border ${cicloClr}`}>{rutina.ciclo}</Badge>
          {rutina.tipo === 'informe'
            ? <Badge variant="outline" className="text-[10px] border bg-amber-500/15 text-amber-300 border-amber-500/30">Informe</Badge>
            : <Badge variant="outline" className="text-[10px] border bg-blue-500/15 text-blue-300 border-blue-500/30">Mant.</Badge>
          }
          {rutina.requiere_informe_matriculado && (
            <Badge variant="outline" className="text-[10px] border bg-purple-500/15 text-purple-300 border-purple-500/30">
              <Shield className="h-2.5 w-2.5 mr-0.5" />Matriculado
            </Badge>
          )}
          {rutina.carga_sismesc && (
            <Badge variant="outline" className="text-[10px] border bg-emerald-500/15 text-emerald-300 border-emerald-500/30">SISMESC</Badge>
          )}
          {esTOM && (
            <Badge variant="outline" className="text-[10px] border bg-orange-500/15 text-orange-300 border-orange-500/30">
              <Zap className="h-2.5 w-2.5 mr-0.5" />TOM
            </Badge>
          )}
          <span className="text-[11px] text-white/35 ml-1 whitespace-nowrap">SLA {rutina.plazo_dias}d</span>
        </div>
      </button>

      {open && (
        <div className="px-5 py-4 bg-black/25 space-y-3 border-t border-white/8">
          {rutina.acciones && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: '#D4AF37' }}>Acciones</p>
              <p className="text-sm text-white/80 leading-relaxed">{rutina.acciones}</p>
            </div>
          )}
          {esTOM && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Zap className="h-3 w-3 text-amber-400" />
                <p className="text-[10px] uppercase tracking-wider font-semibold text-amber-400">Obs. TOM / APH</p>
              </div>
              <p className="text-sm text-amber-200/80">{rutina.observaciones_tom}</p>
            </div>
          )}
          {rutina.estacionalidad && (
            <div className="flex items-start gap-2 rounded-lg border border-orange-500/25 bg-orange-500/10 px-3 py-2">
              <CalendarDays className="h-3.5 w-3.5 text-orange-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold text-orange-400 mb-0.5">Estacionalidad</p>
                <p className="text-xs text-orange-200/80">{rutina.estacionalidad}</p>
              </div>
            </div>
          )}
          {rutina.requiere_informe_matriculado && (
            <div className="flex items-start gap-2 rounded-lg border border-purple-500/25 bg-purple-500/10 px-3 py-2">
              <Shield className="h-3.5 w-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-purple-200/80">Requiere informe firmado por <b>profesional matriculado</b> (arquitecto / ingeniero según materia).</p>
            </div>
          )}
          <div className="flex flex-wrap gap-4 text-xs text-white/40 pt-1 border-t border-white/8">
            <span>Ciclo: <b className="text-white/70">{rutina.ciclo}</b></span>
            {rutina.frecuencia_dias && <span>Frecuencia: <b className="text-white/70">{rutina.frecuencia_dias} días</b></span>}
            <span>Plazo SLA: <b className="text-white/70">{rutina.plazo_dias} días corridos</b></span>
            {rutina.tipo && <span>Régimen: <b className="text-white/70">{rutina.tipo === 'informe' ? 'Informe técnico' : 'Mantenimiento (abono)'}</b></span>}
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

  const tieneMatriculado = rutinas.some(r => r.requiere_informe_matriculado);
  const tieneTOM = rutinas.some(r => r.observaciones_tom?.trim());
  const tieneEstacional = rutinas.some(r => r.estacionalidad);

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
          {tieneMatriculado && <Badge variant="outline" className="text-[9px] border bg-purple-500/15 text-purple-300 border-purple-500/30 hidden sm:flex"><Shield className="h-2.5 w-2.5 mr-0.5" />Matriculado</Badge>}
          {tieneTOM && <Badge variant="outline" className="text-[9px] border bg-orange-500/15 text-orange-300 border-orange-500/30 hidden sm:flex"><Zap className="h-2.5 w-2.5 mr-0.5" />TOM</Badge>}
          {tieneEstacional && <Badge variant="outline" className="text-[9px] border bg-orange-500/10 text-orange-200 border-orange-500/20 hidden sm:flex"><CalendarDays className="h-2.5 w-2.5 mr-0.5" />Estacional</Badge>}
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

/* ──────────────────────────────────────────────────────────
   Componente principal
────────────────────────────────────────────────────────── */
export default function CatalogoRutinas() {
  const [search, setSearch] = useState('');
  const [filtroCiclo, setFiltroCiclo] = useState('todos');

  const { data: rutinas = [], isLoading } = useQuery({
    queryKey: ['rutinas-catalogo'],
    queryFn: () => base44.entities.RutinaCatalogo.list('rubro_nombre', 200),
    staleTime: 300_000,
  });

  const ciclosDisponibles = useMemo(() => {
    const set = new Set(rutinas.map(r => r.ciclo).filter(Boolean));
    return ['todos', ...Array.from(set)];
  }, [rutinas]);

  const filtered = useMemo(() => {
    let result = rutinas;
    if (filtroCiclo !== 'todos') result = result.filter(r => r.ciclo === filtroCiclo);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        r.objeto?.toLowerCase().includes(q) ||
        r.rubro_nombre?.toLowerCase().includes(q) ||
        r.item?.toLowerCase().includes(q) ||
        r.acciones?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [rutinas, search, filtroCiclo]);

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

      {/* Marco documental */}
      <PanelContexto />

      {/* Stats generales */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total rutinas', value: rutinas.length, icon: ClipboardList, color: '#D4AF37' },
          { label: 'Mantenimiento', value: rutinas.filter(r => r.tipo === 'mantenimiento').length, icon: Wrench, color: '#60a5fa' },
          { label: 'Req. Matriculado', value: rutinas.filter(r => r.requiere_informe_matriculado).length, icon: Shield, color: '#a78bfa' },
          { label: 'Rubros', value: Object.keys(porRubro).length || new Set(rutinas.map(r => r.rubro_nombre)).size, icon: Building2, color: '#34d399' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 flex items-center gap-3">
            <Icon className="h-5 w-5 flex-shrink-0" style={{ color }} />
            <div>
              <p className="text-xl font-bold text-white tabular-nums">{value}</p>
              <p className="text-xs text-white/50">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Distribución por frecuencia */}
      <StatsFrequencia rutinas={rutinas} />

      {/* Buscador + filtro de ciclo */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <Input
            placeholder="Buscar rutina, rubro, ítem, acciones…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 bg-white/5 border-white/15 text-white placeholder:text-white/30 focus:border-yellow-500/50"
          />
        </div>
        <select
          value={filtroCiclo}
          onChange={e => setFiltroCiclo(e.target.value)}
          className="px-3 py-2 rounded-md text-sm bg-white/5 border border-white/15 text-white focus:outline-none focus:border-yellow-500/50"
        >
          {ciclosDisponibles.map(c => (
            <option key={c} value={c} className="bg-slate-800">{c === 'todos' ? 'Todos los ciclos' : c}</option>
          ))}
        </select>
      </div>

      {/* Catálogo */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-6 w-6 animate-spin text-white/40" />
        </div>
      ) : rutinas.length === 0 ? (
        <div className="text-center py-20 text-white/40">
          <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No hay rutinas cargadas en el catálogo</p>
          <p className="text-sm mt-1 text-white/30">Importá el catálogo desde el módulo de Rutinas → Catálogo</p>
        </div>
      ) : (
        <>
          {filtered.length === 0 && search && (
            <div className="text-center py-12 text-white/40">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Sin resultados para "{search}"</p>
            </div>
          )}
          {Object.entries(porRubro).map(([rubro, rs]) => (
            <RubroSection key={rubro} rubroNombre={rubro} rutinas={rs} />
          ))}
        </>
      )}
    </div>
  );
}