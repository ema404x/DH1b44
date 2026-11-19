import React from 'react';
import { Timer, UserX, AlertTriangle, ShieldAlert } from 'lucide-react';
import SinHorarioAviso from './SinHorarioAviso';
import { fechaCorta } from './formato';

function Tile({ icon: Icon, label, value, tone }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 px-3.5 py-3">
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${tone}`}><Icon className="h-4 w-4" /></div>
      <p className="text-2xl font-bold tabular-nums mt-2 leading-none">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1 leading-tight">{label}</p>
    </div>
  );
}

export default function PersonaResumen({ data, onConfigurarHorario }) {
  const sinHorario = !data.horario;
  const noActivo = data.empleado.status !== 'activo';
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Últimos {data.periodoDias} días · {data.totalFichajes} fichajes</p>
      {sinHorario && <SinHorarioAviso compacto onConfigurar={onConfigurarHorario} />}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Tile icon={Timer} label="Llegadas tarde" value={sinHorario ? '—' : data.tardanzas} tone="text-amber-400 bg-amber-500/15" />
        <Tile icon={UserX} label="Ausencias" value={sinHorario ? '—' : data.ausencias} tone="text-red-400 bg-red-500/15" />
        <Tile icon={AlertTriangle} label="Salidas omitidas" value={data.salidasOmitidas} tone="text-orange-400 bg-orange-500/15" />
        <Tile icon={ShieldAlert} label="Incidencias" value={data.incidencias} tone="text-violet-400 bg-violet-500/15" />
      </div>
      {!sinHorario && noActivo && (
        <p className="text-xs text-muted-foreground">La ficha está en {data.empleado.status}: no se cuentan ausencias.</p>
      )}
      {!sinHorario && data.ausenciasFechas.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Ausencias recientes: {data.ausenciasFechas.slice(0, 8).map(fechaCorta).join(', ')}
        </p>
      )}
    </div>
  );
}