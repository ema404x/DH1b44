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
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { resolveDisplayName } from '@/lib/utils';

export function useResolveNames() {
  // useQuery subscribe al cache — se actualiza cuando llegan los empleados
  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list('-updated_date', 200),
    staleTime: 120000,
  });

  const resolve = (nameOrEmail, fallback) => {
    return resolveDisplayName(nameOrEmail, employees, fallback);
  };

  const resolveAll = (list = []) => {
    return list.map(item => resolveDisplayName(item, employees, item));
  };

  return { resolve, resolveAll, employees };
}