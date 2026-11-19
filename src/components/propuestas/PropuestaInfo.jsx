import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ESTADOS } from '@/lib/propuestasOT';

const Row = ({ label, value }) => value ? (
  <div className="flex justify-between gap-3 text-xs">
    <span className="text-muted-foreground shrink-0">{label}</span>
    <span className="text-foreground text-right">{value}</span>
  </div>
) : null;

export default function PropuestaInfo({ propuesta: p }) {
  const est = ESTADOS.find((e) => e.key === p.estado) || ESTADOS[0];
  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
      <span className={cn('inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border', est.cls)}>
        {est.label.replace(/s$/, '')}
      </span>
      <Row label="Solicitante" value={p.solicitante_nombre} />
      <Row label="Jefe a cargo" value={p.jefe_sitio || 'Sin asignar'} />
      <Row label="Activo" value={p.asset_name} />
      <Row label="Ubicación" value={p.location} />
      {p.estado !== 'enviada' && <Row label="Revisó" value={p.revisado_por} />}
      {p.estado === 'rechazada' && <Row label="Motivo" value={p.motivo_rechazo} />}
      {p.work_order_id && (
        <Link to="/ordenes" className="block text-xs text-primary font-medium pt-1">Ver la OT creada en Órdenes de Trabajo</Link>
      )}
    </div>
  );
}