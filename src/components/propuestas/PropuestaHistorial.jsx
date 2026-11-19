import React from 'react';
import { format } from 'date-fns';

const ACCIONES = { creada: 'Enviada', editada: 'Editada', aprobada: 'Aprobada', rechazada: 'Rechazada' };

export default function PropuestaHistorial({ historial = [] }) {
  if (!historial.length) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Historial</p>
      <ul className="space-y-1">
        {[...historial].reverse().map((h, i) => (
          <li key={i} className="text-[11px] text-muted-foreground leading-snug">
            <span className="text-foreground font-medium">{ACCIONES[h.accion] || h.accion}</span>
            {' · '}{h.usuario}{' · '}{h.fecha ? format(new Date(h.fecha), 'dd/MM/yyyy HH:mm') : ''}
            {h.accion === 'editada' && h.cambios && (
              <span className="block opacity-80">Cambió: {Object.keys(h.cambios).join(', ')}</span>
            )}
            {h.accion === 'rechazada' && h.cambios?.motivo && (
              <span className="block opacity-80">Motivo: {h.cambios.motivo}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}