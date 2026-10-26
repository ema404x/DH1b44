import React, { useState } from 'react';
import { Bell, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function ActivarNotificacionesBanner({ onActivar }) {
  const [visible, setVisible] = useState(
    () => 'Notification' in window && 'PushManager' in window && Notification.permission === 'default' && !sessionStorage.getItem('dh1-push-banner-off')
  );
  const [loading, setLoading] = useState(false);

  if (!visible) return null;

  const cerrar = () => {
    sessionStorage.setItem('dh1-push-banner-off', '1');
    setVisible(false);
  };

  const activar = async () => {
    setLoading(true);
    try {
      await onActivar();
      if (Notification.permission === 'granted') toast.success('Notificaciones activadas en este dispositivo.');
      else toast.error('No se otorgó el permiso de notificaciones.');
      setVisible(false);
    } catch (err) {
      toast.error(err?.message || 'No se pudieron activar las notificaciones.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed z-50 left-4 right-4 bottom-20 md:bottom-4 md:left-auto md:right-4 md:w-96 rounded-2xl border border-border bg-card shadow-lg p-4 flex items-start gap-3">
      <div className="rounded-xl bg-primary/10 p-2 text-primary"><Bell className="h-5 w-5" /></div>
      <div className="flex-1 space-y-2">
        <p className="text-sm font-semibold text-foreground">Activá las notificaciones</p>
        <p className="text-xs text-muted-foreground">Recibí los avisos de órdenes de trabajo en este dispositivo.</p>
        <Button size="sm" className="gap-2" onClick={activar} disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Activar notificaciones
        </Button>
      </div>
      <button onClick={cerrar} className="text-muted-foreground hover:text-foreground" aria-label="Cerrar">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}