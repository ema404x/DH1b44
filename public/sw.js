// DH1 ERP — Service Worker v1.0
const CACHE_NAME = 'dh1-erp-v1';
const OFFLINE_URL = '/offline.html';

// Recursos que se cachean en la instalación
const PRECACHE_ASSETS = [
  '/',
  '/ordenes',
  '/offline.html',
];

// ── Instalación ──────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch(() => {
        // Si falla algún asset, continuar igual
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting();
});

// ── Activación ───────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Estrategia de fetching ───────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requests no-GET, extensiones de Chrome, y llamadas a la API
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;
  if (url.pathname.startsWith('/api/') || url.hostname.includes('base44')) return;

  // Para navegación: Network-first con fallback a cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          return res;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  // Para assets JS/CSS/fonts: Stale-While-Revalidate
  if (
    url.pathname.match(/\.(js|css|woff2?|png|jpg|svg|ico)$/) ||
    url.pathname.startsWith('/assets/')
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          const networkFetch = fetch(request).then((res) => {
            cache.put(request, res.clone());
            return res;
          });
          return cached || networkFetch;
        })
      )
    );
    return;
  }
});

// ── Background Sync: cola de OTs offline ────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-work-orders') {
    event.waitUntil(syncWorkOrders());
  }
});

async function syncWorkOrders() {
  const db = await openDB();
  const pendingOrders = await getAllPending(db);

  for (const item of pendingOrders) {
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: { 'Content-Type': 'application/json', ...item.headers },
        body: item.body,
      });

      if (response.ok) {
        await deletePending(db, item.id);
        // Notificar a los clientes activos
        const clients = await self.clients.matchAll();
        clients.forEach((client) =>
          client.postMessage({ type: 'SYNC_SUCCESS', orderId: item.localId })
        );
      }
    } catch (err) {
      // Dejar en cola para el próximo intento
      console.log('[SW] Sync failed for', item.localId, '— will retry');
    }
  }
}

// ── IndexedDB helpers ────────────────────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('dh1-offline-queue', 1);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore('pending', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

function getAllPending(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending', 'readonly');
    const req = tx.objectStore('pending').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function deletePending(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending', 'readwrite');
    const req = tx.objectStore('pending').delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── Push notifications ───────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'DH1 ERP', {
      body: data.body || '',
      icon: 'https://media.base44.com/images/public/69bc7d2a6f0e7ed160c90003/7a2959dd1_image.png',
      badge: 'https://media.base44.com/images/public/69bc7d2a6f0e7ed160c90003/7a2959dd1_image.png',
      data: { url: data.url || '/' },
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.openWindow(event.notification.data?.url || '/')
  );
});
