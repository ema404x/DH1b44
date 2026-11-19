import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Línea bajo la tabla del horario: cuántos operarios se controlan y quiénes son.
export default function ControladosAviso({ controlados = [] }) {
  const [abierto, setAbierto] = useState(false);
  if (!controlados.length) {
    return (
      <p className="text-sm text-amber-400 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>No hay operarios cargados con DNI para controlar asistencia: cargalos en <Link to="/empleados" className="underline">Empleados</Link>.</span>
      </p>
    );
  }
  return (
    <>
      <p className="text-sm text-muted-foreground flex items-center gap-2">
        <Users className="h-4 w-4 shrink-0" />
        Se controla la asistencia de {controlados.length} operario{controlados.length === 1 ? '' : 's'}.
        <button type="button" onClick={() => setAbierto(true)} className="text-primary underline underline-offset-2">Ver lista</button>
      </p>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Operarios controlados ({controlados.length})</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-border/40 -mx-2">
            {controlados.map((e) => (
              <div key={e.id} className="px-2 py-2.5">
                <p className="text-sm font-medium">{e.full_name}</p>
                <p className="text-xs text-muted-foreground">{[e.role, e.dni ? `DNI ${e.dni}` : 'Sin DNI (se cruza por nombre)'].join(' · ')}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}