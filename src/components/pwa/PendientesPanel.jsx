import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useOfflineOps } from '@/hooks/useOfflineOps';
import { retryOp, discardOp } from '@/lib/offlineSyncEngine';
import PendienteItem from '@/components/pwa/PendienteItem';

/** Panel con la lista de cambios guardados en el dispositivo que faltan enviar. */
export default function PendientesPanel({ open, onOpenChange }) {
  const { ops } = useOfflineOps(open);
  const [toDiscard, setToDiscard] = useState(null);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Pendientes de enviar</DialogTitle>
            <DialogDescription>
              Están guardados en este dispositivo y se envían solos cuando hay señal.
            </DialogDescription>
          </DialogHeader>
          {ops.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No hay pendientes.</p>
          ) : (
            <ul className="flex-1 overflow-y-auto space-y-2 pr-1">
              {ops.map((op) => (
                <PendienteItem key={op.id} op={op} onRetry={(o) => retryOp(o.id)} onDiscard={setToDiscard} />
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDiscard} onOpenChange={(v) => { if (!v) setToDiscard(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar este cambio?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borra de este dispositivo y no se va a enviar
              {toDiscard?.kind === 'create_ot' ? ', junto con las fotos de esa OT' : ''}. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { discardOp(toDiscard.id); setToDiscard(null); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}