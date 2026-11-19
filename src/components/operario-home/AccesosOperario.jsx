import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Lightbulb, AlertTriangle } from 'lucide-react';
import { usePermission } from '@/hooks/usePermission';

function Acceso({ icon: Icon, label, onClick, tone }) {
  return (
    <button
      onClick={onClick}
      className="flex min-h-[112px] w-full flex-col items-center justify-center gap-2.5 rounded-3xl border border-border bg-card px-3 text-center transition-transform active:scale-[0.97]"
    >
      <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tone}`}>
        <Icon className="h-6 w-6" />
      </span>
      <span className="text-base font-semibold leading-tight text-card-foreground">{label}</span>
    </button>
  );
}

/** Accesos grandes del Inicio operario: Proponer OT y, con permiso, Reportar emergencia. */
export default function AccesosOperario({ onEmergencia }) {
  const navigate = useNavigate();
  const { allowed: puedeEmergencia } = usePermission('Emergencias', 'read');

  return (
    <section className={`grid gap-3 ${puedeEmergencia ? 'grid-cols-2' : 'grid-cols-1'}`}>
      <Acceso icon={Lightbulb} label="Proponer OT" onClick={() => navigate('/proponer-ot')} tone="bg-emerald-400/15 text-emerald-300" />
      {puedeEmergencia && (
        <Acceso icon={AlertTriangle} label="Reportar emergencia" onClick={onEmergencia} tone="bg-destructive/15 text-destructive" />
      )}
    </section>
  );
}