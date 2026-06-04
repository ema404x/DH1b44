import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

export function useForoNotificaciones() {
  const [hasNewMessages, setHasNewMessages] = useState(false);

  useEffect(() => {
    // Suscribirse a cambios en ForoHilo
    const unsubscribeHilos = base44.entities.ForoHilo.subscribe((event) => {
      if (event.type === 'create') {
        setHasNewMessages(true);
      }
    });

    // Suscribirse a cambios en ForoRespuesta
    const unsubscribeRespuestas = base44.entities.ForoRespuesta.subscribe((event) => {
      if (event.type === 'create') {
        setHasNewMessages(true);
      }
    });

    return () => {
      unsubscribeHilos();
      unsubscribeRespuestas();
    };
  }, []);

  const resetNotification = () => setHasNewMessages(false);

  return { hasNewMessages, resetNotification };
}