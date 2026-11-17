/**
 * offlinePreload — precarga en segundo plano para el "Modo sin conexión (beta)".
 * Solo la dispara AuthContext cuando el usuario tiene offline_habilitado === true
 * y hay red. Corre una sola vez por sesión, 10 s después de cargar la app.
 * Todos los errores se ignoran en silencio.
 */
import { base44 } from '@/api/base44Client';
import { queryClientInstance } from '@/lib/query-client';

let started = false;

export function scheduleOfflinePreload({ user, userPermissions }) {
  if (started || !user?.id) return;
  started = true;
  setTimeout(() => { runPreload(user, userPermissions).catch(() => {}); }, 10000);
}

async function runPreload(user, userPermissions) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  // 1) Código de las páginas: al pedirlas, el Service Worker guarda sus archivos.
  [
    () => import('@/pages/PortalOperarioApp'),
    () => import('@/pages/WorkOrders'),
    () => import('@/components/workorders/WorkOrderDetailPanel'),
    () => import('@/pages/Dashboard'),
  ].forEach((load) => { load().catch(() => {}); });

  // 2) OTs del usuario: misma consulta y misma clave que usa /ordenes, así
  //    queda en el caché persistido existente ('workorders-board').
  const employeeRole = userPermissions?._employeeRole || null;
  const employeeSector = userPermissions?._employeeSector || null;
  const activeSector = user?.data?.sector_id || employeeSector || user?.sector_id || null;
  const boardKey = ['workorders-board', user.id, activeSector, employeeRole];

  await queryClientInstance.prefetchQuery({
    queryKey: boardKey,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const res = await base44.functions.invoke('getWorkOrdersForUser', {});
      if (res.data?.error) throw new Error(res.data.error);
      if (!res.data?.ctx || !Array.isArray(res.data?.orders)) {
        throw new Error('No se pudo resolver el sector o cargar las órdenes.');
      }
      return res.data;
    },
  });

  // 3) Mis Órdenes lee su respaldo de este mismo almacenamiento local.
  const orders = queryClientInstance.getQueryData(boardKey)?.orders;
  if (Array.isArray(orders)) {
    try {
      localStorage.setItem(`mis-ots-cache-${user.id}`, JSON.stringify({ orders, cachedAt: Date.now() }));
    } catch (_) { /* silencioso */ }
  }
}