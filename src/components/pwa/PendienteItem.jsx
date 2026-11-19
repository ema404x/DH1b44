import React from 'react';
import { format } from 'date-fns';
import { RefreshCw, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PendingPhotoThumb from '@/components/pwa/PendingPhotoThumb';

function opLabel(op) {
  if (op.kind === 'create_ot') return 'Nueva OT';
  if (op.kind === 'create_solicitud') return 'Propuesta de OT';
  if (op.kind === 'fichaje') return op.tipo === 'salida' ? 'Fichaje de salida' : 'Fichaje de entrada';
  if (op.kind === 'photo') return op.target === 'checklist' ? 'Foto de checklist' : 'Foto';
  if (op.kind === 'update_ot') return 'Cambio en OT';
  if (op.accion === 'iniciar') return 'Iniciar';
  if (op.accion === 'finalizar') return 'Finalizar y reporte';
  return op.accion || 'Cambio';
}

const STATUS = {
  pending: { text: 'Pendiente', cls: 'bg-muted text-muted-foreground' },
  sending: { text: 'Enviando', cls: 'bg-primary/15 text-primary' },
  attention: { text: 'Requiere atención', cls: 'bg-destructive/15 text-destructive' },
};

export default function PendienteItem({ op, onRetry, onDiscard }) {
  const status = STATUS[op.status] || STATUS.pending;
  const blobId = op.blob_id || op.blob_ids?.[0];
  const when = op.created_at ? format(new Date(op.created_at), 'dd/MM HH:mm') : '';

  return (
    <li className="flex gap-3 rounded-lg border border-border bg-card p-3">
      {blobId && <PendingPhotoThumb blobId={blobId} label={false} className="h-14 w-14 rounded-md flex-shrink-0" />}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground">{opLabel(op)}</span>
          <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${status.cls}`}>
            {op.status === 'sending' && <Loader2 className="h-3 w-3 animate-spin" />}
            {status.text}
          </span>
        </div>
        <p className="text-xs text-muted-foreground truncate">{op.ot_title || 'OT'} · {when}</p>
        {op.status === 'attention' && op.error && <p className="text-xs text-destructive">{op.error}</p>}
        {op.status !== 'sending' && (
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onRetry(op)}>
              <RefreshCw className="h-3 w-3" /> Reintentar ahora
            </Button>
            {op.status === 'attention' && (
              <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => onDiscard(op)}>
                <Trash2 className="h-3 w-3" /> Descartar
              </Button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}