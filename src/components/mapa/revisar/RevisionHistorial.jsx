import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, Loader2 } from 'lucide-react';
import { revisarUbicaciones, coordTexto } from './api';

const ENT = { LocationData: 'Colegio', LocationQR: 'Fichaje' };
const fecha = (v) => (v ? new Date(v).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '');

export default function RevisionHistorial() {
  const { data, isLoading } = useQuery({ queryKey: ['revisar-ubicaciones', 'historial'], queryFn: () => revisarUbicaciones('historial') });
  return (
    <div className="rounded-2xl border border-border/60 bg-card">
      <p className="flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b border-border/40"><History className="h-4 w-4" /> Últimos cambios</p>
      {isLoading ? <div className="p-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
        : !data?.items?.length ? <p className="px-4 py-4 text-xs text-muted-foreground">Todavía no se cambió ninguna ubicación.</p>
          : (
            <div className="divide-y divide-border/40 max-h-72 overflow-y-auto">
              {data.items.map((h) => (
                <div key={h.id} className="px-4 py-2.5 text-xs space-y-0.5">
                  <p className="font-medium">{h.nombre} <span className="text-muted-foreground font-normal">· {ENT[h.entidad]} · {h.modo === 'manual' ? 'a mano' : 'sugerida'}</span></p>
                  <p className="text-muted-foreground tabular-nums">{coordTexto(h.lat_anterior, h.lng_anterior)} → {coordTexto(h.lat_nueva, h.lng_nueva)}</p>
                  <p className="text-muted-foreground">{h.usuario_nombre} · {fecha(h.fecha)}</p>
                </div>
              ))}
            </div>
          )}
    </div>
  );
}