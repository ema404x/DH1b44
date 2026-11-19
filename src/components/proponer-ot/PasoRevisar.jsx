import React from 'react';
import { WifiOff } from 'lucide-react';
import { URGENCIAS } from './PasoUrgencia';

const Fila = ({ label, children, onEdit }) => (
  <button onClick={onEdit} className="flex w-full items-start justify-between gap-3 border-b border-border/60 py-3 text-left last:border-0">
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-base text-foreground">{children}</div>
    </div>
    <span className="shrink-0 text-sm font-medium text-primary">Cambiar</span>
  </button>
);

// Paso 5: resumen antes de enviar. Tocar una fila vuelve a ese paso.
export default function PasoRevisar({ datos, irA, offline }) {
  const urg = URGENCIAS.find((u) => u.key === datos.prioridad);
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-card px-4">
        <Fila label="Dónde" onEdit={() => irA(1)}>{datos.lugar?.nombre}</Fila>
        <Fila label="Qué pasa" onEdit={() => irA(2)}>
          <span className="font-semibold">{datos.titulo}</span>
          {datos.descripcion && <span className="mt-1 block text-sm text-muted-foreground line-clamp-3">{datos.descripcion}</span>}
        </Fila>
        <Fila label="Fotos" onEdit={() => irA(3)}>{datos.fotos.length ? `${datos.fotos.length} foto(s)` : 'Sin fotos'}</Fila>
        <Fila label="Urgencia" onEdit={() => irA(4)}>{urg?.label}</Fila>
      </div>
      {offline && (
        <p className="flex items-center gap-2 rounded-xl bg-amber-500/15 px-3 py-2 text-sm text-amber-300">
          <WifiOff className="h-4 w-4 shrink-0" /> Sin conexión: se guarda y se envía sola cuando vuelva la señal.
        </p>
      )}
    </div>
  );
}