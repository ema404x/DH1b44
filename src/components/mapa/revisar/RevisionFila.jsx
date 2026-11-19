import React from 'react';
import { School, QrCode, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ESTADOS, metros, REVISADA_CLS } from './api';

export default function RevisionFila({ item, activo, onClick }) {
  const e = ESTADOS[item.estado];
  const Icono = item.tipo === 'colegio' ? School : QrCode;
  return (
    <button type="button" onClick={onClick}
      className={cn('w-full text-left flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40', activo && 'bg-accent/60')}>
      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0"><Icono className="h-4 w-4 text-muted-foreground" /></div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.nombre}</p>
        <p className="text-xs text-muted-foreground truncate">{item.direccion}</p>
        <div className="flex flex-wrap gap-1 mt-1">
          <span className={cn('inline-block text-[11px] px-2 py-0.5 rounded-md border', e.cls)}>{e.label}</span>
          {item.revisada && <span className={cn('inline-block text-[11px] px-2 py-0.5 rounded-md border', REVISADA_CLS)}>Revisada</span>}
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold tabular-nums">{metros(item.distancia)}</p>
        {item.usaFichaje && <p className="text-[10px] text-muted-foreground">con fichaje</p>}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  );
}