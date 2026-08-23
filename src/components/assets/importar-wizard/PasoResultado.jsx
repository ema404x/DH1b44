import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Building2, History, Plus, X, AlertTriangle } from 'lucide-react';

// Paso 3: resultado final de la importación.
export default function PasoResultado({ result, onVerHistorial, onNueva, onCerrar }) {
  if (!result) return null;
  const parcial = result.snapshot_completo === false;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-emerald-600">
        <CheckCircle2 className="h-5 w-5" />
        <span className="font-medium">Importación completada</span>
      </div>

      {result.extracted != null && (
        <p className="text-xs text-muted-foreground">
          {result.extracted} activo(s) extraído(s) de {result.files || 0} PDF(s)
        </p>
      )}

      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        <div className="rounded bg-emerald-500/10 p-3">
          <div className="text-2xl font-bold text-emerald-600 tabular-nums">{result.created || 0}</div>
          <div className="text-muted-foreground mt-0.5">Creados</div>
        </div>
        <div className="rounded bg-indigo-500/10 p-3">
          <div className="text-2xl font-bold text-indigo-400 tabular-nums">{result.updated || 0}</div>
          <div className="text-muted-foreground mt-0.5">Actualizados</div>
        </div>
        <div className="rounded bg-amber-500/10 p-3">
          <div className="text-2xl font-bold text-amber-500 tabular-nums">{result.duplicados || 0}</div>
          <div className="text-muted-foreground mt-0.5">Duplicados</div>
        </div>
        <div className="rounded bg-red-500/10 p-3">
          <div className="text-2xl font-bold text-red-400 tabular-nums">{result.errors || 0}</div>
          <div className="text-muted-foreground mt-0.5">Errores</div>
        </div>
      </div>

      {result.sedes_creadas > 0 && (
        <div className="text-xs text-emerald-600 flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5" />
          {result.sedes_creadas} sede(s) nueva(s) creada(s) y vinculada(s).
        </div>
      )}

      {result.importacion_id && (
        <div className="text-xs text-muted-foreground">
          Registro de importación guardado · podés revertirla desde el Historial.
        </div>
      )}

      {parcial && (
        <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-500/10 p-2.5 rounded-md">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>La importación tuvo muchas actualizaciones: el snapshot de rollback es parcial. Las creaciones y la mayoría de las actualizaciones sí se pueden revertir.</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2 justify-end pt-1">
        <Button variant="outline" onClick={onNueva}>
          <Plus className="h-4 w-4" /> Nueva importación
        </Button>
        <Button variant="outline" onClick={onVerHistorial}>
          <History className="h-4 w-4" /> Ver historial
        </Button>
        <Button onClick={onCerrar}>
          <X className="h-4 w-4" /> Cerrar
        </Button>
      </div>
    </div>
  );
}