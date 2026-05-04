import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, BarChart2, ChevronRight, ArrowLeft, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import PAPORCGrid from '@/components/presupuestos/PAPORCGrid';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);
const RED_DARK = '#9B1C1C';
const RED_MAIN = '#C53030';
const RED_LIGHT = '#FED7D7';

function calcTotalPresupuesto(rubros, cp, co) {
  return (rubros || []).reduce((a, r) =>
    a + (r.items || []).reduce((b, i) => {
      const pu = (Number(i.pu_mat) || 0) + (Number(i.pu_mo) || 0);
      return b + pu * cp * co * (Number(i.cantidad) || 0);
    }, 0), 0);
}

function calcAvanceTotal(rubros, cp, co) {
  let total = 0, acum = 0;
  (rubros || []).forEach(r =>
    (r.items || []).forEach(i => {
      const sub = ((Number(i.pu_mat) || 0) + (Number(i.pu_mo) || 0)) * cp * co * (Number(i.cantidad) || 0);
      const ant = Number(i.avance_anterior_pct) || 0;
      const act = Number(i.avance_actual_pct) || 0;
      total += sub;
      acum  += sub * Math.min(ant + act, 100) / 100;
    })
  );
  return { total, acum, pct: total > 0 ? (acum / total) * 100 : 0 };
}

// ── Card de presupuesto en la lista ─────────────────────────────────────────
function PresupuestoCard({ p, onOpen }) {
  const cp = p.coef_pase   ?? 1.6504;
  const co = p.coef_oferta ?? 1.38;
  const { total, acum, pct } = calcAvanceTotal(p.rubros, cp, co);
  const totalItems = (p.rubros || []).reduce((a, r) => a + (r.items || []).length, 0);

  const pctColor = pct >= 100 ? 'text-emerald-600' : pct > 0 ? 'text-blue-600' : 'text-gray-400';
  const barColor = pct >= 100 ? '#22c55e' : pct > 0 ? '#3b82f6' : '#e5e7eb';

  return (
    <div
      onClick={() => onOpen(p)}
      className="group cursor-pointer border rounded-xl p-4 hover:shadow-md transition-all bg-white hover:border-red-300"
      style={{ borderColor: '#E2E8F0' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm truncate group-hover:text-red-700 transition-colors" style={{ color: RED_DARK }}>{p.titulo || '(Sin título)'}</p>
          <p className="text-[10px] font-mono text-gray-400 mt-0.5">{p.codigo}</p>
          {p.escuela && <p className="text-xs text-gray-500 mt-0.5 truncate">{p.escuela}</p>}
          <p className="text-[10px] text-gray-400 mt-1">{totalItems} ítems · {(p.rubros || []).length} rubros</p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-xl font-bold tabular-nums ${pctColor}`}>{pct.toFixed(0)}%</p>
          <p className="text-[10px] text-gray-400">acumulado</p>
        </div>
      </div>

      {/* Barra progreso */}
      <div className="mt-3 h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: barColor }} />
      </div>

      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-gray-400">{fmt(total)}</span>
        <span className="text-[10px] font-semibold" style={{ color: pct > 0 ? '#3b82f6' : '#9CA3AF' }}>{fmt(acum)} certificado</span>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border
          ${pct >= 100 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
            pct > 0 ? 'bg-blue-50 text-blue-700 border-blue-200' :
            'bg-gray-50 text-gray-500 border-gray-200'}`}>
          {pct >= 100 ? '✓ Obra completa' : pct > 0 ? 'En progreso' : 'Sin avance'}
        </span>
        <span className="text-xs font-medium flex items-center gap-1" style={{ color: RED_MAIN }}>
          Cargar avance <ChevronRight className="h-3 w-3" />
        </span>
      </div>
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function AvanceObra() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null); // presupuesto abierto

  const { data: presupuestos = [], isLoading } = useQuery({
    queryKey: ['presupuestos-obra'],
    queryFn: () => base44.entities.PresupuestoObraEnhanced.list('-updated_date', 100),
  });

  const saveMutation = useMutation({
    mutationFn: ({ id, rubros }) => base44.entities.PresupuestoObraEnhanced.update(id, { rubros }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['presupuestos-obra'] });
      toast.success('Avance guardado correctamente');
    },
  });

  const filtered = presupuestos.filter(p => {
    const q = search.toLowerCase();
    return !q || p.titulo?.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q) || p.escuela?.toLowerCase().includes(q);
  });

  // Stats globales
  const totalObras = presupuestos.length;
  const completas  = presupuestos.filter(p => {
    const { pct } = calcAvanceTotal(p.rubros, p.coef_pase ?? 1.6504, p.coef_oferta ?? 1.38);
    return pct >= 100;
  }).length;
  const enProgreso = presupuestos.filter(p => {
    const { pct } = calcAvanceTotal(p.rubros, p.coef_pase ?? 1.6504, p.coef_oferta ?? 1.38);
    return pct > 0 && pct < 100;
  }).length;

  // Vista detalle (PAPORC editor)
  if (selected) {
    const cp = selected.coef_pase   ?? 1.6504;
    const co = selected.coef_oferta ?? 1.38;
    return (
      <div className="flex flex-col min-h-full space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" className="gap-1.5 text-gray-500" onClick={() => setSelected(null)}>
            <ArrowLeft className="h-4 w-4" /> Volver
          </Button>
          <div className="flex items-center gap-1.5 text-sm min-w-0">
            <span className="text-gray-400 text-xs">Avance de Obra</span>
            <ChevronRight className="h-3 w-3 text-gray-300" />
            <span className="font-bold text-gray-800 truncate max-w-xs">{selected.titulo}</span>
          </div>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              className="gap-1.5"
              style={{ background: RED_DARK, color: 'white' }}
              onClick={() => {
                saveMutation.mutate({ id: selected.id, rubros: selected.rubros });
                setSelected(null);
              }}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Guardar y Certificar
            </Button>
          </div>
        </div>

        {/* Info obra */}
        <div className="rounded-xl border px-4 py-3 flex flex-wrap items-center gap-4 text-xs"
          style={{ background: RED_LIGHT, borderColor: RED_MAIN }}>
          <div><span className="text-gray-500">Código:</span> <span className="font-mono font-bold" style={{ color: RED_DARK }}>{selected.codigo}</span></div>
          {selected.escuela && <div><span className="text-gray-500">Escuela:</span> <span className="font-semibold" style={{ color: RED_DARK }}>{selected.escuela}</span></div>}
          {selected.licitacion && <div><span className="text-gray-500">Licitación:</span> <span className="font-mono" style={{ color: RED_DARK }}>{selected.licitacion}</span></div>}
          <div><span className="text-gray-500">Coef. Pase:</span> <span className="font-mono" style={{ color: RED_DARK }}>{cp}</span></div>
          <div><span className="text-gray-500">Coef. Oferta:</span> <span className="font-mono" style={{ color: RED_DARK }}>{co}</span></div>
        </div>

        {/* PAPORC Grid */}
        <PAPORCGrid
          rubros={selected.rubros || []}
          onChange={(rubros) => setSelected(s => ({ ...s, rubros }))}
          coefPase={cp}
          coefOferta={co}
        />
      </div>
    );
  }

  // Vista lista
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: RED_DARK }}>
            <BarChart2 className="h-5 w-5" style={{ color: RED_MAIN }} />
            Avance de Obra — PAMON / PAPORC
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Seguimiento físico de avance por obra y certificación mensual</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-0 rounded-xl overflow-hidden border shadow-sm" style={{ borderColor: RED_DARK }}>
        {[
          { label: 'Total Obras', value: totalObras, icon: BarChart2, bg: RED_DARK, color: 'white' },
          { label: 'En Progreso', value: enProgreso, icon: Clock, bg: RED_MAIN, color: 'white' },
          { label: 'Completadas', value: completas, icon: CheckCircle2, bg: '#ffffff', color: RED_DARK },
        ].map(({ label, value, icon: Icon, bg, color }, i) => (
          <div key={label} className={`flex items-center gap-3 px-4 py-3 ${i < 2 ? 'border-r' : ''}`}
            style={{ background: bg, borderColor: RED_DARK }}>
            <Icon className="h-5 w-5 shrink-0" style={{ color: i < 2 ? 'rgba(255,255,255,0.8)' : RED_MAIN }} />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: i < 2 ? 'rgba(255,255,255,0.7)' : '#6B7280' }}>{label}</p>
              <p className="text-xl font-bold tabular-nums leading-none mt-0.5" style={{ color: i < 2 ? '#fff' : RED_DARK }}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Buscador */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <Input placeholder="Buscar obra..." value={search} onChange={e => setSearch(e.target.value)}
          className="pl-9 h-9" />
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" style={{ color: RED_DARK }} /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-20 gap-3" style={{ borderColor: RED_LIGHT }}>
          <AlertCircle className="h-10 w-10" style={{ color: RED_LIGHT }} />
          <p className="font-semibold" style={{ color: RED_DARK }}>
            {presupuestos.length === 0 ? 'No hay presupuestos de obra cargados' : 'Sin resultados'}
          </p>
          <p className="text-sm text-gray-400">Cargá presupuestos en el módulo "Presupuestos Obra" primero.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(p => (
            <PresupuestoCard key={p.id} p={p} onOpen={setSelected} />
          ))}
        </div>
      )}
    </div>
  );
}