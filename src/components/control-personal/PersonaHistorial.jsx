import React from 'react';
import { Badge } from '@/components/ui/badge';
import { fechaAR, horaAR, duracion } from './formato';

const ADMIN = {
  pendiente: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  revisado: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  incidencia: 'border-red-500/30 bg-red-500/10 text-red-400',
};

export default function PersonaHistorial({ items, total }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Historial de fichajes {total > items.length && `(últimos ${items.length})`}
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Sin fichajes en el período.</p>
      ) : (
        <div className="rounded-2xl border border-border/60 divide-y divide-border/40 overflow-hidden">
          {items.map((f) => (
            <div key={f.id} className="flex items-center gap-3 px-3.5 py-2.5 text-xs">
              <div className="w-20 shrink-0">
                <p className="font-semibold capitalize">{fechaAR(f.entrada_timestamp)}</p>
                <p className="text-muted-foreground tabular-nums">{horaAR(f.entrada_timestamp)}–{f.salida_omitida ? '?' : horaAR(f.salida_timestamp)}</p>
              </div>
              <p className="flex-1 min-w-0 truncate text-muted-foreground">{f.location_name}</p>
              <div className="flex flex-wrap justify-end gap-1">
                {f.tarde && <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-400">Tarde</Badge>}
                {f.far && <Badge variant="outline" className="border-orange-500/30 bg-orange-500/10 text-orange-400">Fuera del radio</Badge>}
                {f.salida_omitida
                  ? <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-400">Salida omitida</Badge>
                  : <span className="tabular-nums font-medium">{duracion(f.entrada_timestamp, f.salida_timestamp) || 'En curso'}</span>}
                <Badge variant="outline" className={ADMIN[f.estado_admin] || ADMIN.pendiente}>{f.estado_admin}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}