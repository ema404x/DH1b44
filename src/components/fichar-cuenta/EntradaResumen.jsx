import React from 'react';
import { horaAR, duracion, useAhoraMinuto } from '@/components/fichar-cuenta/jornadaTiempo';

/** "Entraste a las HH:MM · llevás X h Y min" (pantalla de salida). */
export default function EntradaResumen({ entrada }) {
  const now = useAhoraMinuto();
  return (
    <p className="mt-3 text-center text-sm font-medium text-amber-400">
      Entraste a las {horaAR(entrada)} · llevás {duracion(entrada, now)}
    </p>
  );
}