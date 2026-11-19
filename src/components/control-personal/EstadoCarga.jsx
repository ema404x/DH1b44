import React from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';

export default function EstadoCarga({ error, texto = 'Cargando…' }) {
  if (error) {
    const msg = error?.response?.data?.error || error?.message || 'No se pudo cargar la información.';
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-5 text-sm text-destructive">
        <AlertTriangle className="h-5 w-5 shrink-0" /> {msg}
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" /> {texto}
    </div>
  );
}