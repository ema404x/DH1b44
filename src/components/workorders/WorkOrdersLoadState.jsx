import React from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function WorkOrdersLoadState({ loading, error, onRetry }) {
  if (loading) return (
    <div role="status" className="flex items-center justify-center gap-3 rounded-lg border border-border bg-card p-8 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" /> Cargando órdenes de trabajo…
    </div>
  );
  if (!error) return null;
  return (
    <div role="alert" className="rounded-lg border border-destructive bg-card p-5 text-foreground">
      <div className="flex items-center gap-2 font-semibold"><AlertCircle className="h-5 w-5 text-destructive" /> No se pudieron cargar las órdenes</div>
      <p className="mt-2 text-sm text-muted-foreground">{error}</p>
      <p className="mt-1 text-sm text-muted-foreground">Este error no significa que las órdenes se hayan eliminado.</p>
      <Button variant="outline" onClick={() => onRetry()} className="mt-4">Reintentar carga</Button>
    </div>
  );
}