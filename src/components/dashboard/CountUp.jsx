import React, { useEffect, useRef, useState } from 'react';

// Animación count-up premium para KPIs numéricos.
// - Números: animan de valor previo al nuevo con easing cúbico.
// - Strings (ej. montos ya formateados con $): se renderizan directo, sin animar.
// - Respeta prefers-reduced-motion.
export default function CountUp({ value, duration = 900 }) {
  const isNumber = typeof value === 'number' && !Number.isNaN(value);

  const [display, setDisplay] = useState(isNumber ? 0 : value);
  const fromRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!isNumber) return;
    const reduce = typeof window !== 'undefined'
      && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const target = value;
    const from = fromRef.current;
    if (reduce || from === target) {
      setDisplay(target);
      fromRef.current = target;
      return;
    }
    const start = performance.now();
    cancelAnimationFrame(rafRef.current);
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (target - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(target);
        fromRef.current = target;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration, isNumber]);

  const shown = isNumber ? Math.round(display) : value;
  return <>{shown}</>;
}