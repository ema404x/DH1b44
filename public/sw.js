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

const CACHE_NAME = 'dh1-erp-v3';
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
  // JS/CSS de mismo origen (módulos Vite compilados con hash)
  if (!isSameOrigin(url)) return false;
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
async function handleStaleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  // Fetch en background para actualizar el caché (sin bloquear la respuesta).
  const networkFetch = fetch(request)
    .then((networkResponse) => {
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

  // Sin caché: esperar la red. Si la red también falla, 504 controlado.
  const networkResponse = await networkFetch;
  if (networkResponse && isCacheable(networkResponse)) {
    return networkResponse;
  }

  return new Response('', {
    status: 504,
    statusText: 'Gateway Timeout (offline, sin caché)',
    headers: { 'Content-Type': 'text/plain' },
  });
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
      // Limpiar TODOS los cachés que no sean el actual (v2 → v3, etc.)
      const allCaches = await caches.keys();
      await Promise.all(
        allCaches
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name).catch(() => {}))
      );
      // clients.claim() toma control de las pestañas existentes para que
      // controllerchange dispare en usePWA.js (que hace el reload con flag
      // anti-doble). NO se usa client.navigate() para no interrumpir
      // formularios en progreso.
      await self.clients.claim();
    })()
  );
});

// ── Evento: FETCH (interceptar requests según estrategia) ────────────────────
self.addEventListener('fetch', (event) => {
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
    return;
  }

  // 2. JS/CSS de mismo origen → SWR
  if (isStaticAsset(url, request)) {
    event.respondWith(handleStaleWhileRevalidate(request));
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
