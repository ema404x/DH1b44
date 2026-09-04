import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { isFlagEnabled } from '@/lib/migrationFlags';
import { useCurrentUser } from '@/hooks/useCurrentUser';

const FALLBACK_MS = 15_000; // si no estabiliza en 15s, track igual (mide percepción de lentitud)
const STABLE_WINDOW_MS = 600; // sin mutaciones de DOM durante 600ms → considerado cargado

/**
 * Mide el tiempo desde mount de un módulo hasta que su contenido se estabiliza
 * (sin mutaciones de DOM por STABLE_WINDOW_MS). Trackea vía base44.analytics.track.
 *
 * 100% aditivo: no muestra UI, no bloquea, falla silenciosamente.
 * Solo trackea si el flag 'use_load_telemetry' está habilitado (default: true).
 *
 * @param {string} moduleKey — identificador del módulo (ej: 'dashboard', 'workorders')
 */
export function useLoadTelemetry(moduleKey) {
  const trackedRef = useRef(false);
  const { currentUser } = useCurrentUser();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!moduleKey) return;
    if (!isFlagEnabled('use_load_telemetry', true)) return;
    if (trackedRef.current) return;
    trackedRef.current = true;

    const start = performance.now();
    let observer = null;
    let stableTimer = null;
    let fallbackTimer = null;
    let cancelled = false;

    const track = (ms) => {
      if (cancelled) return;
      const msRounded = Math.round(ms);
      try {
        base44.analytics.track({
          eventName: 'module_load_time',
          properties: {
            module: moduleKey,
            ms: msRounded,
            sector: currentUser?.data?.sector_id || null,
          },
        });
      } catch (_) {
        // falla silenciosamente — la telemetría nunca debe romper la app
      }
      // Ring buffer local — el panel de observabilidad lee de acá (últimas 50 mediciones por módulo)
      try {
        const key = `base44_loadtm_${moduleKey}`;
        const existing = JSON.parse(window.localStorage.getItem(key) || '[]');
        existing.push({ ms: msRounded, ts: Date.now(), sector: currentUser?.data?.sector_id || null });
        const trimmed = existing.slice(-50);
        window.localStorage.setItem(key, JSON.stringify(trimmed));
      } catch (_) {}
      setReady(true);
    };

    // Heurística: el contenido se considera cargado cuando el DOM deja de mutar
    // por STABLE_WINDOW_MS (las queries terminaron y pintaron).
    const scheduleStable = () => {
      if (stableTimer) clearTimeout(stableTimer);
      stableTimer = setTimeout(() => {
        if (observer) observer.disconnect();
        track(performance.now() - start);
      }, STABLE_WINDOW_MS);
    };

    if (typeof MutationObserver !== 'undefined') {
      observer = new MutationObserver(() => scheduleStable());
      observer.observe(document.body, { childList: true, subtree: true, attributes: false });
    }
    scheduleStable();

    // Fallback: si no estabiliza en FALLBACK_MS, track igual (mide lentitud percibida)
    fallbackTimer = setTimeout(() => {
      if (observer) observer.disconnect();
      if (stableTimer) clearTimeout(stableTimer);
      track(performance.now() - start);
    }, FALLBACK_MS);

    return () => {
      cancelled = true;
      if (observer) observer.disconnect();
      if (stableTimer) clearTimeout(stableTimer);
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, [moduleKey, currentUser?.data?.sector_id]);

  return { ready };
}