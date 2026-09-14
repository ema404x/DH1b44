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
 *   4. Imágenes (png/jpg/jpeg/webp/svg/gif/ico) de cualquier origen →
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
 *   Los tres cachés tienen sufijo -vN. Al cambiar la versión, el evento
 *   'activate' elimina los cachés viejos y crea los nuevos. Esto fuerza la
 *   limpieza sin depender de expiración manual.
 *
 * ACTUALIZACIONES (skipWaiting + controllerchange)
 *   El SW usa self.skipWaiting() en 'install' para activarse inmediatamente.
 *   usePWA.js (líneas 37-44) escucha 'controllerchange' y dispara
 *   window.location.reload(). Así, al publicar una nueva versión, el usuario
 *   pasa automáticamente a la nueva versión en su próxima interacción.
 *
 * MANEJO DE ERRORES DEFENSIVO
 *   - Si un precache falla (ej: fuente de Google caída), el SW se instala igual.
 *   - Si un SWR falla (red caída + sin caché), se devuelve un Response vacío
 *     con el Content-Type correcto para que la app no crashee.
 *   - Nunca se lanza una excepción desde un fetch handler — siempre se devuelve
 *     algo al navegador para evitar que el request quede colgado.
 * ═══════════════════════════════════════════════════════════════════════════ */

// ── Cachés nombrados con versión ────────────────────────────────────────────
// Al cambiar estos nombres, el 'activate' elimina los cachés viejos.
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
    // Fallback por extensión si destination no está disponible
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

// ── Helper: obtener timestamp de un caché (para expiración) ──────────────────
async function getCachedResponseWithAge(cache, request) {
  const cached = await cache.match(request);
  if (!cached) return null;
  // El header 'date' lo setea el Cache API al guardar. Si no está, asumimos
  // fresco (no expira) — mejor servir algo viejo que nada en señal baja.
  const dateHeader = cached.headers.get('date');
  if (!dateHeader) return { response: cached, age: 0 };
  const age = Date.now() - new Date(dateHeader).getTime();
  return { response: cached, age };
}

// ── Estrategia: Network-First (para navegación HTML) ─────────────────────────
// Intenta red primero (HTML fresco con nuevos hashes de JS). Si la red falla,
// sirve el index.html cacheado para que la app monte offline.
async function handleNavigation(request) {
  try {
    const networkResponse = await fetch(request);
    // Si la red respondió OK, cachear el HTML fresco para futuros fallbacks.
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(CACHE_SHELL);
      cache.put(request, networkResponse.clone()).catch(() => {});
    }
    return networkResponse;
  } catch (err) {
    // Red caída — servir el app shell cacheado.
    const cache = await caches.open(CACHE_SHELL);
    const cached = await cache.match(request);
    if (cached) return cached;
    // Fallback final: index.html raíz (la app SPA rutea desde ahí).
    const fallback = await cache.match('/index.html') || await cache.match('/');
    if (fallback) return fallback;
    // Si no hay nada cacheado, devolver el offline.html si existe.
    return (await cache.match('/offline.html')) || Response.error();
  }
}

// ── Estrategia: Stale-While-Revalidate (para JS/CSS e imágenes) ──────────────
// Sirve el caché instantáneo (si existe y no expiró), revalida en background.
// Si no hay caché o expiró, va a la red y cachea el resultado.
async function handleStaleWhileRevalidate(request, cacheName, maxAgeMs) {
  const cache = await caches.open(cacheName);

  // ¿Hay caché válido?
  const cachedInfo = await getCachedResponseWithAge(cache, request);
  const isFresh = cachedInfo && (maxAgeMs ? cachedInfo.age < maxAgeMs : true);

  // Revalidar en background (sin bloquear la respuesta al navegador).
  const revalidate = (async () => {
    try {
      const networkResponse = await fetch(request);
      if (networkResponse && networkResponse.ok) {
        cache.put(request, networkResponse.clone()).catch(() => {});
      }
      return networkResponse;
    } catch (_) {
      // Revalidación falló (red caída) — no rompe nada, el caché sigue sirviendo.
      return null;
    }
  })();

  // Si hay caché fresco, servirlo ya (instantáneo).
  if (isFresh) {
    // Disparar revalidación sin esperarla (fire-and-forget).
    revalidate.catch(() => {});
    return cachedInfo.response;
  }

  // No hay caché fresco — esperar la red (con caché viejo como fallback).
  try {
    const networkResponse = await revalidate;
    if (networkResponse && networkResponse.ok) return networkResponse;
  } catch (_) { /* continúa al fallback */ }

  // Si la red falló pero hay caché viejo, servirlo (mejor viejo que nada).
  if (cachedInfo) return cachedInfo.response;

  // Sin caché y sin red — devolver una respuesta vacía con el tipo correcto
  // para que la app no crashee (ej: imagen rota controlada).
  return new Response('', {
    status: 504,
    statusText: 'Gateway Timeout (offline, sin caché)',
    headers: { 'Content-Type': 'text/plain' },
  });
}

// ── Estrategia: Cache-First (para fuentes de Google) ─────────────────────────
// Las fuentes son estáticas y rara vez cambian. Cache-first evita un round-trip
// en cada carga. Si no hay caché, va a la red y cachea.
async function handleCacheFirst(request, cacheName, maxAgeMs) {
  const cache = await caches.open(cacheName);
  const cachedInfo = await getCachedResponseWithAge(cache, request);

  if (cachedInfo) {
    const isFresh = maxAgeMs ? cachedInfo.age < maxAgeMs : true;
    if (isFresh) return cachedInfo.response;
  }

  // No hay caché fresco — ir a la red.
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone()).catch(() => {});
    }
    return networkResponse;
  } catch (_) {
    // Red caída — servir caché viejo si existe (mejor viejo que nada).
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
      // Si /offline.html no existe aún, no bloquea la instalación.
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            await cache.add(url);
          } catch (_) {
            // Asset opcional falló — no bloquear la instalación.
          }
        })
      );
      // Activar inmediatamente (skipWaiting). usePWA.js escucha el
      // 'controllerchange' y dispara el reload para que el usuario tome
      // la nueva versión sin intervención.
      await self.skipWaiting();
    })()
  );
});

// ── Evento: ACTIVATE (limpieza de cachés viejos) ────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const validCaches = [CACHE_SHELL, CACHE_ASSETS];
      const allCaches = await caches.keys();
      // Eliminar cualquier caché que no sea de la versión actual.
      await Promise.all(
        allCaches
          .filter((name) => !validCaches.includes(name))
          .map((name) => caches.delete(name).catch(() => {}))
      );
      // Tomar control de todas las pestañas abiertas inmediatamente.
      await self.clients.claim();
    })()
  );
});

// ── Evento: FETCH (interceptar requests según estrategia) ────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Solo manejar GET — POST/PUT/DELETE son mutaciones, pasan directo.
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch (_) {
    return; // URL inválida — dejar que el navegador la maneje.
  }

  // ── PASSTHROUGH: llamadas a la API del backend ────────────────────────────
  // NO se cachean. React Query + IndexedDB (persistCache.js / useSmartCache.js)
  // manejan los datos con su propia lógica de staleTime, gcTime y refetchOnMount.
  // Cachearlas aquí duplicaría datos y rompería la consistencia: un GET cacheado
  // aquí envejecería sin coordinación con las invalidaciones de React Query,
  // y el usuario vería datos stale incluso después de una mutación exitosa.
  // El SDK (base44.functions.invoke) pasa por /api/ — dejar que llegue a la red.
  if (isBackendApi(url)) return;

  // ── PASSTHROUGH: data: URLs y blob: URLs ──────────────────────────────────
  if (url.protocol === 'data:' || url.protocol === 'blob:') return;

  // ── 1. Navegación (HTML) → Network-First con fallback a caché ─────────────
  if (isNavigationRequest(request)) {
    event.respondWith(handleNavigation(request));
    return;
  }

  // ── 2. JS/CSS de mismo origen → Stale-While-Revalidate ────────────────────
  if (isStaticAsset(url, request)) {
    event.respondWith(handleStaleWhileRevalidate(request, CACHE_ASSETS, 0));
    return;
  }

  // ── 3. Fuentes de Google Fonts → Cache-First con expiración ────────────────
  if (isFont(url)) {
    event.respondWith(handleCacheFirst(request, CACHE_ASSETS, MAX_AGE_MS.fonts));
    return;
  }

  // ── 4. Imágenes → Stale-While-Revalidate con maxAge 30 días ───────────────
  if (isImage(url, request)) {
    event.respondWith(handleStaleWhileRevalidate(request, CACHE_ASSETS, MAX_AGE_MS.images));
    return;
  }

  // ── Default: no interceptar (passthrough) ──────────────────────────────────
  // Cualquier otro tipo de request pasa directo a la red.
});

// ── Evento: MESSAGE (comunicación con la app) ─────────────────────────────────
// Permite que la app pida al SW que salte la espera (skipWaiting) si en el
// futuro se quiere un botón "Actualizar ahora". Por ahora, skipWaiting ya se
// llama en install, así que este handler es para futura extensibilidad.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
