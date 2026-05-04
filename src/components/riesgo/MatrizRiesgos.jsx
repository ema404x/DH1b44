import React from 'react';

const PROB = [
  { label: 'Muy Alta', val: 5 },
  { label: 'Alta',     val: 4 },
  { label: 'Media',    val: 3 },
  { label: 'Baja',     val: 2 },
  { label: 'Muy baja', val: 1 },
];

const CONS = [
  { label: 'Mínima',   val: 1 },
  { label: 'Menor',    val: 2 },
  { label: 'Moderada', val: 4 },
  { label: 'Mayor',    val: 8 },
  { label: 'Máxima',   val: 16 },
];

function getCellStyle(score) {
  if (score < 4)  return { bg: '#22c55e', text: '#14532d' }; // verde
  if (score <= 12) return { bg: '#facc15', text: '#713f12' }; // amarillo
  if (score <= 24) return { bg: '#f97316', text: '#7c2d12' }; // naranja
  return { bg: '#dc2626', text: '#fff' };                      // rojo
}

const REFERENCIA = [
  { label: 'Riesgo aceptable', range: '< 4',          bg: '#22c55e', text: '#14532d' },
  { label: 'Riesgo tolerable', range: '≥ 5 y ≤ 12',  bg: '#facc15', text: '#713f12' },
  { label: 'Riesgo Alto',      range: '≥ 16 y ≤ 24', bg: '#f97316', text: '#7c2d12' },
  { label: 'Riesgo extremo',   range: '≥ 32 y ≤ 80', bg: '#dc2626', text: '#fff'    },
];

export default function MatrizRiesgos() {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <h2 className="text-sm font-bold tracking-wide uppercase text-muted-foreground">
        Planilla de Control de Riesgos — Matriz
      </h2>

      <div className="flex flex-wrap gap-8 items-start">
        {/* ── Matriz ── */}
        <div className="overflow-auto">
          <table className="border-collapse text-xs select-none">
            <thead>
              {/* Fila: CONSECUENCIA (header agrupado) */}
              <tr>
                <td colSpan={2} className="border border-border" />
                <th
                  colSpan={5}
                  className="text-center font-bold px-3 py-1.5 border border-border bg-slate-700 text-white tracking-widest uppercase text-[11px]"
                >
                  CONSECUENCIA
                </th>
              </tr>
              {/* Fila: sub-headers */}
              <tr>
                <th className="border border-border px-3 py-1.5 text-left bg-slate-700 text-white font-bold uppercase text-[11px] tracking-wide">
                  PROBABILIDAD
                </th>
                <th className="border border-border px-2 py-1.5 text-center bg-slate-600 text-white font-semibold w-8" />
                {CONS.map(c => (
                  <th
                    key={c.label}
                    className="border border-border px-3 py-1.5 text-center bg-slate-600 text-white font-semibold min-w-[64px]"
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
              {/* Fila: valores consecuencia */}
              <tr>
                <td className="border border-border bg-slate-800" />
                <td className="border border-border bg-slate-800" />
                {CONS.map(c => (
                  <td key={c.val} className="border border-border text-center font-mono font-bold text-white bg-slate-800 py-1">
                    {c.val}
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {PROB.map(p => (
                <tr key={p.label}>
                  <td className="border border-border px-3 py-1.5 font-semibold bg-slate-700 text-white whitespace-nowrap">
                    {p.label}
                  </td>
                  <td className="border border-border text-center font-mono font-bold bg-slate-800 text-white px-2">
                    {p.val}
                  </td>
                  {CONS.map(c => {
                    const score = p.val * c.val;
                    const { bg, text } = getCellStyle(score);
                    return (
                      <td
                        key={c.val}
                        className="border border-border text-center font-bold py-1.5 px-3 text-sm tabular-nums"
                        style={{ background: bg, color: text }}
                      >
                        {score}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Referencia ── */}
        <div className="space-y-2 min-w-[220px]">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Referencia:</p>
          <table className="border-collapse text-xs w-full">
            <thead>
              <tr>
                <th className="border border-border px-3 py-1.5 text-left bg-slate-700 text-white font-semibold">Nivel de riesgo</th>
                <th className="border border-border px-3 py-1.5 text-center bg-slate-700 text-white font-semibold">Color</th>
                <th className="border border-border px-3 py-1.5 text-center bg-slate-700 text-white font-semibold">Rango</th>
              </tr>
            </thead>
            <tbody>
              {REFERENCIA.map(r => (
                <tr key={r.label}>
                  <td className="border border-border px-3 py-1.5 font-medium text-foreground whitespace-nowrap">
                    {r.label}
                  </td>
                  <td className="border border-border px-3 py-1.5 text-center">
                    <span
                      className="inline-block h-4 w-16 rounded"
                      style={{ background: r.bg }}
                    />
                  </td>
                  <td
                    className="border border-border px-3 py-1.5 text-center font-mono font-semibold"
                    style={{ color: r.bg === '#facc15' ? '#92400e' : r.bg }}
                  >
                    {r.range}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}