/**
 * offlineShell — Deja listo el código de las pantallas del operario para abrir
 * sin señal. Solo se usa para usuarios con "Modo sin conexión" habilitado.
 *
 * Descarga las pantallas que el operario necesita y le pide al Service Worker
 * que guarde los archivos JS/CSS ya cargados por esta página.
 */
let warmed = false;

export function warmOfflineShell() {
  if (warmed || !import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  warmed = true;

  setTimeout(async () => {
    try {
      await Promise.all([
        import('@/pages/PortalOperarioApp'),
        import('@/pages/Dashboard'),
      ]);
      const urls = performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .filter((url) => url.startsWith(window.location.origin) && /\.(js|mjs|css)(\?|$)/i.test(url));
      const registration = await navigator.serviceWorker.ready;
      registration.active?.postMessage({ type: 'dh1-precache', urls });
    } catch (_) { /* silencioso */ }
  }, 3000);
}