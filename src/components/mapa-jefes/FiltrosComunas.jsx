import React from 'react';

export default function FiltrosComunas({ comunas, colores, filtros, onChange, direcciones }) {
  const toggle = (comuna) => {
    const next = new Set(filtros);
    if (next.has(comuna)) next.delete(comuna);
    else next.add(comuna);
    onChange(next);
  };

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filtrar por comuna</p>
        {filtros.size > 0 && (
          <button onClick={() => onChange(new Set())} className="text-xs text-primary hover:underline">Ver todas</button>
        )}
      </div>
      {comunas.map(com => {
        const color = colores[com] || '#64748b';
        const cant = direcciones.filter(d => d.comuna === com).length;
        const activo = filtros.size === 0 || filtros.has(com);
        return (
          <label key={com} className={`flex items-center gap-2.5 cursor-pointer rounded-md px-1 py-0.5 transition-colors ${activo ? '' : 'opacity-40'}`}>
            <input
              type="checkbox"
              checked={filtros.has(com)}
              onChange={() => toggle(com)}
              className="sr-only"
            />
            <span
              className="h-3.5 w-3.5 rounded-full flex-shrink-0"
              style={{ background: color, boxShadow: `0 0 0 2px ${color}44` }}
            />
            <span className="text-xs flex-1">{com}</span>
            <span className="text-[10px] text-muted-foreground font-mono">{cant}</span>
          </label>
        );
      })}
    </div>
  );
}