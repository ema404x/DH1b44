import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

export default function ImportarObrasExcelModal({ onClose, onImported }) {
  const queryClient = useQueryClient();
  const fileRef = useRef();
  const [file, setFile] = useState(null);
  const [step, setStep] = useState('upload'); // upload | importing | done
  const [result, setResult] = useState(null);

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleImport = async () => {
    if (!file) return;
    setStep('importing');

    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    const res = await base44.functions.invoke('importarObrasExcel', { file_url });
    const data = res.data;

    queryClient.invalidateQueries({ queryKey: ['projects'] });
    setResult(data);
    setStep('done');

    if (data.imported > 0) {
      toast.success(`${data.imported} obras importadas correctamente`);
      onImported?.();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Importar Planilla de Obras
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Formato: NuevaPlanillaOBRAS — hoja "Planilla principal"
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-5 space-y-4">
          {step === 'upload' && (
            <>
              <div
                className="border-2 border-dashed border-slate-600 hover:border-primary/50 rounded-xl p-10 text-center cursor-pointer transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-10 w-10 text-slate-500 mx-auto mb-3" />
                {file ? (
                  <div>
                    <p className="font-medium text-white">{file.name}</p>
                    <p className="text-xs text-slate-400 mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                ) : (
                  <div>
                    <p className="font-medium text-slate-300">Seleccioná el archivo Excel</p>
                    <p className="text-xs text-slate-500 mt-1">NuevaPlanillaOBRAS.xlsx</p>
                  </div>
                )}
                <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
              </div>

              <div className="bg-slate-800/50 rounded-lg p-3 text-xs text-slate-400 space-y-1">
                <p className="font-semibold text-slate-300 mb-1">Columnas que se importan:</p>
                <p>• Título de obra → Nombre del proyecto</p>
                <p>• Nº Orden SAP → Código</p>
                <p>• Monto Base Feb-23 → Presupuesto estimado</p>
                <p>• AI / AR → Fecha inicio / fin</p>
                <p>• % Avance acumulado, Jefe de Sitio, Inspector</p>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
                <Button size="sm" disabled={!file} onClick={handleImport} className="gap-2">
                  <Upload className="h-4 w-4" /> Importar obras
                </Button>
              </div>
            </>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center gap-4 py-12">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <p className="font-medium text-white">Importando obras en lotes...</p>
              <p className="text-sm text-slate-400 text-center">
                Procesando en batches de 100 registros.<br />
                Para planillas de 2000+ obras, puede tardar 30–60 segundos.
              </p>
            </div>
          )}

          {step === 'done' && result && (
            <div className="space-y-4">
              <div className={`flex items-center gap-3 p-4 rounded-lg border ${result.errors === 0 ? 'bg-emerald-950/50 border-emerald-500/30' : 'bg-amber-950/50 border-amber-500/30'}`}>
                {result.errors === 0
                  ? <CheckCircle2 className="h-6 w-6 text-emerald-400 flex-shrink-0" />
                  : <AlertCircle className="h-6 w-6 text-amber-400 flex-shrink-0" />
                }
                <div>
                  <p className="font-semibold text-white">{result.imported.toLocaleString()} obras importadas</p>
                  <p className="text-sm text-slate-400">{result.errors} errores</p>
                </div>
              </div>

              {result.errorDetails?.length > 0 && (
                <div className="bg-slate-800/50 rounded-lg p-3 max-h-32 overflow-y-auto">
                  <p className="text-xs font-semibold text-red-400 mb-1">Errores:</p>
                  {result.errorDetails.map((e, i) => (
                    <p key={i} className="text-xs text-slate-400">{e}</p>
                  ))}
                </div>
              )}

              <Button onClick={onClose} className="w-full">Cerrar</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}