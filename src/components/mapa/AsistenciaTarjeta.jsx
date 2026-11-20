import React from 'react';
import { format } from 'date-fns';
import { AlertTriangle, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const fmt = (ts) => (ts ? format(new Date(ts), 'dd/MM/yy HH:mm') : '—');

// Versión en tarjeta de una fila de Asistencias, para pantallas angostas.
// Recibe los valores ya calculados por el panel: muestra los mismos datos y la misma acción.
export default function AsistenciaTarjeta({ fichaje: f, omitida, duracion, distancia, estadoAdmin, metodo, distanciaBadge, onVer }) {
  return (
    <div role="button" tabIndex={0} onClick={onVer}
      className="rounded-xl border border-border/60 bg-card p-3.5 space-y-2.5 active:bg-accent/30">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{f.operario_nombre || '—'}</p>
          <p className="text-xs text-muted-foreground tabular-nums">DNI {f.dni || '—'}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" aria-label="Ver detalle"
          onClick={(e) => { e.stopPropagation(); onVer(); }}>
          <Eye className="h-4 w-4" />
        </Button>
      </div>
      <div className={`text-xs ${distancia.status === 'far' ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
        <span className="block truncate">{f.location_name || '—'}</span>
        {distancia.status === 'far' && <span className="flex items-center gap-1 mt-0.5"><AlertTriangle className="h-3 w-3 shrink-0" />Ubicación no coincide</span>}
      </div>
      <dl className="grid grid-cols-3 gap-2 text-xs tabular-nums">
        <div><dt className="text-muted-foreground">Entrada</dt><dd>{fmt(f.entrada_timestamp)}</dd></div>
        <div>
          <dt className="text-muted-foreground">Salida</dt>
          <dd>{omitida ? <span className="text-red-400 font-semibold">Jamás fichó salida</span> : fmt(f.salida_timestamp)}</dd>
          {omitida && f.salida_timestamp && <dd className="text-[11px] text-muted-foreground">Cierre auto: {fmt(f.salida_timestamp)}</dd>}
        </div>
        <div><dt className="text-muted-foreground">Duración</dt><dd>{omitida ? <span className="text-red-400">Sin salida</span> : duracion}</dd></div>
      </dl>
      <div className="flex flex-wrap items-center gap-1.5">
        {distanciaBadge}
        {omitida ? (
          <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-400 gap-1"><AlertTriangle className="h-3 w-3" /> Salida omitida</Badge>
        ) : (
          <Badge variant="outline" className={f.estado === 'abierta' ? 'border-blue-500/30 bg-blue-500/10 text-blue-400' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'}>
            {f.estado === 'abierta' ? 'Abierta' : 'Cerrada'}
          </Badge>
        )}
        <Badge variant="outline" className={estadoAdmin.class}>{estadoAdmin.label}</Badge>
        <span className={`text-[11px] font-medium ${metodo !== 'QR público' ? 'text-primary' : 'text-muted-foreground'}`}>{metodo}</span>
      </div>
    </div>
  );
}