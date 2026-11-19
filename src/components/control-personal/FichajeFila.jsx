import React from 'react';
import { Badge } from '@/components/ui/badge';
import { MapPinOff, Timer, AlertTriangle } from 'lucide-react';
import { horaAR } from './formato';

export default function FichajeFila({ f }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0 text-sm font-bold text-primary">
        {(f.operario_nombre || '?').charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">{f.operario_nombre || 'Sin nombre'}</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          Entró {horaAR(f.entrada_timestamp)}
          {f.salida_timestamp && !f.salida_omitida && ` · Salió ${horaAR(f.salida_timestamp)}`}
        </p>
      </div>
      <div className="flex flex-wrap justify-end gap-1.5">
        {f.sin_ficha && <Badge variant="outline" className="text-xs text-muted-foreground">Sin ficha</Badge>}
        {f.tarde && <Badge variant="outline" className="gap-1 border-amber-500/30 bg-amber-500/10 text-amber-400"><Timer className="h-3 w-3" />Tarde</Badge>}
        {f.far && <Badge variant="outline" className="gap-1 border-orange-500/30 bg-orange-500/10 text-orange-400"><MapPinOff className="h-3 w-3" />Fuera del radio · {f.distancia}</Badge>}
        {f.salida_omitida && <Badge variant="outline" className="gap-1 border-red-500/30 bg-red-500/10 text-red-400"><AlertTriangle className="h-3 w-3" />Salida omitida</Badge>}
      </div>
    </div>
  );
}