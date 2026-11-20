import React, { useMemo } from 'react';
import { filtroPorKey } from './filtros';
import GrupoLugar from './GrupoLugar';
import NoVinieronLista from './NoVinieronLista';
import VacioModulo from '@/components/shared/VacioModulo';

export default function HoyLista({ data, filtro }) {
  const f = filtroPorKey(filtro);
  const grupos = useMemo(() => {
    if (!f.fn) return [];
    const map = new Map();
    for (const item of data.fichajes.filter(f.fn)) {
      const k = item.location_name || 'Sin ubicación';
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(item);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'));
  }, [data.fichajes, f]);
  const total = f.fn ? grupos.reduce((n, [, l]) => n + l.length, 0) : data.noVinieron.length;

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">
        {f.label} <span className="text-muted-foreground font-normal tabular-nums">· {total}</span>
      </h2>
      {!f.fn ? (
        <NoVinieronLista data={data} />
      ) : grupos.length === 0 ? (
        <VacioModulo icon={f.icon} titulo="No hay operarios en esta categoría por ahora." texto="Se actualiza solo cada minuto a medida que los operarios fichan." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {grupos.map(([lugar, items]) => <GrupoLugar key={lugar} lugar={lugar} items={items} />)}
        </div>
      )}
    </section>
  );
}