import { useEffect, useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';

export function useForoNotificaciones() {
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const unsubscribeRef = useRef(null);

  useEffect(() => {
    // Evitar múltiples suscripciones — solo crear si no existe
    if (unsubscribeRef.current) return;

    try {
      const unsubscribeHilos = base44.entities.ForoHilo.subscribe((event) => {
        if (event.type === 'create') {
          setHasNewMessages(true);
        }
      });

      const unsubscribeRespuestas = base44.entities.ForoRespuesta.subscribe((event) => {
        if (event.type === 'create') {
          setHasNewMessages(true);
        }
      });

      unsubscribeRef.current = () => {
        unsubscribeHilos();
        unsubscribeRespuestas();
      };
    } catch (error) {
      console.warn('[useForoNotificaciones] subscription error:', error?.message);
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);

  const resetNotification = () => setHasNewMessages(false);

  return { hasNewMessages, resetNotification };
}