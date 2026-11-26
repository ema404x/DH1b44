import { useMemo } from 'react';
import { textoBusquedaActivo, tokensBusqueda } from '@/components/assets/bapro/sedesBapro';

/**
 * Aplica búsqueda, tipo y estado (base), cuenta activos por sede sobre esa base
 * y después filtra por la sede elegida.
 */
export function useFiltroBapro(assets, sedes, f) {
  const nombrePorId = useMemo(() => new Map(sedes.map(s => [s.id, s.nombre])), [sedes]);
  const indice = useMemo(
    () => new Map(assets.map(a => [a.id, textoBusquedaActivo(a, nombrePorId.get(a.location_id))])),
    [assets, nombrePorId]
  );

  return useMemo(() => {
    const tokens = tokensBusqueda(f.q);
    const base = assets.filter(a =>
      (f.tipo === 'all' || a.type === f.tipo) &&
      (f.estado === 'all' || a.status === f.estado) &&
      (tokens.length === 0 || tokens.every(t => (indice.get(a.id) || '').includes(t)))
    );
    const conteos = {};
    for (const a of base) if (a.location_id) conteos[a.location_id] = (conteos[a.location_id] || 0) + 1;
    const filtrado = f.sede === 'all' ? base : base.filter(a => a.location_id === f.sede);
    const activosSede = f.sede === 'all' ? assets : assets.filter(a => a.location_id === f.sede);
    return { base, conteos, filtrado, activosSede };
  }, [assets, indice, f.q, f.tipo, f.estado, f.sede]);
}