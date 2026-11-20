import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';

/** admin y gerente ven todos los activos del sector; el resto, solo los suyos (servidor). */
export function useVeTodosLosActivos() {
  const { user } = useCurrentUser();
  return user?.role === 'admin' || user?.role === 'gerente';
}

/** Activos propios del caller según la regla del servidor (getActivosSector). */
export async function fetchActivosPropios() {
  const res = await base44.functions.invoke('getActivosSector');
  return res.data?.assets || [];
}

/** Lista de la pantalla Activos y de la ficha (misma clave de caché 'assets'). */
export function useActivosVisibles() {
  const veTodo = useVeTodosLosActivos();
  return useQuery({
    queryKey: veTodo ? ['assets'] : ['assets', 'propios'],
    queryFn: veTodo ? () => base44.entities.Asset.list('-updated_date', 500) : fetchActivosPropios,
  });
}