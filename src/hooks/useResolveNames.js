/**
 * useResolveNames
 *
 * Hook que resuelve nombres de usuario a partir del cache de empleados.
 * Si el valor es un email, lo reemplaza con el full_name del empleado correspondiente.
 * Si no es un email o no se encuentra empleado, retorna el valor original.
 *
 * Uso:
 *   const { resolve, resolveAll } = useResolveNames();
 *   resolve('juan@ejemplo.com')      // → 'Juan Pérez'
 *   resolve('Juan Pérez')            // → 'Juan Pérez' (sin cambios)
 *   resolveAll(['a@b.com', 'Carlos']) // → ['Ana García', 'Carlos']
 */
import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { resolveDisplayName } from '@/lib/utils';

export function useResolveNames() {
  const queryClient = useQueryClient();

  const employees = useMemo(() => {
    return queryClient.getQueryData(['employees']) || [];
  }, [queryClient]);

  const resolve = (nameOrEmail, fallback) => {
    return resolveDisplayName(nameOrEmail, employees, fallback);
  };

  const resolveAll = (list = []) => {
    return list.map(item => resolveDisplayName(item, employees, item));
  };

  return { resolve, resolveAll, employees };
}