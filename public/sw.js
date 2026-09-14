/* ═══════════════════════════════════════════════════════════════════════════
 * DH1 ERP — Service Worker (PWA Offline Completo)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * PROPÓSITO
 *   Reduce el consumo de datos en conexiones lentas y permite que la app
 *   abra y funcione completamente sin conexión. Cachea el app shell (HTML,
 *   JS compilado, CSS, fuentes) e imágenes. Las llamadas a la API del backend
 *   NO se cachean — las maneja React Query (offlineFirst) + IndexedDB
 *   (persistCache.js / useSmartCache.js), que ya tienen lógica de
 *   invalidación y stale-while-revalidate a nivel de datos.
 *
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │  CAPA 1 (datos):     React Query + IndexedDB — persistCache.js  │
 *   │  CAPA 2 (código):    este Service Worker — Cache API del SW     │
 *   │  CAPA 3 (mutaciones): offlineSync.js — cola + replay            │
 *   └─────────────────────────────────────────────────────────────────┘
 *
 * ESTRATEGIAS DE CACHÉ POR TIPO DE REQUEST
 *   1. Navegación (mode='navigate') → network-first, fallback a index.html
 *      cacheado. Si hay red, sirve la versión fresca del HTML; si no hay red,
 *      sirve el app shell cacheado para que la app monte offline.
 *   2. JS/CSS de mismo origen (módulos Vite con hash) → stale-while-revalidate.
 *      Sirve el caché instantáneo y revalida en background. Los nombres con
 *      hash cambian en cada deploy, así que no hay riesgo de servir JS viejo
 *      — el nuevo HTML referenciará los nuevos hashes y el caché viejo se
 *      evicta naturalmente por desuso.
 *   3. Fuentes de Google Fonts (fonts.googleapis.com / fonts.gstatic.com) →
 *      cache-first con expiración de 30 días. Las fuentes son estáticas y
 *      rara vez cambian; cache-first evita un round-trip en cada carga.
 *   4. Imágenes (png/jpg/jpeg/webp/svg/gif/ico/avif) de cualquier origen →
 *      stale-while-revalidate con maxAge 30 días. Incluye fotos de Unsplash
 *      y fotos subidas (UploadPublicFile). En señal baja, servir desde caché
 *      sin re-validar evita el spinner infinito.
 *   5. Llamadas a /api/ o /functions/ del backend → PASSTHROUGH PURO.
 *      No se interceptan, no se cachean. React Query + IndexedDB manejan
 *      los datos con su propia lógica de staleTime, gcTime, refetchOnMount.
 *      Cachearlas aquí duplicaría datos y rompería la consistencia (un POST
 *      no se puede cachear; un GET cacheado aquí envejecería sin invalidación
 *      coordinada con React Query).
 *
 * VERSIONADO DE CACHÉ
 *   Los cachés tienen sufijo -vN. Al cambiar la versión, el evento 'activate'
 *   elimina los cachés viejos. Esto fuerza la limpieza sin depender de
 *   expiración manual.
 *
 * ACTUALIZACIONES (skipWaiting + clients.claim + controllerchange)
 *   El SW usa self.skipWaiting() en 'install' para activarse inmediatamente,
 *   y self.clients.claim() en 'activate' para tomar control de las pestañas
 *   abiertas. usePWA.js (líneas 37-44) escucha 'controllerchange' y dispara
 *   window.location.reload(). Así, al publicar una nueva versión, el usuario
 *   pasa automáticamente a la nueva versión. El flag 'refreshing' en usePWA.js
 *   previene recargas dobles.
 *
 * RESPUESTAS OPACAS (cross-origin no-cors)
 *   Las imágenes de Unsplash y las fuentes de Google se cargan con mode
 *   'no-cors' (default de <img> y <link>). La respuesta es 'opaque': su
 *   status es 0 y response.ok es false. Pero la Cache API SÍ puede almacenar
 *   respuestas opacas, y el navegador SÍ puede usarlas para <img>/<link>.
 *   Por eso usamos isCacheable() que acepta opaque — sin esto, las imágenes
 *   cross-origin nunca se cachearían y el SW no reduciría consumo.
 *
 * MANEJO DE ERRORES DEFENSIVO
 *   - Si un precache falla (ej: fuente de Google caída), el SW se instala igual.
 *   - Si un SWR falla (red caída + sin caché), se devuelve un 504 controlado.
 *   - Nunca se lanza una excepción desde un fetch handler — siempre se devuelve
 *     algo al navegador para evitar que el request quede colgado.
 * ═══════════════════════════════════════════════════════════════════════════ */

// ── Cachés nombrados con versión ────────────────────────────────────────────
const CACHE_SHELL = 'dh1-shell-v1';    // HTML + manifest (precache)
const CACHE_ASSETS = 'dh1-assets-v1';  // JS/CSS/fuentes/imágenes (runtime SWR)

// Recursos estáticos que se precachean en 'install'. Solo los esenciales para
// que la app monte offline: el HTML raíz y el manifest. Los chunks JS/CSS con
// hash se cachean runtime (sus nombres cambian en cada deploy → precache
// estático los rompería).
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
];

// ── Configuración de expiración ──────────────────────────────────────────────
const MAX_AGE_MS = {
  images: 1000 * 60 * 60 * 24 * 30,  // 30 días
  fonts: 1000 * 60 * 60 * 24 * 30,   // 30 días
};

// ── Helpers de URL ───────────────────────────────────────────────────────────

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isNavigationRequest(request) {
  return request.mode === 'navigate';
}

function isBackendApi(url) {
  // /api/ y /functions/ son llamadas al backend — passthrough, no cachear.
  // El SDK usa base44.functions.invoke(...) que pasa por estas rutas.
  const pathname = url.pathname;
  return pathname.startsWith('/api/') || pathname.startsWith('/functions/');
}

function isStaticAsset(url, request) {
  // JS/CSS de mismo origen (módulos Vite compilados)
  if (isSameOrigin(url)) {
    const dest = request.destination;
    if (dest === 'script' || dest === 'style') return true;
    if (/\.(js|mjs|css)$/.test(url.pathname)) return true;
  }
  return false;
}

function isFont(url) {
  const host = url.host;
  return host === 'fonts.googleapis.com' || host === 'fonts.gstatic.com';
}

function isImage(url, request) {
  if (request.destination === 'image') return true;
  return /\.(png|jpg|jpeg|webp|svg|gif|ico|avif)(\?|$)/i.test(url.pathname);
}

// ── Helper: ¿es cacheable? (acepta respuestas opacas cross-origin) ──────────
// Las imágenes de Unsplash y las fuentes de Google se cargan con mode 'no-cors'.
// Su response.ok es false y status es 0, pero la Cache API las almacena y el
// navegador las usa para <img>/<link>. Sin este check, no se cachearían.
function isCacheable(response) {
  if (!response) return false;
  return response.ok || response.type === 'opaque';
}

// ── Helper: obtener timestamp de un caché (para expiración) ──────────────────
async function getCachedResponseWithAge(cache, request) {
  const cached = await cache.match(request);
  if (!cached) return null;
  // El header 'date' lo setea el Cache API al guardar. Si no está, asumimos
  // fresco (no expira) — mejor servir algo viejo que nada en señal baja.
  const dateHeader = cached.headers.get('date');
  if (!dateHeader) return { response: cached, age: 0 };
  const age = Date.now() - new Date(dateHeader).getTime();
  // Si la fecha es inválida (NaN), age será NaN → la entrada se considera
  // stale y se re-fetch — seguro, no crashea.
  return { response: cached, age };
}

// ── Estrategia: Network-First (para navegación HTML) ─────────────────────────
async function handleNavigation(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(CACHE_SHELL);
      cache.put(request, networkResponse.clone()).catch(() => {});
    }
    return networkResponse;
  } catch (err) {
    const cache = await caches.open(CACHE_SHELL);
    const cached = await cache.match(request);
    if (cached) return cached;
    const fallback = await cache.match('/index.html') || await cache.match('/');
    if (fallback) return fallback;
    return (await cache.match('/offline.html')) || Response.error();
  }
}

// ── Estrategia: Stale-While-Revalidate (para JS/CSS e imágenes) ──────────────
async function handleStaleWhileRevalidate(request, cacheName, maxAgeMs) {
  const cache = await caches.open(cacheName);

  const cachedInfo = await getCachedResponseWithAge(cache, request);
  const isFresh = cachedInfo && (maxAgeMs ? cachedInfo.age < maxAgeMs : true);

  const revalidate = (async () => {
    try {
      const networkResponse = await fetch(request);
      if (isCacheable(networkResponse)) {
        cache.put(request, networkResponse.clone()).catch(() => {});
      }
      return networkResponse;
    } catch (_) {
      return null;
    }
  })();

  if (isFresh) {
    revalidate.catch(() => {});
    return cachedInfo.response;
  }

  try {
    const networkResponse = await revalidate;
    if (isCacheable(networkResponse)) return networkResponse;
  } catch (_) { /* continúa al fallback */ }

  if (cachedInfo) return cachedInfo.response;

  return new Response('', {
    status: 504,
    statusText: 'Gateway Timeout (offline, sin caché)',
    headers: { 'Content-Type': 'text/plain' },
  });
}

// ── Estrategia: Cache-First (para fuentes de Google) ─────────────────────────
async function handleCacheFirst(request, cacheName, maxAgeMs) {
  const cache = await caches.open(cacheName);
  const cachedInfo = await getCachedResponseWithAge(cache, request);

  if (cachedInfo) {
    const isFresh = maxAgeMs ? cachedInfo.age < maxAgeMs : true;
    if (isFresh) return cachedInfo.response;
  }

  try {
    const networkResponse = await fetch(request);
    if (isCacheable(networkResponse)) {
      cache.put(request, networkResponse.clone()).catch(() => {});
    }
    return networkResponse;
  } catch (_) {
    if (cachedInfo) return cachedInfo.response;
    return new Response('', {
      status: 504,
      statusText: 'Gateway Timeout (offline, sin fuente cacheada)',
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

// ── Evento: INSTALL (precache del app shell) ─────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_SHELL);
      // Precachear uno por uno para que un fallo individual no rompa todo.
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
      const validCaches = [CACHE_SHELL, CACHE_ASSETS];
      const allCaches = await caches.keys();
      await Promise.all(
        allCaches
          .filter((name) => !validCaches.includes(name))
          .map((name) => caches.delete(name).catch(() => {}))
      );
      // clients.claim() es necesario para que el nuevo SW tome control de
      // las pestañas existentes y dispare 'controllerchange' en usePWA.js,
      // que ejecuta el reload automático. Sin claim, controllerchange no
      // fire para tabs abiertas y el auto-reload no funciona.
      await self.clients.claim();
    })()
  );
});

// ── Evento: FETCH (interceptar requests según estrategia) ────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  let url;
  try { url = new URL(request.url); } catch (_) { return; }

  // PASSTHROUGH: llamadas a la API del backend — NO cachear.
  if (isBackendApi(url)) return;

  // PASSTHROUGH: data: y blob: URLs
  if (url.protocol === 'data:' || url.protocol === 'blob:') return;

  // 1. Navegación (HTML) → Network-First
  if (isNavigationRequest(request)) {
    event.respondWith(handleNavigation(request));
    return;
  }

  // 2. JS/CSS de mismo origen → SWR (sin expiración, hash los versiona)
  if (isStaticAsset(url, request)) {
    event.respondWith(handleStaleWhileRevalidate(request, CACHE_ASSETS, 0));
    return;
  }

  // 3. Fuentes de Google → Cache-First con expiración
  if (isFont(url)) {
    event.respondWith(handleCacheFirst(request, CACHE_ASSETS, MAX_AGE_MS.fonts));
    return;
  }

  // 4. Imágenes → SWR con maxAge 30 días
  if (isImage(url, request)) {
    event.respondWith(handleStaleWhileRevalidate(request, CACHE_ASSETS, MAX_AGE_MS.images));
    return;
  }
});

// ── Evento: MESSAGE (futura extensibilidad) ──────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
