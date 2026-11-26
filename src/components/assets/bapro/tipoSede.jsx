import React from 'react';

export const TIPO_SEDE = {
  propia: { label: 'Propia', color: null },
  tercerizada: { label: 'Tercerizada', color: '#8b5cf6' },
  costa: { label: 'Costa Atlántica', color: '#ec4899' },
};

export const colorTipoSede = (tipo) => TIPO_SEDE[tipo]?.color || null;

/** Punto de color del tipo de sede (nada si es propia/vacío). */
export function SedeDot({ tipo, className = '' }) {
  const color = colorTipoSede(tipo);
  if (!color) return null;
  return <span title={TIPO_SEDE[tipo].label} className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${className}`} style={{ background: color }} />;
}

/** Punto de color + etiqueta corta. */
export function SedeBadge({ tipo }) {
  const color = colorTipoSede(tipo);
  if (!color) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium" style={{ color }}>
      <SedeDot tipo={tipo} />{TIPO_SEDE[tipo].label}
    </span>
  );
}