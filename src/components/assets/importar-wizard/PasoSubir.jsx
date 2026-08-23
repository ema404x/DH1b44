import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Download, Upload, FileSpreadsheet, FileText, Building2, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { downloadPlantillaActivos } from '@/utils/exportActivosExcel';

// Paso 1 del wizard: selección de archivo(s) + toggle de auto-creación de sedes.
export default function PasoSubir({ files, setFiles, autoCreateLocations, setAutoCreateLocations, onAnalizar, error }) {
  const inputRef = useRef(null);
  const hasPdf = files.some(f => f.kind === 'pdf');

  const onSelect = (e) => {
    const picked = Array.from(e.target.files || []);
    const mapped = picked.map(f => ({ file: f, kind: /\.pdf$/i.test(f.name) ? 'pdf' : 'excel' }));
    setFiles(prev => [...prev, ...mapped]);
    if (e.target.value) e.target.value = '';
  };
  const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx));

  return (
    <div className="space-y-4 overflow-y-auto pr-1">
      {/* Plantilla (solo flujo Excel) */}
      {!hasPdf && (
        <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <Download className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <div className="text-xs">
            <p className="font-medium mb-1">1. Descargar plantilla</p>
            <p className="text-muted-foreground">Plantilla Excel con los encabezados correctos. Completá una fila por activo.</p>
            <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={downloadPlantillaActivos}>
              <Download className="h-3.5 w-3.5" /> Plantilla
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-start gap-3 rounded-lg border border-border p-3">
        <Upload className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
        <div className="flex-1 text-xs">
          <p className="font-medium mb-1">{hasPdf ? 'Subir PDF(s) con el inventario' : '2. Subir archivo completado'}</p>
          <p className="text-muted-foreground mb-2">
            {hasPdf
              ? 'Se extrae la lista de activos de cada PDF. Podés combinar varios en un mismo lote.'
              : '.xlsx o .csv. La columna de ubicación identifica la sede del activo.'}
          </p>
          <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv,.pdf" multiple className="hidden" onChange={onSelect} />
          <div className="flex gap-2 flex-wrap items-center">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => inputRef.current?.click()}>
              Seleccionar archivos
            </Button>
            {files.length === 0 && <span className="text-xs text-muted-foreground">Excel, CSV o PDF</span>}
          </div>
          {files.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {files.map((f, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded-md border border-border bg-background/60 px-2 py-1.5">
                  {f.kind === 'pdf'
                    ? <FileText className="h-3.5 w-3.5 text-red-500 shrink-0" />
                    : <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                  <span className="text-xs truncate flex-1">{f.file.name}</span>
                  <button onClick={() => removeFile(idx)} className="text-muted-foreground hover:text-foreground shrink-0">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Auto-creación de sedes */}
      <div className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
        <Building2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1 text-xs">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium mb-0.5">Crear sedes faltantes automáticamente</p>
              <p className="text-muted-foreground">Las sedes del archivo que no existan se crean como LocationData + Edificio y se vinculan al activo.</p>
            </div>
            <Switch checked={autoCreateLocations} onCheckedChange={setAutoCreateLocations} />
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2 text-xs text-blue-600 bg-blue-500/10 p-2.5 rounded-md">
        <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <span>Al tocar Analizar se valida el archivo <strong>sin escribir nada</strong>. Revisás la vista previa y confirmás después.</span>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 p-2.5 rounded-md">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex justify-end pt-1">
        <Button onClick={onAnalizar} disabled={files.length === 0}>
          <Upload className="h-4 w-4" /> Analizar
        </Button>
      </div>
    </div>
  );
}