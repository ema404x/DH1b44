import React from 'react';
import { WifiOff, ScanLine } from 'lucide-react';
import { irAFichajePublico } from '@/lib/modoOperario';

// Sin red: el fichaje con cuenta no se encola; se ofrece el fichaje público.
export default function SinConexionFichaje({ locId, mensaje, onReintentar }) {
  return (
    <div className="space-y-4 rounded-3xl border border-border bg-card p-5 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15">
        <WifiOff className="h-7 w-7 text-amber-400" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-card-foreground">Hace falta conexión</h2>
        <p className="mt-1 text-sm text-muted-foreground">{mensaje || 'Para fichar con tu cuenta necesitás conexión a internet. Podés fichar por el QR público como alternativa.'}</p>
      </div>
      {locId && (
        <button onClick={() => irAFichajePublico(locId)} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-bold text-primary-foreground active:scale-[0.98]">
          <ScanLine className="h-5 w-5" /> Fichar por QR público
        </button>
      )}
      {onReintentar && (
        <button onClick={onReintentar} className="h-12 w-full rounded-2xl border border-border text-sm font-semibold text-foreground">
          Reintentar
        </button>
      )}
    </div>
  );
}