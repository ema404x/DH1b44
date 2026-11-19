import React, { useEffect, useState } from 'react';

const fmt = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const fmtDia = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', weekday: 'long', day: 'numeric', month: 'long' });

export default function RelojVivo() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="text-center">
      <p className="text-5xl font-bold tabular-nums tracking-tight text-foreground">{fmt.format(now)}</p>
      <p className="mt-1 text-sm capitalize text-muted-foreground">{fmtDia.format(now)}</p>
    </div>
  );
}