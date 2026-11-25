import React from 'react';
import { LogOut, MapPin, ScanLine } from 'lucide-react';
import { horaAR, duracion, useAhoraMinuto } from '@/components/fichar-cuenta/jornadaTiempo';

/** Contenido de la tarjeta de fichaje cuando hay una jornada abierta. */
export default function JornadaAbiertaCard({ abierta, onSalida, onEscanear }) {
  const now = useAhoraMinuto();
  return (
    <>
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15">
          <MapPin className="h-6 w-6 text-amber-400" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-card-foreground">Estás trabajando</h2>
          <p className="truncate text-sm text-muted-foreground">{abierta.location_name || 'Lugar sin nombre'}</p>
          <p className="text-sm text-muted-foreground">
            Entrada {horaAR(abierta.entrada_timestamp)} · hace {duracion(abierta.entrada_timestamp, now)}
          </p>
        </div>
      </div>
      <button
        onClick={onSalida}
        className="mt-5 flex h-20 w-full items-center justify-center gap-3 rounded-2xl bg-amber-500 text-xl font-bold text-slate-950 shadow-lg shadow-amber-500/25 transition-transform active:scale-[0.97]"
      >
        <LogOut className="h-7 w-7" />
        Registrar salida
      </button>
      <button onClick={onEscanear} className="mx-auto mt-3 flex items-center gap-1.5 text-sm font-medium text-muted-foreground underline-offset-4 hover:underline">
        <ScanLine className="h-4 w-4" /> Escanear otro QR
      </button>
    </>
  );
}