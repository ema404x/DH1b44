import React, { useState } from 'react';
import { Check, X, Save, Loader2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

// Barra de acciones abajo, al alcance del pulgar: Rechazar (con motivo) / Editar o Guardar / Aprobar.
export default function PropuestaAcciones({ dirty, busy, onEditar, onGuardar, onAprobar, onRechazar }) {
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState('');

  if (rechazando) {
    return (
      <div className="space-y-2">
        <Textarea rows={3} autoFocus placeholder="Motivo del rechazo (lo verá el operario)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-12" onClick={() => setRechazando(false)} disabled={busy}>Volver</Button>
          <Button variant="destructive" className="h-12" disabled={busy || !motivo.trim()} onClick={() => onRechazar(motivo.trim())}>
            {busy ? <Loader2 className="animate-spin" /> : <X />} Confirmar rechazo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      <Button variant="outline" className="h-12 text-destructive" onClick={() => setRechazando(true)} disabled={busy}>
        <X /> Rechazar
      </Button>
      {dirty ? (
        <Button variant="secondary" className="h-12" onClick={onGuardar} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Save />} Guardar
        </Button>
      ) : (
        <Button variant="outline" className="h-12" onClick={onEditar} disabled={busy}>
          <Pencil /> Editar
        </Button>
      )}
      <Button className="h-12" onClick={onAprobar} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <Check />} Aprobar
      </Button>
    </div>
  );
}