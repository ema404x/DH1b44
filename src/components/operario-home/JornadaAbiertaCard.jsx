import React from 'react';
import { MapPin, ScanLine } from 'lucide-react';
import { horaAR, duracion, useAhoraMinuto } from '@/components/fichar-cuenta/jornadaTiempo';

/** Contenido de la tarjeta de fichaje cuando hay una jornada abierta. */
export default function JornadaAbiertaCard({ abierta, onEscanear }) {
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
        onClick={onEscanear}
        className="mt-5 flex h-20 w-full items-center justify-center gap-3 rounded-2xl bg-amber-500 px-4 text-lg font-bold leading-tight text-slate-950 shadow-lg shadow-amber-500/25 transition-transform active:scale-[0.97]"
      >
        <ScanLine className="h-7 w-7 shrink-0" />
        Escanear QR para registrar salida
      </button>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Escaneá el QR de {abierta.location_name || 'tu lugar de trabajo'} para cerrar tu jornada.
      </p>
    </>
  );
}