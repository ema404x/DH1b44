import React, { useState } from 'react';
import { differenceInDays, parseISO } from 'date-fns';
import {
  ChevronDown, ChevronRight, User, Building2, AlertTriangle,
  Clock, CheckCircle2, Zap, BarChart3
} from 'lucide-react';
import EscuelaPanel from './EscuelaPanel';

const URGENCIA_CFG = {
  critico: {
    label: 'Crítico',
    dot: 'bg-red-500',
    glow: 'shadow-red-500/20',
    border: 'border-red-500/30',
    bg: 'bg-red-500/8',
    badge: 'bg-red-500/20 text-red-300 border-red-500/30',
  },
  alerta: {
    label: 'Alerta',
    dot: 'bg-yellow-400 animate-pulse',
    glow: 'shadow-yellow-500/15',
    border: 'border-yellow-500/25',
    bg: 'bg-yellow-500/5',
    badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  },
  normal: {
    label: 'Al día',
    dot: 'bg-emerald-500',
    glow: '',
    border: 'border-white/10',
    bg: 'bg-white/3',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  },
};

function ProgressBar({ ordenes }) {
  const total = ordenes.length;
  if (!total) return null;
  const pendiente = ordenes.filter(o => o.estado === 'pendiente').length;
  const en_proceso = ordenes.filter(o => o.estado === 'en_proceso').length;
  const vencida = ordenes.filter(o => o.estado === 'vencida').length;

  const pct = (n) => `${Math.round((n / total) * 100)}%`;

  return (
    <div className="w-32 flex flex-col gap-1">
      <div className="h-1.5 w-full rounded-full overflow-hidden flex gap-px bg-white/10">
        <div className="h-full rounded-l-full bg-red-500/80 transition-all" style={{ width: pct(vencida) }} />
        <div className="h-full bg-blue-500/70 transition-all" style={{ width: pct(en_proceso) }} />
        <div className="h-full rounded-r-full bg-yellow-500/60 transition-all" style={{ width: pct(pendiente) }} />
      </div>
      <p className="text-[9px] text-white/30 text-right tabular-nums">{total} rutinas</p>
    </div>
  );
}

export default function JefeSitioCard({ grupo, expanded, onToggle, onOrdenUpdated }) {
  const cfg = URGENCIA_CFG[grupo.urgencia] || URGENCIA_CFG.normal;
  const todasOrdenes = grupo.escuelas.flatMap(e => e.ordenes);
  const en_proceso = todasOrdenes.filter(o => o.estado === 'en_proceso').length;

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all duration-200 ${cfg.border} ${expanded ? 'shadow-lg ' + cfg.glow : ''}`}>
      {/* Header del jefe */}
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-white/5 ${cfg.bg}`}
      >
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center font-bold text-sm"
            style={{ background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.25)', color: '#D4AF37' }}>
            {grupo.jefe.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${cfg.dot}`} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-white truncate">{grupo.jefe}</p>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-semibold ${cfg.badge}`}>
              {cfg.label}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="text-xs text-white/40 flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {grupo.escuelas.length} {grupo.escuelas.length === 1 ? 'escuela' : 'escuelas'}
            </span>
            {grupo.vencidas > 0 && (
              <span className="text-xs text-red-400 flex items-center gap-1 font-semibold">
                <AlertTriangle className="h-3 w-3" />
                {grupo.vencidas} vencidas
              </span>
            )}
            {en_proceso > 0 && (
              <span className="text-xs text-blue-400 flex items-center gap-1">
                <Zap className="h-3 w-3" />
                {en_proceso} en proceso
              </span>
            )}
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="hidden sm:block">
          <ProgressBar ordenes={todasOrdenes} />
        </div>

        {/* Chevron */}
        <div className="flex-shrink-0 ml-2">
          {expanded
            ? <ChevronDown className="h-5 w-5 text-white/40" />
            : <ChevronRight className="h-5 w-5 text-white/40" />
          }
        </div>
      </button>

      {/* Escuelas expandidas */}
      {expanded && (
        <div className="border-t border-white/8 divide-y divide-white/5">
          {grupo.escuelas.map(escuela => (
            <EscuelaPanel
              key={escuela.nombre}
              escuela={escuela}
              onOrdenUpdated={onOrdenUpdated}
            />
          ))}
        </div>
      )}
    </div>
  );
}