import { useEffect, useState } from 'react';

const fmtHora = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** "08:15" en hora de Argentina, 24 h. */
export const horaAR = (iso) => (iso ? fmtHora.format(new Date(iso)) : '');

/** "2 h 13 min" / "45 min" desde iso hasta now. */
export function duracion(iso, now = new Date()) {
  const min = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60000));
  const h = Math.floor(min / 60);
  return h ? `${h} h ${min % 60} min` : `${min} min`;
}

/** Fecha actual que se actualiza cada minuto. */
export function useAhoraMinuto() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);
  return now;
}