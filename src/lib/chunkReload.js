// Recuperación ante "chunk stale": tras publicar una versión nueva, una pestaña
// abierta puede pedir un archivo JS/CSS que ya no existe. Se permite UNA sola
// recarga automática cada 60 s para no entrar en bucle.

const RELOAD_KEY = 'dh1_chunk_reload_at';
const MIN_INTERVAL_MS = 60 * 1000;

const CHUNK_ERROR_PATTERNS = [
  'chunkloaderror',
  'failed to fetch dynamically imported module',
  'importing a module script failed',
  'error loading dynamically imported module',
  'loading chunk',
];

export function isChunkLoadError(error) {
  if (!error) return false;
  if (error.name === 'ChunkLoadError') return true;
  const message = String(error.message || error).toLowerCase();
  return CHUNK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

// Recarga la página como máximo una vez cada 60 s. Devuelve true si recargó.
// Si sessionStorage no está disponible NO recarga (no se puede garantizar el límite).
export function tryChunkReload() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY)) || 0;
    const now = Date.now();
    if (now - last < MIN_INTERVAL_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(now));
  } catch (_) {
    return false;
  }
  window.location.reload();
  return true;
}