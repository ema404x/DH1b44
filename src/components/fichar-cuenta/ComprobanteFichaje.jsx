import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, Home } from 'lucide-react';

const fmt = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export default function ComprobanteFichaje({ resultado, onVolver }) {
  useEffect(() => {
    const t = setTimeout(onVolver, 15000);
    return () => clearTimeout(t);
  }, [onVolver]);

  const esSalida = resultado.tipo === 'salida';
  const j = resultado.jornada || {};
  const hora = esSalida ? j.salida_timestamp : j.entrada_timestamp;
  const lejos = resultado.distancia?.status === 'far';
  const filas = [
    ['Hora', hora ? fmt.format(new Date(hora)) : '—'],
    ['Lugar', resultado.location?.name || j.location_name || '—'],
    ['Distancia', resultado.distancia?.text || '—'],
  ];

  return (
    <div className="space-y-5 acero-rise">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15">
          <CheckCircle2 className="h-11 w-11 text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">{esSalida ? 'Salida registrada' : 'Entrada registrada'}</h1>
        <p className="text-sm text-muted-foreground">{j.operario_nombre}</p>
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
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Fichaste fuera del radio del lugar. Quedó registrado y tu jefe lo va a revisar.
        </p>
      )}
      <button onClick={onVolver} className="flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-bold text-primary-foreground active:scale-[0.98]">
        <Home className="h-5 w-5" /> Volver al inicio
      </button>
    </div>
  );
}