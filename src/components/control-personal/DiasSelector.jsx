import React from 'react';
import { cn } from '@/lib/utils';

const DIAS = [
  { key: 'lun', label: 'Lun' }, { key: 'mar', label: 'Mar' }, { key: 'mie', label: 'Mié' },
  { key: 'jue', label: 'Jue' }, { key: 'vie', label: 'Vie' }, { key: 'sab', label: 'Sáb' }, { key: 'dom', label: 'Dom' },
];

export default function DiasSelector({ value = [], onChange, disabled }) {
  const toggle = (k) => onChange(value.includes(k) ? value.filter((d) => d !== k) : [...value, k]);
  return (
    <div className="flex flex-wrap gap-2">
      {DIAS.map((d) => {
        const on = value.includes(d.key);
        return (
          <button key={d.key} type="button" disabled={disabled} onClick={() => toggle(d.key)}
            className={cn('h-11 min-w-[52px] px-3 rounded-xl border text-sm font-semibold transition-colors',
              on ? 'bg-primary text-primary-foreground border-primary' : 'border-border/60 text-muted-foreground hover:bg-accent/40',
              disabled && 'opacity-60 cursor-not-allowed')}>
            {d.label}
          </button>
        );
      })}
    </div>
  );
}