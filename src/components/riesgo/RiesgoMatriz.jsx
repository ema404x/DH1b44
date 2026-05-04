import React from 'react';
import { getNivelConfig } from '@/pages/ControlRiesgo';

const PROBABILIDADES = ['Muy Alta', 'Alta', 'Media', 'Baja', 'Muy baja'];
const CONSECUENCIAS  = ['Minima', 'Menor', 'Moderada', 'Mayor', 'Maxima'];

const PROB_MAP = { 'Muy Alta': 5, 'Alta': 4, 'Media': 3, 'Baja': 2, 'Muy baja': 1 };
const CONS_MAP = { 'Minima': 1, 'Menor': 2, 'Moderada': 4, 'Mayor': 8, 'Maxima': 16 };

export default function RiesgoMatriz({ riesgos, onSelect }) {
  // Agrupar riesgos por celda (probabilidad × consecuencia)
  const cellMap = {};
  riesgos.forEach(r => {
    const key = `${r.probabilidad}|${r.consecuencia}`;
    if (!cellMap[key]) cellMap[key] = [];
    cellMap[key].push(r);
  });

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Hacé click en una celda para ver los riesgos</p>
      <div className="overflow-x-auto">
        <table className="border-collapse text-xs w-full min-w-[500px]">
          <thead>
            <tr>
              <th className="p-2 text-muted-foreground text-left w-24">Prob. \ Cons.</th>
              {CONSECUENCIAS.map(c => (
                <th key={c} className="p-2 text-center font-semibold text-muted-foreground">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PROBABILIDADES.map(prob => (
              <tr key={prob}>
                <td className="p-2 font-semibold text-muted-foreground border-r border-border">{prob}</td>
                {CONSECUENCIAS.map(cons => {
                  const nivel = (PROB_MAP[prob] || 1) * (CONS_MAP[cons] || 1);
                  const nc = getNivelConfig(nivel);
                  const key = `${prob}|${cons}`;
                  const items = cellMap[key] || [];

                  const bgColors = {
                    aceptable: 'bg-emerald-100 hover:bg-emerald-200',
                    tolerable:  'bg-yellow-100 hover:bg-yellow-200',
                    alto:       'bg-orange-100 hover:bg-orange-200',
                    extremo:    'bg-red-100 hover:bg-red-200',
                  };

                  return (
                    <td key={cons} className="p-1 text-center border border-border/30">
                      <div
                        className={`rounded-lg p-2 min-h-[56px] flex flex-col items-center justify-center transition-all
                          ${bgColors[nc.key]}
                          ${items.length > 0 ? 'cursor-pointer shadow-sm' : 'opacity-60'}`}
                        onClick={() => items.length > 0 && onSelect(items[0])}
                      >
                        <span className="font-bold text-base">{nivel}</span>
                        {items.length > 0 && (
                          <span className="mt-1 rounded-full bg-white/80 text-[10px] font-bold px-1.5 py-0.5 leading-none">
                            {items.length}
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-3 text-xs">
        {[
          { label: 'Aceptable (<4)',     bg: 'bg-emerald-200' },
          { label: 'Tolerable (4-15)',   bg: 'bg-yellow-200' },
          { label: 'Alto (16-31)',        bg: 'bg-orange-200' },
          { label: 'Extremo (≥32)',       bg: 'bg-red-200' },
        ].map(({ label, bg }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-3.5 h-3.5 rounded ${bg}`} />
            <span className="text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}