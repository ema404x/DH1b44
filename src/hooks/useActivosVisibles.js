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

/** Solo BAPRO: todos los activos del sector, paginando de a 500. */
async function fetchTodosLosActivos() {
  const out = [];
  let cursor;
  do {
    const page = await base44.entities.Asset.list({ sort: '-updated_date', limit: 500, cursor });
    const items = page?.items || [];
    out.push(...items);
    if (!page?.has_more || items.length < 500) break;
    cursor = page.next_cursor;
  } while (cursor);
  return out;
}

/** Lista de la pantalla Activos y de la ficha (misma clave de caché 'assets'). */
export function useActivosVisibles() {
  const veTodo = useVeTodosLosActivos();
  const { user } = useCurrentUser();
  const isBapro = (user?.data?.sector_id || user?.sector_id) === 'bapro';
  const baproTodo = veTodo && isBapro;
  return useQuery({
    queryKey: baproTodo ? ['assets', 'bapro-todo'] : veTodo ? ['assets'] : ['assets', 'propios'],
    queryFn: baproTodo ? fetchTodosLosActivos : veTodo ? () => base44.entities.Asset.list('-updated_date', 500) : fetchActivosPropios,
  });
}