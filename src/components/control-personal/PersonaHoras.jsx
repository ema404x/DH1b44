import React from 'react';
import { horasTexto, fechaCorta, mesTexto } from './formato';

function Barras({ titulo, filas }) {
  const max = Math.max(1, ...filas.map((f) => f.minutos));
  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-4 space-y-2.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</p>
      {filas.map((f) => (
        <div key={f.key} className="flex items-center gap-3 text-xs">
          <span className="w-24 shrink-0 text-muted-foreground truncate first-letter:uppercase">{f.label}</span>
          <div className="flex-1 h-2.5 rounded-full bg-muted/60 overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${(f.minutos / max) * 100}%` }} />
          </div>
          <span className="w-16 text-right tabular-nums font-medium">{horasTexto(f.minutos)}</span>
        </div>
      ))}
    </div>
  );
}

export default function PersonaHoras({ semanas, meses }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <Barras titulo="Horas por semana" filas={semanas.map((s) => ({ key: s.inicio, label: `Sem. ${fechaCorta(s.inicio)}`, minutos: s.minutos }))} />
      <Barras titulo="Horas por mes" filas={meses.map((m) => ({ key: m.mes, label: mesTexto(m.mes), minutos: m.minutos }))} />
    </div>
  );
}