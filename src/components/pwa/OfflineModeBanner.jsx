import React, { useMemo } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

// Aviso fijo del modo sin conexión (solo usuarios con el interruptor encendido).
export default function OfflineModeBanner({ offlineMode, savedAt, userId, pendingCount = 0 }) {
  // Fecha de los datos que se están mostrando: la del último guardado de las
  // OT del usuario y, si no hay, la del perfil guardado.
  const fecha = useMemo(() => {
    let ts = savedAt;
    try {
      const snapshot = JSON.parse(localStorage.getItem(`mis-ots-cache-${userId}`));
      if (snapshot?.cachedAt) ts = snapshot.cachedAt;
    } catch (_) {}
    return ts ? format(new Date(ts), 'dd/MM HH:mm') : null;
  }, [savedAt, userId]);

  if (!offlineMode) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 bg-primary text-primary-foreground text-xs font-semibold py-2 px-4 shadow-lg">
        <RefreshCw className="h-3.5 w-3.5 flex-shrink-0 animate-spin" />
        <span>Conexión restablecida · actualizando…</span>
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 bg-amber-500 text-white text-xs font-semibold py-2 px-4 shadow-lg">
      <WifiOff className="h-3.5 w-3.5 flex-shrink-0" />
      <span>
        Sin conexión{fecha ? ` · datos guardados el ${fecha}` : ''}
        {pendingCount > 0 && ` · ${pendingCount} en cola`}
      </span>
    </div>
  );
}