import React from 'react';

export default function FiltrosJefes({ jefes, filtros, onChange, direcciones }) {
  const toggle = (jefe) => {
    const next = new Set(filtros);
    if (next.has(jefe)) next.delete(jefe);
    else next.add(jefe);
    onChange(next);
  };

  const todos = () => onChange(new Set());

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filtrar por jefe</p>
        {filtros.size > 0 && (
          <button onClick={todos} className="text-xs text-primary hover:underline">Ver todos</button>
        )}
      </div>
      {Object.entries(jefes).map(([jefe, color]) => {
        const cant = direcciones.filter(d => d.jefe_sitio === jefe).length;
        const activo = filtros.size === 0 || filtros.has(jefe);
        return (
          <label key={jefe} className={`flex items-center gap-2.5 cursor-pointer group rounded-md px-1 py-0.5 transition-colors ${activo ? '' : 'opacity-40'}`}>
            <input
              type="checkbox"
              checked={filtros.has(jefe)}
              onChange={() => toggle(jefe)}
              className="sr-only"
            />
            <span
              className="h-3.5 w-3.5 rounded-full flex-shrink-0 border-2 border-white ring-1"
              style={{ background: color, boxShadow: `0 0 0 2px ${color}44` }}
            />
            <span className="text-xs flex-1 leading-tight">{jefe}</span>
            <span className="text-[10px] text-muted-foreground font-mono">{cant}</span>
          </label>
        );
      })}
    </div>
  );
}