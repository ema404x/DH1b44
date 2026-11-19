import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { MapPin, User, Camera, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PRIORIDADES, TIPOS } from '@/lib/propuestasOT';

export default function PropuestaCard({ propuesta: p, onClick }) {
  const prio = PRIORIDADES[p.prioridad] || PRIORIDADES.media;
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-xl border border-border bg-card p-3.5 flex items-start gap-3 hover:bg-accent/40 active:scale-[0.99] transition"
    >
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded', prio.cls)}>{prio.label}</span>
          <span className="text-[11px] text-muted-foreground">{TIPOS[p.tipo] || p.tipo}</span>
          <span className="text-[11px] text-muted-foreground ml-auto">
            {p.created_date ? format(new Date(p.created_date), "d MMM, HH:mm", { locale: es }) : ''}
          </span>
        </div>
        <p className="font-semibold text-sm text-foreground leading-snug line-clamp-2">{p.titulo}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><User className="h-3 w-3" />{p.solicitante_nombre || 'Operario'}</span>
          {(p.location || p.asset_name) && (
            <span className="flex items-center gap-1 min-w-0"><MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{p.location || p.asset_name}</span></span>
          )}
          {p.fotos?.length > 0 && <span className="flex items-center gap-1"><Camera className="h-3 w-3" />{p.fotos.length}</span>}
        </div>
        {!p.jefe_sitio_email && p.estado === 'enviada' && (
          <p className="text-[11px] text-amber-400">Sin jefe asignado</p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
    </button>
  );
}