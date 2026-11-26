import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

const DEFAULTS = { sede: 'all', q: '', tipo: 'all', estado: 'all', p: 1 };

/** Sede, búsqueda, tipo, estado y página guardados en la URL (?sede=&q=&tipo=&estado=&p=). */
export function useCatalogoBaproUrl() {
  const [params, setParams] = useSearchParams();
  const filtros = {
    sede: params.get('sede') || DEFAULTS.sede,
    q: params.get('q') || DEFAULTS.q,
    tipo: params.get('tipo') || DEFAULTS.tipo,
    estado: params.get('estado') || DEFAULTS.estado,
    p: Math.max(1, parseInt(params.get('p'), 10) || 1),
  };

  // Cualquier cambio que no sea de página vuelve a la página 1.
  const actualizar = useCallback((cambios) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      const merged = 'p' in cambios ? cambios : { ...cambios, p: 1 };
      for (const [k, v] of Object.entries(merged)) {
        if (v === undefined || v === null || v === DEFAULTS[k]) next.delete(k);
        else next.set(k, String(v));
      }
      return next;
    }, { replace: true });
  }, [setParams]);

  return [filtros, actualizar];
}