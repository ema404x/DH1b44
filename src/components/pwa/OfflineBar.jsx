import React from 'react';
import { WifiOff, RefreshCw, Download, CloudOff, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWA } from '@/hooks/usePWA';

export function OfflineBar({ isOnline, pendingCount, isSyncing, lastSynced, onSync, onInstall }) {
  const { canInstall, triggerInstall } = usePWA();

  // Barra de offline
  if (!isOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 bg-amber-500 text-white text-xs font-semibold py-2 px-4 shadow-lg">
        <WifiOff className="h-3.5 w-3.5 flex-shrink-0" />
        <span>
          Sin conexión — Modo offline activo.
          {pendingCount > 0 && ` ${pendingCount} OT${pendingCount !== 1 ? 's' : ''} en cola de sincronización.`}
        </span>
      </div>
    );
  }

  // Barra de sincronización en proceso
  if (isSyncing) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 bg-blue-500 text-white text-xs font-semibold py-2 px-4 shadow-lg">
        <Loader2 className="h-3.5 w-3.5 animate-spin flex-shrink-0" />
        <span>Sincronizando {pendingCount} orden{pendingCount !== 1 ? 'es' : ''} de trabajo...</span>
      </div>
    );
  }

  // Pendientes sin sincronizar (volvió online pero aún hay cola)
  if (pendingCount > 0 && isOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-3 bg-indigo-600 text-white text-xs font-semibold py-2 px-4 shadow-lg">
        <CloudOff className="h-3.5 w-3.5 flex-shrink-0" />
        <span>{pendingCount} OT{pendingCount !== 1 ? 's' : ''} pendiente{pendingCount !== 1 ? 's' : ''} de sincronizar</span>
        <Button size="sm" variant="ghost" className="h-6 px-2 text-white hover:bg-white/20 text-xs gap-1"
          onClick={onSync}>
          <RefreshCw className="h-3 w-3" /> Sincronizar ahora
        </Button>
      </div>
    );
  }

  // Prompt de instalación PWA
  if (canInstall) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-card border border-border shadow-xl rounded-xl px-4 py-3 max-w-sm w-[calc(100%-32px)]">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Download className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold">Instalar DH1 ERP</p>
          <p className="text-[11px] text-muted-foreground">Acceso rápido y soporte offline</p>
        </div>
        <Button size="sm" className="h-8 text-xs flex-shrink-0" onClick={triggerInstall}>
          Instalar
        </Button>
      </div>
    );
  }

  return null;
}

export default OfflineBar;