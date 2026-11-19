import React from 'react';
import { Building2, Users, Activity, LogIn } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { horaAR } from './formato';

function Bloque({ icon: Icon, titulo, children }) {
  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {titulo}
      </p>
      {children}
    </div>
  );
}

const Vacio = ({ texto }) => <p className="text-xs text-muted-foreground italic">{texto}</p>;

export default function LugarCard({ lugar }) {
  return (
    <div className="acero-rise rounded-2xl border border-border/60 bg-card p-4 space-y-3.5">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0"><Building2 className="h-5 w-5 text-primary" /></div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{lugar.name}</p>
          {lugar.address && <p className="text-xs text-muted-foreground truncate">{lugar.address}</p>}
        </div>
        <span className="text-lg font-bold tabular-nums text-primary">{lugar.hoy.length}</span>
      </div>
      <Bloque icon={Users} titulo="Asignados">
        {lugar.assigned_employees.length ? (
          <div className="flex flex-wrap gap-1">{lugar.assigned_employees.map((n) => <Badge key={n} variant="secondary" className="text-xs">{n}</Badge>)}</div>
        ) : <Vacio texto="Sin cuadrilla asignada" />}
      </Bloque>
      <Bloque icon={LogIn} titulo="Ficharon hoy">
        {lugar.hoy.length ? lugar.hoy.map((p) => (
          <div key={p.nombre} className="flex items-center justify-between text-xs">
            <span className="truncate">{p.nombre}</span>
            <span className="tabular-nums text-muted-foreground">{horaAR(p.entrada)}{p.abierta && ' · en el lugar'}</span>
          </div>
        )) : <Vacio texto="Nadie fichó hoy" />}
      </Bloque>
      <Bloque icon={Activity} titulo={`Últimos 7 días · ${lugar.total} fichajes`}>
        {lugar.semana.length ? <p className="text-xs text-muted-foreground">{lugar.semana.join(', ')}</p> : <Vacio texto="Sin actividad" />}
      </Bloque>
    </div>
  );
}