/* ═══════════════════════════════════════════════════════════════════════════
 * DH1 ERP — Service Worker v3.0 (SWR + Offline App Shell)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * PROPÓSITO
 *   Reduce el consumo de datos en conexiones lentas y permite que la app
 *   abra y funcione sin conexión. Cachea el app shell (HTML, JS compilado,
 *   CSS, fuentes, imágenes). Las llamadas a la API del backend NO se cachean
 *   — las maneja React Query (offlineFirst) + IndexedDB (persistCache.js),
 *   que ya tienen lógica de invalidación coordinada.
 *
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │  CAPA 1 (datos):     React Query + IndexedDB — persistCache.js  │
 *   │  CAPA 2 (código):    este Service Worker — Cache API del SW     │
 *   │  CAPA 3 (mutaciones): offlineSync.js — cola + replay            │
 *   └─────────────────────────────────────────────────────────────────┘
 *
 * ESTRATEGIAS DE CACHÉ POR TIPO DE REQUEST
 *   1. Navegación (mode='navigate') → network-first con fallback a caché.
 *      Si hay red, sirve HTML fresco y lo cachea para fallback offline.
 *      Si no hay red, sirve el último HTML cacheado o /offline.html.
 *   2. JS/CSS/fuentes/imágenes (GET same-origin y cross-origin) →
 *      stale-while-revalidate. Sirve el caché instantáneo y revalida en
 *      background. Máxima reducción de consumo (~80% en sesiones repetidas).
 *   3. API (/api/, /functions/, /auth/) → PASSTHROUGH PURO. No se
 *      interceptan, no se cachean. React Query + IndexedDB manejan los
 *      datos con su propia lógica de staleTime/gcTime/refetchOnMount.
 *   4. Mutaciones (POST/PUT/DELETE) → passthrough. La cola offline
 *      (offlineSync.js + localStorage) las maneja.
 *
 * BUG CRÍTICO CORREGIDO (v2 → v3)
 *   El v2 usaba `url.hostname.includes('base44')` para excluir llamadas a
 *   la API. Como la app está en dh1-mejores.base44.app, TODOS los requests
 *   same-origin (HTML, JS, CSS) matcheaban y pasaban directo → el SW era
 *   inerte. Ahora se usa pathname: `/api/`, `/functions/`, `/auth/`.
 *
 * RESPUESTAS OPACAS (cross-origin no-cors)
 *   Las imágenes de Unsplash y las fuentes de Google se cargan con mode
 *   'no-cors'. Su response.ok es false (status 0), pero la Cache API las
 *   almacena y el navegador las usa para <img>/<link>. isCacheable() las
 *   acepta — sin esto, no se cachearían y el SW no reduciría consumo.
 *
 * ACTUALIZACIONES (skipWaiting + clients.claim + controllerchange)
 *   El SW usa skipWaiting() en install + clients.claim() en activate. La
 *   recarga al deploy la maneja ÚNICAMENTE usePWA.js vía 'controllerchange'
 *   (con flag anti-doble-reload 'refreshing'). NO se usa client.navigate()
 *   para no interrumpir formularios en progreso.
 * ═══════════════════════════════════════════════════════════════════════════ */

const CACHE_NAME = 'dh1-erp-v6';

// Caché ESTABLE (sin número de versión) para /assets/* (JS/CSS con hash).
// No se borra al activar una versión nueva: una pestaña abierta con la versión
// anterior sigue encontrando sus archivos. Solo se poda por antigüedad/cantidad.
const ASSETS_CACHE = 'dh1-assets';
const ASSETS_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const ASSETS_MAX_ENTRIES = 300;
const ASSETS_TOUCH_MS = 24 * 60 * 60 * 1000;
const ASSETS_PRUNE_EVERY_MS = 60 * 60 * 1000;
const STAMP_HEADER = 'X-DH1-Cached-At';
const OFFLINE_URL = '/offline.html';

// Recursos estáticos que se precachean en install. Solo los esenciales
// para que la app monte offline: HTML raíz y página offline.
// Los chunks JS/CSS con hash se cachean runtime (sus nombres cambian en
// cada deploy → precache estático los rompería).
const PRECACHE_URLS = [
  '/',
  '/offline.html',
];

// ── Helpers de URL ───────────────────────────────────────────────────────────

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isBackendApi(url) {
  // Check por PATHNAME, no hostname. Así funciona tanto en base44.app
  // como en un custom domain futuro. Las llamadas al backend van por
  // estas rutas. NO usar hostname.includes('base44') — la app misma
  // está en base44.app y eso excluiría TODOS los requests same-origin.
  const p = url.pathname;
  return p.startsWith('/api/') || p.startsWith('/functions/') || p.startsWith('/auth/');
}

function isStaticAsset(url, request) {
  // JS/CSS de mismo origen (módulos Vite compilados con hash; excluir rutas dev de Vite)
  if (!isSameOrigin(url)) return false;
  if (
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.startsWith('/@')
  ) {
    return false;
  }
  const dest = request.destination;
  if (dest === 'script' || dest === 'style') return true;
  return /\.(js|mjs|css)(\?|$)/i.test(url.pathname);
}

function isImage(url, request) {
  if (request.destination === 'image') return true;
  return /\.(png|jpg|jpeg|webp|svg|gif|ico|avif)(\?|$)/i.test(url.pathname);
}

function isFont(url) {
  // Fuentes de Google Fonts y archivos de fuente locales
  const host = url.host;
  if (host === 'fonts.googleapis.com' || host === 'fonts.gstatic.com') return true;
  return /\.(woff2?|ttf|eot|otf)(\?|$)/i.test(url.pathname);
}

// ── Helper: ¿es cacheable? (acepta respuestas opacas cross-origin) ──────────
// Las imágenes de Unsplash y las fuentes de Google se cargan con mode 'no-cors'.
// Su response.ok es false y status es 0, pero la Cache API las almacena y el
// navegador las usa para <img>/<link>. Sin este check, no se cachearían.
function isCacheable(response) {
  if (!response) return false;
  return response.ok || response.type === 'opaque';
}

// ── Estrategia: Network-First (para navegación HTML) ─────────────────────────
async function handleNavigation(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone()).catch(() => {});
    }
    return networkResponse;
  } catch (_) {
    // Sin red: servir el último HTML cacheado para esta URL, o el root,
  // o la página offline dedicada como último recurso.
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    const fallback = await cache.match('/') || await cache.match(OFFLINE_URL);
    if (fallback) return fallback;
    return new Response(
      '<h1>Sin conexión</h1><p>La aplicación no está disponible offline en este momento.</p>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

// ── Estrategia: Stale-While-Revalidate (para JS/CSS/fuentes/imágenes) ────────
// noHtml=true (peticiones de JS/CSS): nunca se cachea ni se responde HTML.
async function handleStaleWhileRevalidate(request, noHtml = false) {
  const cache = await caches.open(CACHE_NAME);
  let cached = await cache.match(request);
  if (cached && noHtml && isHtmlResponse(cached)) {
    cache.delete(request).catch(() => {});
    cached = undefined;
  }

  // Fetch en background para actualizar el caché (sin bloquear la respuesta).
  const networkFetch = fetch(request)
    .then((networkResponse) => {
      if (noHtml && isHtmlResponse(networkResponse)) return null;
      if (isCacheable(networkResponse)) {
        cache.put(request, networkResponse.clone()).catch(() => {});
      }
      return networkResponse;
    })
    .catch(() => null);

  // SWR: si hay caché, responderlo instantáneamente y dejar el fetch
  // actualizando en background. Si no hay caché, esperar el fetch.
  if (cached) {
    return cached;
  }

  // Sin caché: esperar la red. Si la red también falla, error controlado.
  const networkResponse = await networkFetch;
  if (networkResponse && isCacheable(networkResponse)) {
    return networkResponse;
  }

  // JS/CSS sin red ni caché: error de red normal (nunca HTML).
  if (noHtml) return Response.error();

  return new Response('', {
    status: 504,
    statusText: 'Gateway Timeout (offline, sin caché)',
    headers: { 'Content-Type': 'text/plain' },
  });
}

// ── Caché estable de /assets/* ───────────────────────────────────────────────

function isHtmlResponse(response) {
  const type = (response && response.headers.get('Content-Type')) || '';
  return type.includes('text/html');
}

function isHashedAsset(url) {
  return isSameOrigin(url) && url.pathname.startsWith('/assets/');
}

// Guarda una copia con la fecha de guardado en un header (para podar por antigüedad).
async function putStamped(cache, request, response) {
  try {
    const headers = new Headers(response.headers);
    headers.set(STAMP_HEADER, String(Date.now()));
    const body = await response.blob();
    await cache.put(request, new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    }));
  } catch (_) {}
}

// Cache-first: los archivos con hash son inmutables. Si no está en caché ni en
// red se devuelve el error normal; nunca index.html ni offline.html.
async function handleHashedAsset(request) {
  const cache = await caches.open(ASSETS_CACHE);
  const cached = await cache.match(request);
  if (cached && !isHtmlResponse(cached)) {
    // Renovar la fecha (como mucho una vez por día) para no podar archivos en uso.
    const at = Number(cached.headers.get(STAMP_HEADER)) || 0;
    if (Date.now() - at > ASSETS_TOUCH_MS) putStamped(cache, request, cached.clone());
    return cached;
  }
  if (cached) cache.delete(request).catch(() => {});

  const networkResponse = await fetch(request);
  if (isHtmlResponse(networkResponse)) {
    return new Response('', { status: 404, statusText: 'Not Found' });
  }
  if (networkResponse.ok) putStamped(cache, request, networkResponse.clone());
  return networkResponse;
}

// Poda: borra los de más de 14 días y, si hay más de 300, los más viejos primero.
async function pruneAssets() {
  const cache = await caches.open(ASSETS_CACHE);
  const requests = await cache.keys();
  const entries = [];
  for (const req of requests) {
    const res = await cache.match(req);
    entries.push({ req, at: Number(res && res.headers.get(STAMP_HEADER)) || 0 });
  }
  entries.sort((a, b) => a.at - b.at);
  const excess = entries.length - ASSETS_MAX_ENTRIES;
  const now = Date.now();
  await Promise.all(
    entries.map((entry, i) =>
      i < excess || now - entry.at > ASSETS_MAX_AGE_MS
        ? cache.delete(entry.req).catch(() => {})
        : null
    )
  );
}

let lastPruneAt = 0;
function maybePruneAssets() {
  if (Date.now() - lastPruneAt < ASSETS_PRUNE_EVERY_MS) return Promise.resolve();
  lastPruneAt = Date.now();
  return pruneAssets().catch(() => {});
}

// ── Evento: INSTALL (precache mínimo del app shell) ──────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Precachear uno por uno para que un fallo individual no bloquee.
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try { await cache.add(url); } catch (_) {}
        })
      );
      await self.skipWaiting();
    })()
  );
});

// ── Evento: ACTIVATE (limpieza de cachés viejos + tomar control) ────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Limpiar los cachés de shell de versiones anteriores, pero SIN perder
      // sus /assets/* (JS/CSS con hash): se pasan al caché estable antes de borrar.
      const allCaches = await caches.keys();
      const assetsCache = await caches.open(ASSETS_CACHE);
      for (const name of allCaches) {
        if (name === CACHE_NAME || name === ASSETS_CACHE) continue;
        try {
          const oldCache = await caches.open(name);
          for (const req of await oldCache.keys()) {
            if (!isHashedAsset(new URL(req.url))) continue;
            if (await assetsCache.match(req)) continue;
            const res = await oldCache.match(req);
            if (res && res.ok && !isHtmlResponse(res)) await putStamped(assetsCache, req, res);
          }
        } catch (_) {}
        await caches.delete(name).catch(() => {});
      }
      await pruneAssets().catch(() => {});
      // clients.claim() toma control de las pestañas existentes para que
      // controllerchange dispare en usePWA.js (que hace el reload con flag
      // anti-doble). NO se usa client.navigate() para no interrumpir
      // formularios en progreso.
      await self.clients.claim();
    })()
  );
});

// ── Evento: FETCH (interceptar requests según estrategia) ────────────────────
const IS_DEV_OR_PREVIEW =
  self.location.hostname.includes('preview') ||
  self.location.hostname.includes('sandbox') ||
  self.location.hostname === 'localhost' ||
  self.location.hostname === '127.0.0.1';

self.addEventListener('fetch', (event) => {
  if (IS_DEV_OR_PREVIEW) return;
  const { request } = event;

  // Solo GET. POST/PUT/DELETE pasan directo (cola offline los maneja).
  if (request.method !== 'GET') return;

  let url;
  try { url = new URL(request.url); } catch (_) { return; }

  // PASSTHROUGH: llamadas a la API del backend — NO cachear.
  if (isBackendApi(url)) return;

  // PASSTHROUGH: data: y blob: URLs
  if (url.protocol === 'data:' || url.protocol === 'blob:') return;

  // PASSTHROUGH: extensiones de Chrome
  if (url.protocol === 'chrome-extension:') return;

  // 1. Navegación (HTML) → Network-First con fallback a caché
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    event.waitUntil(maybePruneAssets());
    return;
  }

  // 2a. /assets/* (JS/CSS con hash) → caché estable, cache-first, nunca HTML
  if (isHashedAsset(url)) {
    event.respondWith(handleHashedAsset(request));
    return;
  }

  // 2b. Otros JS/CSS de mismo origen → SWR, nunca HTML
  if (isStaticAsset(url, request)) {
    event.respondWith(handleStaleWhileRevalidate(request, true));
    return;
  }

  // 3. Fuentes (Google Fonts + locales) → SWR
  if (isFont(url)) {
    event.respondWith(handleStaleWhileRevalidate(request));
    return;
  }

  // 4. Imágenes (Unsplash + subidas + locales) → SWR
  if (isImage(url, request)) {
    event.respondWith(handleStaleWhileRevalidate(request));
    return;
  }
});

// ── Evento: PUSH (Web Push en PC y móvil aun con navegador cerrado) ──────────
self.addEventListener('push', (event) => {
  let payload = {
    title: '📋 DH1 · ¿Cómo vienen con las órdenes de trabajo?',
    body: 'Revisá el avance de las órdenes de trabajo y mantené sus estados actualizados.',
    url: '/ordenes',
    tag: 'dh1-aviso-ot',
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch (_) {
      const text = event.data.text();
      if (text) payload.body = text;
    }
  }

  // Avisar a las pestañas abiertas para mostrar el cartel dentro de la app
  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) =>
    cs.forEach((c) => c.postMessage({ type: 'dh1-push', title: payload.title, body: payload.body, url: payload.url }))
  );

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag || 'dh1-aviso-ot',
      renotify: true,
      requireInteraction: true,
      vibrate: [300, 120, 300, 120, 400],
      data: {
        url: payload.url || '/ordenes',
        date: payload.date || null,
      },
      actions: [
        { action: 'open_ots', title: 'Ver Órdenes de Trabajo' },
      ],
    })
  );
});

// ── Evento: NOTIFICATIONCLICK (Abrir DH1 al tocar la notificación push) ──────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/ordenes';

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      for (const client of windowClients) {
        if (client.url && 'focus' in client) {
          await client.focus();
          if ('navigate' in client) {
            try { await client.navigate(targetUrl); } catch (_) {}
          }
          return;
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })()
  );
});
