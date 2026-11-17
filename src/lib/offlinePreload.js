/**
 * offlinePreload — precarga en segundo plano para el "Modo sin conexión (beta)".
 * Solo la dispara AuthContext cuando el usuario tiene offline_habilitado === true
 * y hay red. Corre una sola vez por sesión, 10 s después de cargar la app.
 * Todos los errores se ignoran en silencio.
 */
import { base44 } from '@/api/base44Client';
import { queryClientInstance } from '@/lib/query-client';
import { pageLoaders } from '@/lib/lazyPages';

let started = false;

export function scheduleOfflinePreload({ user, userPermissions }) {
  if (started || !user?.id) return;
  started = true;
  setTimeout(() => { runPreload(user, userPermissions).catch(() => {}); }, 10000);
}

// Al pedir cada pantalla, el Service Worker guarda sus archivos. Se hace de a 3,
// con una pausa entre tandas, y una sola vez por versión publicada: la URL de
// este archivo ya compilado cambia con cada publicación.
const PRELOADED_KEY = 'dh1_offline_pages_preloaded';
const BUNDLE_ID = import.meta.url;
const BATCH_SIZE = 3;
const BATCH_PAUSE_MS = 1500;

async function preloadPages() {
  try {
    if (localStorage.getItem(PRELOADED_KEY) === BUNDLE_ID) return;
  } catch (_) { /* silencioso */ }

  const loaders = [
    ...Object.values(pageLoaders),
    () => import('@/components/workorders/WorkOrderDetailPanel'),
  ];
  let allOk = true;
  for (let i = 0; i < loaders.length; i += BATCH_SIZE) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    const results = await Promise.allSettled(loaders.slice(i, i + BATCH_SIZE).map((load) => load()));
    if (results.some((r) => r.status === 'rejected')) allOk = false;
    await new Promise((resolve) => setTimeout(resolve, BATCH_PAUSE_MS));
  }
  // Si alguna falló, no se marca: se reintenta en la próxima apertura con red.
  if (!allOk) return;
  try { localStorage.setItem(PRELOADED_KEY, BUNDLE_ID); } catch (_) { /* silencioso */ }
}

async function runPreload(user, userPermissions) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  // 1) Código de TODAS las pantallas (en segundo plano, no bloquea lo demás).
  preloadPages().catch(() => {});

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