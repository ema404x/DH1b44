import { useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Hook que suscribe al usuario (rol admin/gerencia) a notificaciones nativas
 * cuando se crea una nueva emergencia.
 * - Pide permiso de notificaciones si no fue concedido aún.
 * - En mobile: dispara notificación nativa con vibración.
 * - En desktop: dispara notificación nativa con ícono y "badge" visual.
 */
export function useEmergencyNotifications(user, onNewEmergency) {
  const isGerencia = user?.role === 'admin';
  const permissionRef = useRef('default'); // se actualiza tras pedir permiso
  const flashIntervalRef = useRef(null);
  const audioCtxRef = useRef(null);
  const onNewEmergencyRef = useRef(onNewEmergency);

  // Mantener siempre el callback más reciente sin re-suscribirse
  useEffect(() => { onNewEmergencyRef.current = onNewEmergency; }, [onNewEmergency]);

  // Solicitar permiso de notificaciones (seguro ante entornos sin API)
  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return;
    permissionRef.current = Notification.permission;
    if (Notification.permission === 'default') {
      const perm = await Notification.requestPermission();
      permissionRef.current = perm;
    }
  }, []);

  // Flash visual en el título de la pestaña (desktop)
  const flashTabTitle = useCallback((emergencyTitle) => {
    if (flashIntervalRef.current) clearInterval(flashIntervalRef.current);
    const original = document.title;
    let show = true;
    let count = 0;
    flashIntervalRef.current = setInterval(() => {
      document.title = show ? `🚨 EMERGENCIA: ${emergencyTitle}` : original;
      show = !show;
      count++;
      if (count >= 20) {
        clearInterval(flashIntervalRef.current);
        document.title = original;
      }
    }, 600);
  }, []);

  // Disparar notificación nativa + vibración + flash
  const triggerNotification = useCallback((emergencia) => {
    const title = `🚨 Nueva Emergencia`;
    const body = `${emergencia.titulo || 'Sin título'} — ${emergencia.establecimiento || ''}`;
    const icon = '/icon-192.png';

    // Notificación nativa del sistema
    if (permissionRef.current === 'granted') {
      try {
        const notif = new Notification(title, {
          body,
          icon,
          badge: icon,
          tag: `emergencia-${emergencia.id}`,
          requireInteraction: true,
          vibrate: [300, 100, 300, 100, 300],
        });
        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      } catch (e) {
        // Safari no soporta algunos parámetros, ignorar
      }
    }

    // Vibración en mobile (API directa, por si la Notification API no la activa)
    if ('vibrate' in navigator) {
      navigator.vibrate([400, 150, 400, 150, 600]);
    }

    // Flash visual en el título de la pestaña
    flashTabTitle(emergencia.titulo || 'Emergencia');

    // Sonido: reutilizar un único AudioContext para toda la sesión
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
          audioCtxRef.current = new AudioCtx();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') ctx.resume();
        const playBeep = (freq, start, duration) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = freq;
          osc.type = 'sine';
          gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
          osc.start(ctx.currentTime + start);
          osc.stop(ctx.currentTime + start + duration);
        };
        playBeep(880, 0, 0.3);
        playBeep(660, 0.4, 0.3);
        playBeep(880, 0.8, 0.5);
      }
    } catch (e) {
      // Ignorar si Web Audio API no está disponible
    }
  }, [flashTabTitle]);

  useEffect(() => {
    if (!isGerencia) return;

    // Pedir permiso al montar (solo si aún no fue dado)
    requestPermission();

    // Suscribirse a nuevas emergencias en tiempo real
    const unsubscribe = base44.entities.Emergencia.subscribe((event) => {
      if (event.type === 'create') {
        triggerNotification(event.data || {});
        onNewEmergencyRef.current?.(event.data || {});
      }
    });

    return () => {
      unsubscribe();
      if (flashIntervalRef.current) clearInterval(flashIntervalRef.current);
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
    };
  }, [isGerencia, requestPermission, triggerNotification]);
}