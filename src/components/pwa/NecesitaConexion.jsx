import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOfflineMode } from '@/hooks/useOfflineMode';

/**
 * Envuelve controles que crean o editan algo fuera de la cola offline.
 * Con conexión devuelve children tal cual. En modo sin conexión los muestra
 * deshabilitados con la ayuda "Necesita conexión".
 * compact: sin texto de ayuda visible (solo al mantener el cursor).
 */
export default function NecesitaConexion({ children, compact = false, className = '' }) {
  const offlineMode = useOfflineMode();
  if (!offlineMode) return children;
  if (compact) {
    return (
      <span title="Necesita conexión" className={`inline-flex cursor-not-allowed ${className}`}>
        <span inert="" className="inline-flex opacity-50">{children}</span>
      </span>
    );
  }
  return (
    <div title="Necesita conexión" className={className}>
      <div inert="" className="opacity-50">{children}</div>
      <p className="mt-1 flex items-center gap-1 text-[10px] font-medium text-amber-300">
        <WifiOff className="h-3 w-3" /> Necesita conexión
      </p>
    </div>
  );
}