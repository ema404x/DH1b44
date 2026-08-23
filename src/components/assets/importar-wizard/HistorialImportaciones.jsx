import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2, History, RotateCcw, CheckCircle2, AlertTriangle, FileText, FileSpreadsheet } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const formatDate = (d) => {
  try { return d ? new Date(d).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : ''; }
  catch { return d || ''; }
};

// Pestaña Historial: lista de importaciones recientes + revertir (rollback).
export default function HistorialImportaciones({ onRollbackDone }) {
  const qc = useQueryClient();
  const [reverting, setReverting] = useState(null); // importacion_id en proceso
  const [confirm, setConfirm] = useState(null); // registro a confirmar
  const [rollbackResult, setRollbackResult] = useState(null);

  const { data: importaciones = [], isLoading } = useQuery({
    queryKey: ['importaciones-activos'],
    queryFn: () => base44.entities.ImportacionActivos.list('-created_date', 50),
    staleTime: 1000 * 30,
  });

  const handleRevertir = async () => {
    if (!confirm) return;
    setReverting(confirm.id);
    try {
      const res = await base44.functions.invoke('rollbackImportacion', { importacion_id: confirm.id });
      setRollbackResult(res.data || res);
      onRollbackDone?.();
      qc.invalidateQueries({ queryKey: ['importaciones-activos'] });
    } catch (err) {
      setRollbackResult({ error: err.message || 'Error al revertir' });
    } finally {
      setReverting(null);
      setConfirm(null);
    }
  };

  return (
    <div className="space-y-3 overflow-y-auto pr-1">
      {rollbackResult && (
        <div className={`flex items-start gap-2 text-xs p-2.5 rounded-md ${rollbackResult.error ? 'text-destructive bg-destructive/10' : 'text-emerald-600 bg-emerald-500/10'}`}>
          {rollbackResult.error
            ? <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            : <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />}
          <span>{rollbackResult.error || rollbackResult.mensaje || 'Importación revertida'}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : importaciones.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
          <History className="h-10 w-10 opacity-30" />
          <p className="text-sm font-medium">Sin importaciones registradas</p>
          <p className="text-xs">Las importaciones que hagas aparecerán acá para revertirlas.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {importaciones.map(imp => {
            const revertida = imp.estado === 'revertida' || imp.estado === 'revertida_parcial';
            return (
              <div key={imp.id} className={`rounded-lg border p-3 ${revertida ? 'border-border/50 opacity-60' : 'border-border'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 min-w-0">
                    {imp.tipo === 'pdf'
                      ? <FileText className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                      : <FileSpreadsheet className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{imp.file_name || 'Importación'}</p>
                      <p className="text-[11px] text-muted-foreground">{formatDate(imp.created_date)}</p>
                    </div>
                  </div>
                  {revertida ? (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                      {imp.estado === 'revertida_parcial' ? 'Revertida parcial' : 'Revertida'}
                    </span>
                  ) : (
                    <button
                      onClick={() => { setConfirm(imp); setRollbackResult(null); }}
                      disabled={reverting === imp.id}
                      className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-500 px-2 py-1 rounded-md hover:bg-amber-500/10 shrink-0 disabled:opacity-50"
                    >
                      {reverting === imp.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                      Revertir
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 mt-2 text-[11px] text-muted-foreground">
                  <span className="text-emerald-600">+{imp.created || 0} creados</span>
                  <span className="text-indigo-400">↻{imp.updated || 0} actualizados</span>
                  {imp.sedes_creadas_ids?.length > 0 && <span className="text-blue-400">🏬{imp.sedes_creadas_ids.length} sedes</span>}
                  {revertida && <span className="text-muted-foreground">por {imp.reverted_by_email || imp.reverted_by}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Revertir esta importación?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrarán los <strong>{confirm?.created_ids?.length || 0}</strong> activo(s) creado(s) y se restaurarán los <strong>{confirm?.updated_ids?.length || 0}</strong> actualizado(s) a su valor anterior.
              {confirm?.snapshot_completo === false && ' Algunas actualizaciones no tienen snapshot y no se restaurarán (reversión parcial).'}
              {' '}Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!reverting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevertir}
              disabled={!!reverting}
              className="bg-amber-600 hover:bg-amber-500 text-white"
            >
              {reverting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sí, revertir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}