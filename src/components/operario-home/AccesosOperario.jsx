import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanLine, PlusCircle, AlertTriangle, ChevronRight } from 'lucide-react';
import { usePermission } from '@/hooks/usePermission';
import { abrirEscanerOperario } from '@/lib/modoOperario';

function Acceso({ icon: Icon, label, onClick, tone }) {
  return (
    <button
      onClick={onClick}
      className="flex min-h-[64px] w-full items-center gap-4 rounded-2xl border border-border bg-card px-4 text-left transition-colors active:bg-accent"
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="flex-1 text-base font-medium text-card-foreground">{label}</span>
      <ChevronRight className="h-5 w-5 text-muted-foreground" />
    </button>
  );
}

/** Accesos grandes del Inicio operario. Cada uno se muestra solo con permiso, igual que el menú. */
export default function AccesosOperario({ onEmergencia }) {
  const navigate = useNavigate();
  const { allowed: puedeEscanear } = usePermission('MisOrdenes', 'read');
  const { allowed: puedeCrearOT } = usePermission('WorkOrder', 'read');
  const { allowed: puedeEmergencia } = usePermission('Emergencias', 'read');

  if (!puedeEscanear && !puedeCrearOT && !puedeEmergencia) return null;

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Accesos</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {puedeEscanear && (
          <Acceso icon={ScanLine} label="Escanear QR" onClick={abrirEscanerOperario} tone="bg-primary/15 text-primary" />
        )}
        {puedeCrearOT && (
          <Acceso icon={PlusCircle} label="Crear OT" onClick={() => navigate('/crear-ot')} tone="bg-emerald-400/15 text-emerald-300" />
        )}
        {puedeEmergencia && (
          <Acceso icon={AlertTriangle} label="Reportar emergencia" onClick={onEmergencia} tone="bg-destructive/15 text-destructive" />
        )}
      </div>
    </section>
  );
}