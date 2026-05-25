/**
 * useOfflineQueue — Hook para gestionar OTs creadas sin conexión.
 * Guarda en IndexedDB y sincroniza cuando vuelve la red.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const DB_NAME = 'dh1-offline-queue';
const DB_VERSION = 1;
const STORE = 'pending';

// ── IndexedDB helpers ────────────────────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function addToDB(data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).add({ ...data, queuedAt: new Date().toISOString() });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAllFromDB() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deleteFromDB(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── Hook principal ───────────────────────────────────────────────────────────
export function useOfflineQueue(onSyncSuccess) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);

  // Actualizar conteo desde IndexedDB
  const refreshCount = useCallback(async () => {
    const items = await getAllFromDB();
    setPendingCount(items.length);
  }, []);

  // Sincronizar todos los items pendientes
  const syncPending = useCallback(async () => {
    const items = await getAllFromDB();
    if (items.length === 0) return;

    setIsSyncing(true);
    let synced = 0;

    for (const item of items) {
      try {
        let result;
        if (item.action === 'create') {
          result = await base44.entities.WorkOrder.create(item.data);
        } else if (item.action === 'update') {
          result = await base44.entities.WorkOrder.update(item.entityId, item.data);
        }

        if (result) {
          await deleteFromDB(item.id);
          synced++;
        }
      } catch (err) {
        // Mantener en cola si falla
        console.warn('[OfflineQueue] Sync error for item', item.id, err.message);
      }
    }

    if (synced > 0) {
      setLastSynced(new Date());
      onSyncSuccess?.(synced);
    }

    await refreshCount();
    setIsSyncing(false);
  }, [onSyncSuccess, refreshCount]);

  // Listeners de conectividad
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncPending();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    refreshCount();

    // Escuchar mensajes del Service Worker
    const handleSWMessage = (event) => {
      if (event.data?.type === 'SYNC_SUCCESS') {
        refreshCount();
        setLastSynced(new Date());
        onSyncSuccess?.(1);
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleSWMessage);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage);
    };
  // onSyncSuccess is intentionally excluded to avoid re-registering listeners on every render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncPending, refreshCount]);

  // Guardar OT en cola offline
  const queueCreate = useCallback(async (data) => {
    const localId = `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await addToDB({ action: 'create', data, localId });
    await refreshCount();

    // Registrar background sync si el SW lo soporta
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      const reg = await navigator.serviceWorker.ready;
      await reg.sync.register('sync-work-orders');
    }

    return { id: localId, ...data, _offline: true };
  }, [refreshCount]);

  const queueUpdate = useCallback(async (entityId, data) => {
    const localId = `offline-update-${Date.now()}`;
    await addToDB({ action: 'update', entityId, data, localId });
    await refreshCount();

    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      const reg = await navigator.serviceWorker.ready;
      await reg.sync.register('sync-work-orders');
    }
  }, [refreshCount]);

  return { isOnline, pendingCount, isSyncing, lastSynced, queueCreate, queueUpdate, syncPending };
}