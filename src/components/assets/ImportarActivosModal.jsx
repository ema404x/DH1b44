import React, { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Download, Upload, CheckCircle2, AlertTriangle, FileSpreadsheet, Building2 } from 'lucide-react';
import { downloadPlantillaActivos } from '@/utils/exportActivosExcel';

export default function ImportarActivosModal({ open, onOpenChange }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [autoCreateLocations, setAutoCreateLocations] = useState(true);
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const inputRef = useRef(null);

  // auto-creación de ubicaciones: default ON para BAPRO (sector sin sedes precargadas),
  // OFF para escuela (las sedes ya existen y no queremos crear duplicados por error de tipeo).
  const sector = user?.data?.sector_id || user?.sector_id;
  const isBapro = sector === 'bapro';

  const reset = () => { setFile(null); setResult(null); setError(null); };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      // BAPRO usa el importer con auto-creación; escuela usa el importer clásico.
      const fnName = isBapro ? 'importarActivosBapro' : 'importarActivosExcel';
      const payload = isBapro ? { file_url, auto_create_locations: autoCreateLocations } : { file_url };
      const res = await base44.functions.invoke(fnName, payload);
      setResult(res.data || res);
      qc.invalidateQueries({ queryKey: ['assets'] });
      qc.invalidateQueries({ queryKey: ['edificios'] });
    } catch (err) {
      setError(err.message || 'Error al importar');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar Activos desde Excel
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <Download className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <div className="text-xs">
              <p className="font-medium mb-1">1. Descargar plantilla</p>
              <p className="text-muted-foreground">Descarga la plantilla Excel con los encabezados correctos, completá una fila por activo.</p>
              <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={downloadPlantillaActivos}>
                <Download className="h-3.5 w-3.5" /> Plantilla
              </Button>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-border p-3">
            <Upload className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="flex-1 text-xs">
              <p className="font-medium mb-1">2. Subir archivo completado</p>
              <p className="text-muted-foreground mb-2">.xlsx o .csv. La columna de ubicación (Sede, Edificio, Establecimiento, Ubicacion, Lugar, Dirección, etc.) identifica dónde está el activo. {isBapro ? 'Las sedes faltantes se crean automáticamente.' : 'La sede debe coincidir con un edificio del mapa.'}</p>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => inputRef.current?.click()}>
                  Seleccionar archivo
                </Button>
                {file && <span className="text-xs text-muted-foreground self-center truncate max-w-[180px]">{file.name}</span>}
              </div>
            </div>
          </div>

          {isBapro && (
            <div className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <Building2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium mb-0.5">Crear ubicaciones faltantes automáticamente</p>
                    <p className="text-muted-foreground">Las sedes del Excel que no existan se crean como LocationData + Edificio y se vinculan al activo.</p>
                  </div>
                  <Switch checked={autoCreateLocations} onCheckedChange={setAutoCreateLocations} />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 p-2.5 rounded-md">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-600">
                <CheckCircle2 className="h-4 w-4" /> Importación completada
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="rounded bg-background/60 p-2">
                  <div className="text-lg font-bold text-emerald-600 tabular-nums">{result.created || 0}</div>
                  <div className="text-muted-foreground">Creados</div>
                </div>
                <div className="rounded bg-background/60 p-2">
                  <div className="text-lg font-bold text-blue-600 tabular-nums">{result.updated || 0}</div>
                  <div className="text-muted-foreground">Actualizados</div>
                </div>
                <div className="rounded bg-background/60 p-2">
                  <div className="text-lg font-bold text-amber-600 tabular-nums">{result.duplicados || 0}</div>
                  <div className="text-muted-foreground">Duplicados</div>
                </div>
                <div className="rounded bg-background/60 p-2">
                  <div className="text-lg font-bold text-destructive tabular-nums">{result.errors || 0}</div>
                  <div className="text-muted-foreground">Errores</div>
                </div>
              </div>
              {result.sedes_creadas > 0 && (
                <div className="text-[11px] text-emerald-600 mt-1">
                  <Building2 className="h-3 w-3 inline mr-1" />
                  {result.sedes_creadas} sede(s) nueva(s) creada(s) y vinculada(s) automáticamente.
                </div>
              )}
              {result.parseErrors?.length > 0 && (
                <div className="text-[11px] text-amber-600 max-h-20 overflow-y-auto mt-1 space-y-0.5">
                  {result.parseErrors.slice(0, 10).map((e, i) => <div key={i}>• {e}</div>)}
                </div>
              )}
              {result.errorDetails?.length > 0 && (
                <div className="text-[11px] text-muted-foreground max-h-24 overflow-y-auto mt-2 space-y-0.5">
                  {result.errorDetails.map((e, i) => <div key={i}>• {e}</div>)}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          <Button onClick={handleUpload} disabled={!file || uploading}>
            {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
            Importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}