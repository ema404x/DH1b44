/**
 * offlineSession — sesión mínima guardada en el dispositivo para el
 * "Modo sin conexión (beta)". Solo existe para usuarios con
 * offline_habilitado === true. Todo acceso a localStorage va en try/catch.
 */
const KEY = 'dh1_offline_session';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

export function isOfflineEnabled(user) {
  return user?.offline_habilitado === true || user?.data?.offline_habilitado === true;
}

/** Guarda los datos mínimos que la app usa del usuario + permisos + savedAt. */
export function saveOfflineSession({ user, userPermissions, hasEmployeeRecord }) {
  try {
    if (!user?.id) return;
    localStorage.setItem(KEY, JSON.stringify({
      offline_habilitado: true,
      savedAt: Date.now(),
      user: {
        id: user.id,
        email: user.email || null,
        full_name: user.full_name || null,
        role: user.role || 'user',
        sector_id: user.sector_id || null,
        sector_base: user.sector_base || null,
        offline_habilitado: true,
        data: {
          sector_id: user.data?.sector_id || null,
          sector_base: user.data?.sector_base || null,
        },
      },
      userPermissions: userPermissions || null,
      hasEmployeeRecord: hasEmployeeRecord ?? null,
    }));
  } catch (_) { /* silencioso */ }
}

/** Devuelve la sesión guardada solo si está habilitada y tiene menos de 7 días. */
export function readOfflineSession() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (saved?.offline_habilitado !== true || !saved?.user?.id) return null;
    if (typeof saved.savedAt !== 'number' || Date.now() - saved.savedAt >= MAX_AGE_MS) return null;
    return saved;
  } catch (_) {
    return null;
  }
}

export function clearOfflineSession() {
  try { localStorage.removeItem(KEY); } catch (_) { /* silencioso */ }
}

/**
 * true SOLO ante un error de red real: sin respuesta del servidor / TypeError,
 * o navigator.onLine === false. Nunca por timeout, lentitud o cancelación, y
 * nunca si el servidor respondió (401, 403, 500, etc.).
 */
export function isNetworkError(error) {
  const raw = error?.originalError || error;
  const status = error?.status ?? error?.response?.status ?? raw?.response?.status;
  if (status) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const code = raw?.code || '';
  const msg = String(raw?.message || error?.message || '');
  if (
    code === 'ECONNABORTED' || code === 'ETIMEDOUT' || code === 'ERR_CANCELED' ||
    raw?.name === 'AbortError' || /timeout/i.test(msg)
  ) return false;
  if (error instanceof TypeError || raw instanceof TypeError) return true;
  return code === 'ERR_NETWORK' || (!!raw?.request && !raw?.response);
}