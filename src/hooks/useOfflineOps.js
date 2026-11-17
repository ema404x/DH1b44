import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '@/lib/AuthContext';
import { isOfflineEnabled, readOfflineSession } from '@/lib/offlineSession';
import { getOps, subscribe, hasPendingMarker, setOfflineUser } from '@/lib/offlineStore';
import { startOfflineSync, setSyncPaused, onSyncEvent, isSyncing } from '@/lib/offlineSyncEngine';

/**
 * true solo si el usuario tiene offline_habilitado (o, en las páginas públicas
 * sin sesión, si este dispositivo tiene guardada una sesión con el modo activo).
 * Con false no se abre la cola durable ni arranca el sincronizador, salvo que
 * hayan quedado pendientes guardados: esos se terminan de enviar igual.
 */
export function useOfflineEnabled() {
  const ctx = useContext(AuthContext);
  const hasCtx = !!ctx;
  const [deviceEnabled] = useState(() => !!readOfflineSession());
  const enabled = hasCtx ? isOfflineEnabled(ctx.user) : deviceEnabled;
  const userId = ctx?.user?.id || null;
  const offlineMode = ctx?.offlineMode === true;

  useEffect(() => { if (hasCtx) setOfflineUser(userId); }, [hasCtx, userId]);
  useEffect(() => { if (hasCtx) setSyncPaused(offlineMode); }, [hasCtx, offlineMode]);
  useEffect(() => { if (enabled || hasPendingMarker()) startOfflineSync(); }, [enabled]);

  return enabled;
}

/** Lista viva de pendientes del usuario actual + si se está enviando ahora. */
export function useOfflineOps(active = true) {
  const [ops, setOps] = useState([]);
  const [syncing, setSyncing] = useState(isSyncing());

  useEffect(() => {
    if (!active) { setOps([]); return undefined; }
    let alive = true;
    const refresh = () => getOps().then((list) => { if (alive) setOps(list); }).catch(() => {});
    refresh();
    const offStore = subscribe(refresh);
    const offSync = onSyncEvent((e) => { if (e.type === 'state') setSyncing(e.syncing); });
    return () => { alive = false; offStore(); offSync(); };
  }, [active]);

  return { ops, syncing };
}