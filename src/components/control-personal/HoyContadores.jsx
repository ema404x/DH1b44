import React from 'react';
import { cn } from '@/lib/utils';
import { FILTROS_HOY } from './filtros';

export default function HoyContadores({ contadores, sinHorario, activo, onSelect }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5 sm:gap-3">
      {FILTROS_HOY.map((item, i) => {
        const bloqueado = sinHorario && item.horario;
        const selected = activo === item.key;
        return (
          <button
            key={item.key}
            type="button"
            disabled={bloqueado}
            onClick={() => onSelect(item.key)}
            style={{ animationDelay: `${i * 45}ms` }}
            className={cn(
              'acero-rise acero-kpi text-left rounded-2xl border bg-card px-3 py-3 sm:px-4 sm:py-4 min-h-[104px] sm:min-h-[118px] min-w-0 flex flex-col justify-between',
              selected ? 'border-primary ring-2 ring-primary/40' : 'border-border/60',
              bloqueado && 'opacity-50 cursor-not-allowed',
            )}
          >
            <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center', item.tone)}>
              <item.icon className="h-5 w-5" />
            </div>
            <div className="mt-3">
              <p className="text-3xl font-bold tabular-nums leading-none">{bloqueado ? '—' : (contadores?.[item.key] ?? 0)}</p>
              <p className="text-xs text-muted-foreground mt-1.5 leading-tight">{item.label}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}