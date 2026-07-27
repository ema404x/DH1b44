import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const IDLE_TIMEOUT = 60_000;   // 60s sin actividad → idle
const TICK_INTERVAL = 5_000;   // medir cada 5s
const SAVE_INTERVAL = 60_000;  // guardar cada 60s

/**
 * Trackea el tiempo real de uso de la aplicación:
 * - La pestaña debe estar enfocada (no en background)
 * - El usuario debe tener actividad reciente (mouse/teclado/touch)
 * Acumula segundos activos y los persiste en AppUsageLog (un registro por día).
 */
export function useAppUsageTracker(user) {
  const activeSecondsRef = useRef(0);
  const lastActivityRef = useRef(Date.now());
  const isFocusedRef = useRef(true);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!user?.email) return;

    const onActivity = () => { lastActivityRef.current = Date.now(); };
    const onFocus = () => { isFocusedRef.current = true; };
    const onBlur = () => { isFocusedRef.current = false; };
    const onVisibility = () => { isFocusedRef.current = !document.hidden; };

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);

    const tick = setInterval(() => {
      const idle = Date.now() - lastActivityRef.current > IDLE_TIMEOUT;
      if (isFocusedRef.current && !idle) {
        activeSecondsRef.current += TICK_INTERVAL / 1000;
      }
    }, TICK_INTERVAL);

    const flush = async () => {
      if (savingRef.current) return;
      const seconds = Math.round(activeSecondsRef.current);
      if (seconds < 5) return;
      activeSecondsRef.current = 0;
      savingRef.current = true;
      try {
        const today = new Date().toISOString().split('T')[0];
        const existing = await base44.entities.AppUsageLog.filter({
          user_email: user.email,
          date: today
        });
        if (existing.length > 0) {
          await base44.entities.AppUsageLog.update(existing[0].id, {
            active_seconds: (existing[0].active_seconds || 0) + seconds
          });
        } else {
          await base44.entities.AppUsageLog.create({
            user_email: user.email,
            user_name: user.full_name || user.email,
            date: today,
            active_seconds: seconds
          });
        }
      } catch (_) {} finally {
        savingRef.current = false;
      }
    };

    const save = setInterval(flush, SAVE_INTERVAL);
    window.addEventListener('beforeunload', flush);

    return () => {
      events.forEach(e => window.removeEventListener(e, onActivity));
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(tick);
      clearInterval(save);
      window.removeEventListener('beforeunload', flush);
    };
  }, [user?.email]);
}