import React from 'react';
import { MoreHorizontal } from 'lucide-react';
import ProgressRing from './ProgressRing';
import { Badge } from '@/components/ui/badge';

const TIPO_COLORS = {
  calderas:                  'bg-red-500/20 text-red-300 border-red-500/30',
  estufas:                   'bg-orange-500/20 text-orange-300 border-orange-500/30',
  conductos:                 'bg-teal-500/20 text-teal-300 border-teal-500/30',
  radiadores:                'bg-blue-500/20 text-blue-300 border-blue-500/30',
  vrv:                       'bg-purple-500/20 text-purple-300 border-purple-500/30',
  vrv_bajo_silueta:          'bg-violet-500/20 text-violet-300 border-violet-500/30',
  aire_acondicionado_calor:  'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  otros:                     'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

const RING_COLOR = {
  optimo:  '#10b981',
  normal:  '#3b82f6',
  alerta:  '#f97316',
  critico: '#ef4444',
};

const prioridad = { critico: 0, alerta: 1, normal: 2, optimo: 3 };

export default function EscuelaCard({ escuela, jefe_sitio, comuna, registros, tipoLabels }) {
  const totalUnids = registros.reduce((s, r) => s + Math.round(r.cantidad_total || 0), 0);
  const totalFunc  = registros.reduce((s, r) => s + Math.round(r.cantidad_funciona || 0), 0);
  const totalFallas = totalUnids - totalFunc;
  const pct = totalUnids > 0 ? Math.round((totalFunc / totalUnids) * 100) : 0;
  const peor = registros.reduce((acc, r) =>
    (prioridad[r.estado] ?? 4) < (prioridad[acc] ?? 4) ? r.estado : acc, 'optimo');
  const ringColor = RING_COLOR[peor] || '#3b82f6';

  // Ordenar: peores primero
  const sortedRegistros = [...registros].sort((a, b) =>
    (prioridad[a.estado] ?? 4) - (prioridad[b.estado] ?? 4)
  );

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-sm overflow-hidden hover:border-slate-600/70 transition-all hover:bg-slate-800/70">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-white truncate">{escuela}</h3>
          <p className="text-xs text-slate-400 truncate mt-0.5">{jefe_sitio || 'Sin jefe asignado'} · {comuna ? `C. ${comuna}` : ''}</p>
        </div>
        <button className="text-slate-500 hover:text-slate-300 transition-colors ml-2 shrink-0">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="px-4 pb-4 flex gap-4">
        {/* Ring */}
        <div className="flex flex-col items-center gap-1.5 shrink-0 w-[90px]">
          <ProgressRing pct={pct} size={80} stroke={7} color={ringColor} />
          <p className="text-[10px] text-slate-400 text-center leading-tight font-medium">Operatividad<br/>Global</p>
          <p className="text-[10px] text-slate-500 text-center leading-tight">
            <span className="text-emerald-400 font-semibold">{totalFunc.toLocaleString()}</span> func.
          </p>
          {totalFallas > 0 && (
            <p className="text-[10px] text-red-400 font-semibold text-center">{totalFallas} con fallas</p>
          )}
        </div>

        {/* Detalle derecho */}
        <div className="flex-1 min-w-0 space-y-2.5">
          {/* Chips de equipos */}
          <div className="flex flex-wrap gap-1">
            {sortedRegistros.map((r, i) => {
              const label = tipoLabels[r.tipo_equipo] || r.tipo_equipo;
              const cls = TIPO_COLORS[r.tipo_equipo] || TIPO_COLORS.otros;
              const total = Math.round(r.cantidad_total);
              return (
                <span key={i} className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md border font-medium ${cls}`}>
                  {label} <span className="opacity-60">{total}</span>
                </span>
              );
            })}
          </div>

          {/* Lista priorizada */}
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1 font-semibold">Priorizado de alist</p>
            <ul className="space-y-0.5">
              {sortedRegistros.slice(0, 4).map((r, i) => {
                const func = Math.round(r.cantidad_funciona);
                const tot  = Math.round(r.cantidad_total);
                const fallas = tot - func;
                return (
                  <li key={i} className="flex items-center gap-1.5 text-[11px] text-slate-300">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                      r.estado === 'critico' ? 'bg-red-500' :
                      r.estado === 'alerta'  ? 'bg-orange-500' :
                      r.estado === 'normal'  ? 'bg-blue-500' : 'bg-emerald-500'
                    }`} />
                    <span className="truncate">
                      {tipoLabels[r.tipo_equipo] || r.tipo_equipo}
                      {fallas > 0 && <span className="text-red-400 ml-1">· {fallas} fallas</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}