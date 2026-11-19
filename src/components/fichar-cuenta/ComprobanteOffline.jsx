import React, { useEffect } from 'react';
import { CloudOff, AlertTriangle, Home } from 'lucide-react';

const fmt = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** Comprobante de un fichaje guardado en el teléfono, pendiente de envío. */
export default function ComprobanteOffline({ guardado, onVolver }) {
  useEffect(() => {
    const t = setTimeout(onVolver, 15000);
    return () => clearTimeout(t);
  }, [onVolver]);

  const esSalida = guardado.tipo === 'salida';
  const lejos = guardado.distancia?.status === 'far';
  const filas = [
    ['Tipo', esSalida ? 'Salida' : 'Entrada'],
    ['Hora', fmt.format(new Date(guardado.hora))],
    ['Lugar', guardado.loc.name],
    ['Distancia', guardado.distancia?.text || '—'],
  ];

  return (
    <div className="space-y-5 acero-rise">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/15">
          <CloudOff className="h-11 w-11 text-amber-400" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Guardado en el teléfono</h1>
        <p className="text-sm text-muted-foreground">Se enviará cuando vuelva la señal.</p>
      </div>
      <dl className="divide-y divide-border rounded-2xl border border-border bg-card">
        {filas.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 px-4 py-3.5">
            <dt className="text-sm text-muted-foreground">{k}</dt>
            <dd className="text-right text-sm font-semibold tabular-nums text-card-foreground">{v}</dd>
          </div>
        ))}
      </dl>
      {lejos && (
        <p className="flex items-start gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Estás fuera del radio del lugar. Se va a registrar igual y tu jefe lo va a revisar.
        </p>
      )}
      <button onClick={onVolver} className="flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-bold text-primary-foreground active:scale-[0.98]">
        <Home className="h-5 w-5" /> Volver al inicio
      </button>
    </div>
  );
}