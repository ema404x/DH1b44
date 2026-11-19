import React, { useEffect, useState } from 'react';
import { CloudOff, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { FICHAJE_SIN_CONEXION } from '@/lib/fichajeCuenta';
import { useOfflineEnabled } from '@/hooks/useOfflineOps';
import { getAllOps, subscribe } from '@/lib/offlineStore';
import PendientesPanel from '@/components/pwa/PendientesPanel';

/** Fichajes guardados en el teléfono que faltan enviar (propios y de otra cuenta). */
export default function FichajesPendientesAviso() {
  const { user } = useAuth();
  useOfflineEnabled(); // ata la cola a esta cuenta y arranca el envío si hay pendientes
  const [cuenta, setCuenta] = useState({ mios: 0, error: 0, ajenos: 0 });
  const [open, setOpen] = useState(false);
  const uid = user?.id || null;

  useEffect(() => {
    if (!FICHAJE_SIN_CONEXION) return undefined;
    let alive = true;
    const refresh = () => getAllOps().then((ops) => {
      if (!alive) return;
      const f = ops.filter((o) => o.kind === 'fichaje');
      const mios = f.filter((o) => o.user_id === uid);
      setCuenta({ mios: mios.length, error: mios.filter((o) => o.status === 'attention').length, ajenos: f.length - mios.length });
    }).catch(() => {});
    refresh();
    return subscribe(refresh);
  }, [uid]);

  if (!FICHAJE_SIN_CONEXION || (!cuenta.mios && !cuenta.ajenos)) return null;
  return (
    <div className="space-y-2">
      {cuenta.mios > 0 && (
        <button onClick={() => setOpen(true)} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left text-sm ${cuenta.error ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'border-amber-500/40 bg-amber-500/10 text-amber-400'}`}>
          {cuenta.error ? <AlertTriangle className="h-5 w-5 shrink-0" /> : <CloudOff className="h-5 w-5 shrink-0" />}
          <span className="flex-1">
            {cuenta.mios} fichaje{cuenta.mios !== 1 ? 's' : ''} guardado{cuenta.mios !== 1 ? 's' : ''} en el teléfono
            {cuenta.error ? ` · ${cuenta.error} con problema` : ' · se envían solos cuando hay señal'}
          </span>
          <span className="font-semibold underline underline-offset-2">Ver</span>
        </button>
      )}
      {cuenta.ajenos > 0 && (
        <p className="flex items-start gap-2 rounded-2xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Hay {cuenta.ajenos} fichaje{cuenta.ajenos !== 1 ? 's' : ''} guardado{cuenta.ajenos !== 1 ? 's' : ''} de otra cuenta en este teléfono. Se envían cuando esa cuenta vuelva a iniciar sesión acá.
        </p>
      )}
      <PendientesPanel open={open} onOpenChange={setOpen} />
    </div>
  );
}