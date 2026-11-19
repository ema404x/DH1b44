import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export const URGENCIAS = [
  { key: 'baja', label: 'Baja', hint: 'Puede esperar', cls: 'border-slate-500/40 bg-slate-500/10 text-slate-200', on: 'border-slate-300 bg-slate-500/30' },
  { key: 'media', label: 'Media', hint: 'Esta semana', cls: 'border-sky-500/40 bg-sky-500/10 text-sky-200', on: 'border-sky-300 bg-sky-500/30' },
  { key: 'alta', label: 'Alta', hint: 'En uno o dos días', cls: 'border-orange-500/40 bg-orange-500/10 text-orange-200', on: 'border-orange-300 bg-orange-500/30' },
  { key: 'urgente', label: 'Urgente', hint: 'Hoy mismo', cls: 'border-red-500/40 bg-red-500/10 text-red-200', on: 'border-red-300 bg-red-500/30' },
];

// Paso 4: urgencia con botones grandes.
export default function PasoUrgencia({ prioridad, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {URGENCIAS.map((u) => {
        const sel = prioridad === u.key;
        return (
          <button key={u.key} onClick={() => onChange(u.key)} className={cn('relative flex min-h-[96px] flex-col items-center justify-center gap-1 rounded-2xl border-2 transition-all active:scale-[0.97]', u.cls, sel && u.on)}>
            {sel && <Check className="absolute right-2 top-2 h-5 w-5" />}
            <span className="text-lg font-bold">{u.label}</span>
            <span className="text-xs opacity-80">{u.hint}</span>
          </button>
        );
      })}
    </div>
  );
}