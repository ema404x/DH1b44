import React from 'react';
import { Link } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOfflineMode } from '@/hooks/useOfflineMode';

/**
 * En modo sin conexión, si no hay datos guardados muestra el panel
 * "No disponible sin conexión". En cualquier otro caso devuelve children.
 */
export default function OfflineGuard({ hasData = false, children = null }) {
  const offlineMode = useOfflineMode();
  if (!offlineMode || hasData) return children;
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-6">
      <div className="h-16 w-16 rounded-2xl bg-amber-500/10 flex items-center justify-center">
        <WifiOff className="h-8 w-8 text-amber-400" />
      </div>
      <div>
        <h2 className="text-xl font-bold">No disponible sin conexión</h2>
        <p className="text-muted-foreground mt-1 text-sm max-w-sm">
          Esta información no se guardó en este dispositivo.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link to="/">Volver al inicio</Link>
      </Button>
    </div>
  );
}