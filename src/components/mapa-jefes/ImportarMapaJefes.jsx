import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, X, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function ImportarMapaJefes({ onDone, onCancel }) {
  const [file, setFile] = useState(null);
  const [step, setStep] = useState('idle'); // idle | uploading | importing | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (f) setFile(f);
  };

  const handleImport = async () => {
    if (!file) return;
    setStep('uploading');
    setError('');
    try {
      // 1. Subir el archivo
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // 2. Llamar a la función de importación
      setStep('importing');
      const res = await base44.functions.invoke('importarJefesMapaExcel', { file_url });
      setResult(res.data);
      setStep('done');
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Error desconocido');
      setStep('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            <h2 className="font-bold text-lg">Importar Excel</h2>
          </div>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Idle / pick file */}
          {(step === 'idle' || step === 'error') && (
            <>
              <div className="text-sm text-muted-foreground">
                Seleccioná el archivo Excel con las hojas <strong>Detalle por Dirección</strong>.
                El proceso geocodificará cada dirección y guardará las coordenadas permanentemente.
                <br />
                <span className="text-amber-600 font-medium">⚠ El proceso puede tardar ~2 minutos (103 direcciones a 1/segundo).</span>
              </div>

              <label className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-8 cursor-pointer transition-colors ${
                file ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
              }`}>
                <Upload className={`h-8 w-8 ${file ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="text-center">
                  {file ? (
                    <>
                      <p className="font-medium text-sm text-primary">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-sm">Seleccionar archivo</p>
                      <p className="text-xs text-muted-foreground">Excel (.xlsx)</p>
                    </>
                  )}
                </div>
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
              </label>

              {step === 'error' && (
                <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={onCancel} className="flex-1">Cancelar</Button>
                <Button onClick={handleImport} disabled={!file} className="flex-1 gap-2">
                  <Upload className="h-4 w-4" /> Importar
                </Button>
              </div>
            </>
          )}

          {/* Uploading */}
          {step === 'uploading' && (
            <div className="text-center py-6 space-y-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
              <p className="font-medium">Subiendo archivo...</p>
              <p className="text-sm text-muted-foreground">Esto tardará unos segundos</p>
            </div>
          )}

          {/* Importing */}
          {step === 'importing' && (
            <div className="text-center py-6 space-y-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
              <p className="font-medium">Geocodificando y guardando datos...</p>
              <p className="text-sm text-muted-foreground">
                Procesando 103 direcciones con Nominatim.<br />
                Por favor, no cierres esta ventana. Puede tardar ~2 minutos.
              </p>
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-primary animate-pulse w-full" />
              </div>
            </div>
          )}

          {/* Done */}
          {step === 'done' && result && (
            <div className="text-center py-6 space-y-4">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
              <div>
                <p className="font-bold text-lg">¡Importación completada!</p>
                <p className="text-sm text-muted-foreground mt-1">{result.mensaje}</p>
              </div>
              <Button onClick={onDone} className="w-full">Ver en el mapa</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}