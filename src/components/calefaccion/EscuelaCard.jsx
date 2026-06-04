import { useState } from 'react';
import { MoreHorizontal, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
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
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied]     = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(escuela);
    setCopied(true);
    setMenuOpen(false);
    setTimeout(() => setCopied(false), 2000);
  };

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
        <div className="relative ml-2 shrink-0">
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded-md hover:bg-slate-700/60"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen && (
            <>
              {/* overlay para cerrar */}
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-7 z-20 bg-slate-800 border border-slate-700 rounded-xl shadow-xl py-1 min-w-[170px]">
                <button
                  onClick={() => { setExpanded(e => !e); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700/60 hover:text-white transition-colors"
                >
                  {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {expanded ? 'Ocultar detalle' : 'Ver detalle completo'}
                </button>
                <button
                  onClick={handleCopy}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700/60 hover:text-white transition-colors"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? '¡Copiado!' : 'Copiar nombre'}
                </button>
              </div>
            </>
          )}
        </div>
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
            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1 font-semibold">Priorizado</p>
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

      {/* Panel detalle expandido */}
      {expanded && (
        <div className="border-t border-slate-700/50 px-4 py-3 bg-slate-900/40">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-2 font-semibold">Detalle por tipo de equipo</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 text-[10px]">
                <th className="text-left pb-1.5">Tipo</th>
                <th className="text-right pb-1.5">Total</th>
                <th className="text-right pb-1.5">Funciona</th>
                <th className="text-right pb-1.5">Fallas</th>
                <th className="text-right pb-1.5">%</th>
              </tr>
            </thead>
            <tbody>
              {sortedRegistros.map((r, i) => {
                const tot   = Math.round(r.cantidad_total);
                const func  = Math.round(r.cantidad_funciona);
                const fallas = tot - func;
                const pct   = tot > 0 ? Math.round((func / tot) * 100) : 0;
                const dotColor = r.estado === 'critico' ? 'bg-red-500' : r.estado === 'alerta' ? 'bg-orange-500' : r.estado === 'normal' ? 'bg-blue-500' : 'bg-emerald-500';
                return (
                  <tr key={i} className="border-t border-slate-700/30">
                    <td className="py-1.5 flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotColor}`} />
                      {tipoLabels[r.tipo_equipo] || r.tipo_equipo}
                    </td>
                    <td className="text-right text-slate-400">{tot}</td>
                    <td className="text-right text-emerald-400 font-medium">{func}</td>
                    <td className="text-right text-red-400 font-medium">{fallas > 0 ? fallas : '—'}</td>
                    <td className="text-right font-bold text-white">{pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sortedRegistros[0]?.observaciones && (
            <p className="mt-2 text-[10px] text-slate-500 italic">{sortedRegistros[0].observaciones}</p>
          )}
        </div>
      )}
    </div>
  );
}