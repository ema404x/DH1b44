import React from 'react';
import { cn } from '@/lib/utils';

export const PASOS = ['Dónde', 'Qué pasa', 'Fotos', 'Urgencia', 'Revisar'];

export default function PasosIndicador({ paso }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        {PASOS.map((_, i) => (
          <div key={i} className={cn('h-1.5 flex-1 rounded-full transition-colors duration-300', i < paso ? 'bg-primary' : 'bg-muted')} />
        ))}
      </div>
      <p className="text-sm font-semibold text-muted-foreground">
        Paso {paso} de {PASOS.length} · <span className="text-foreground">{PASOS[paso - 1]}</span>
      </p>
    </div>
  );
}