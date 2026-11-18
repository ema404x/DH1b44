import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient, QueryObserver } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { saveCacheEntry } from '@/lib/persistCache';
import { fusionar, compararOrdenes } from '@/lib/ordenesRapidas';
import { useTurnoVerificacion, tomarTurnoHoy, reportarDiferencias } from '@/lib/optimizaciones';

// Clave PROPIA: no comparte caché (ni en memoria ni guardado) con el tablero
// de siempre ('workorders-board').
const CLAVE = 'workorders-rapidas';

async function pedirBoard(payload) {
  const res = await base44.functions.invoke('getWorkOrdersBoard', { fields: 'board', ...payload });
  if (res.data?.error) throw new Error(res.data.error);
  if (!res.data?.ctx) throw new Error('No se pudo resolver el sector o cargar las órdenes.');
  return res.data;
}

// Misma consulta que usa hoy el tablero de siempre.
async function pedirTableroClasico() {
  const res = await base44.functions.invoke('getWorkOrdersForUser', {});
  if (res.data?.error) throw new Error(res.data.error);
  if (!res.data?.ctx || !Array.isArray(res.data?.orders)) {
    throw new Error('No se pudo resolver el sector o cargar las órdenes.');
  }
  return res.data;
}

const armar = (r, orders) => ({
  orders,
  total: r.total,
  archived_count: r.archived_count,
  role: r.role,
  ctx: r.ctx,
  board_fields: r.board_fields,
  since: r.next_since,
});

// Con datos guardados pide solo los cambios y los fusiona; sin datos (o si la
// fusión no cierra) pide todo.
async function cargar(previo) {
  if (previo) {
    const r = await pedirBoard({ since: previo.since });
    if (Array.isArray(r.changed) && Array.isArray(r.ids)) {
      const orders = fusionar(previo.orders, r.changed, r.ids, r.board_fields || []);
      if (orders) return armar(r, orders);
    }
  }
  const r = await pedirBoard({});
  if (!Array.isArray(r.orders)) throw new Error('No se pudo resolver el sector o cargar las órdenes.');
  return armar(r, r.orders);
}

/**
 * Órdenes rápidas (beta). Con activo=false no hace NADA (ninguna consulta).
 *
 * Con activo=true muestra al instante lo guardado y pide en segundo plano solo
 * los cambios. Si además esAdmin, una vez por sesión pide el tablero de
 * siempre y compara; con diferencias, `usarViejo` pasa a true.
 */
export function useOrdenesRapidas({ activo, userId, sector, employeeRole, esAdmin, legacyKey, usuario }) {
  const queryClient = useQueryClient();
  // Resto de los usuarios: la misma verificación, silenciosa, una vez por día.
  const turno = useTurnoVerificacion(userId, 'ordenes', activo && !esAdmin);
  const queryKey = useMemo(() => [CLAVE, userId, sector, employeeRole], [userId, sector, employeeRole]);

  const esMio = (d) =>
    d?.ctx?.userId === userId && d?.ctx?.sector === sector &&
    d?.ctx?.employeeRole === (employeeRole || '') && !d?.ctx?.forceOwnOnly &&
    Array.isArray(d?.orders) && !!d?.since;

  const query = useQuery({
    queryKey,
    enabled: activo,
    initialData: () => {
      const guardado = queryClient.getQueryData([CLAVE]);
      return esMio(guardado) ? guardado : undefined;
    },
    initialDataUpdatedAt: 1,
    queryFn: async () => {
      const actual = queryClient.getQueryData(queryKey);
      const data = await cargar(esMio(actual) ? actual : null);
      saveCacheEntry(CLAVE, data);
      return data;
    },
    staleTime: 30 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Aviso: todo lo que hoy refresca el tablero invalida ['workorders-board']
  // (detalle, arrastre, Campo, crear OT, tiempo real). Esta consulta escucha
  // ese aviso y pide los cambios, sin tocar esas pantallas. No guarda datos.
  // Solo existe mientras Órdenes rápidas está activo.
  useEffect(() => {
    if (!activo) return undefined;
    const aviso = new QueryObserver(queryClient, {
      queryKey: ['workorders-board', 'aviso-ordenes-rapidas'],
      initialData: 0,
      staleTime: Infinity,
      gcTime: 0,
      queryFn: async () => {
        queryClient.invalidateQueries({ queryKey });
        return Date.now();
      },
    });
    return aviso.subscribe(() => {});
  }, [activo, queryClient, queryKey]);

  // Verificación (solo admin): una vez por sesión.
  const listo = activo && (esAdmin || turno) && !!query.data && query.isFetchedAfterMount && !query.isFetching;
  const verifQ = useQuery({
    queryKey: ['ordenes-rapidas-verificacion', userId, sector, employeeRole],
    enabled: listo,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    queryFn: async () => {
      if (!esAdmin && !tomarTurnoHoy(userId, 'ordenes')) return { diferencias: [] };
      try {
        const viejo = await queryClient.fetchQuery({ queryKey: legacyKey, queryFn: pedirTableroClasico, staleTime: 0 });
        await queryClient.refetchQueries({ queryKey, exact: true });
        const nuevo = queryClient.getQueryData(queryKey);
        const diferencias = compararOrdenes(viejo, nuevo);
        if (!esAdmin) reportarDiferencias(usuario, 'ordenes', diferencias);
        return { diferencias };
      } catch {
        return { error: true, diferencias: [] };
      }
    },
  });

  const hayDiferencias = (verifQ.data?.diferencias?.length || 0) > 0;

  let verificacion = null;
  if (activo && esAdmin && query.data) {
    if (!verifQ.data) verificacion = { estado: 'verificando', diferencias: [] };
    else if (verifQ.data.error) verificacion = { estado: 'error', diferencias: [] };
    else verificacion = { estado: hayDiferencias ? 'diferencias' : 'ok', diferencias: verifQ.data.diferencias };
  }

  return { queryKey, query, usarViejo: activo && hayDiferencias, verificacion };
}