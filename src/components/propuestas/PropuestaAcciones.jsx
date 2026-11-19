import React, { useState } from 'react';
import { Check, X, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

// Botones Guardar / Rechazar (con motivo) / Aprobar.
export default function PropuestaAcciones({ dirty, busy, onGuardar, onAprobar, onRechazar }) {
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState('');

  if (rechazando) {
    return (
      <div className="space-y-2">
        <Textarea rows={3} autoFocus placeholder="Motivo del rechazo (lo verá el operario)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-11" onClick={() => setRechazando(false)} disabled={busy}>Volver</Button>
          <Button variant="destructive" className="h-11" disabled={busy || !motivo.trim()} onClick={() => onRechazar(motivo.trim())}>
            {busy ? <Loader2 className="animate-spin" /> : <X />} Confirmar rechazo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {dirty && (
        <Button variant="secondary" className="w-full h-11" onClick={onGuardar} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Save />} Guardar cambios
        </Button>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-11 text-destructive" onClick={() => setRechazando(true)} disabled={busy}>
          <X /> Rechazar
        </Button>
        <Button className="h-11" onClick={onAprobar} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Check />} Aprobar
        </Button>
      </div>
    </div>
  );
}