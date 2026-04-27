import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AsignadorJefesEscuelas({ onSuccess }) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await base44.functions.invoke('asignarJefesEscuelas', formData);

      setResult({
        success: response.data.success,
        updated: response.data.updated,
        errors: response.data.errors,
        totalErrors: response.data.totalErrors,
      });

      if (response.data.success) {
        toast.success(`✅ ${response.data.updated} escuelas asignadas correctamente`);
        setTimeout(() => {
          onSuccess?.();
          setResult(null);
        }, 2000);
      }
    } catch (error) {
      toast.error('Error al procesar archivo');
      setResult({
        success: false,
        error: error.message,
      });
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-dashed border-2 hover:border-primary/50 transition-colors cursor-pointer">
        <CardContent className="pt-6">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-3 py-8 cursor-pointer"
          >
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-slate-900">Cargar listado de escuelas</p>
              <p className="text-sm text-muted-foreground mt-1">
                Haz clic para seleccionar el archivo Excel
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              disabled={isLoading}
              className="hidden"
            />
          </div>

          {isLoading && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Procesando...
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card className={result.success ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-start gap-3">
              {result.success ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                {result.success ? (
                  <>
                    <p className="font-semibold text-emerald-900">Asignación completada</p>
                    <p className="text-sm text-emerald-700 mt-1">
                      ✅ {result.updated} escuelas asignadas a sus jefes de sitio
                    </p>
                    {result.totalErrors > 0 && (
                      <div className="mt-2 text-xs text-emerald-600">
                        ⚠️ {result.totalErrors} escuela(s) no encontrada(s)
                        {result.errors.length > 0 && (
                          <div className="mt-1 space-y-1 bg-white/60 rounded p-1.5">
                            {result.errors.map((err, i) => (
                              <div key={i}>{err}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-red-900">Error en la asignación</p>
                    <p className="text-sm text-red-700 mt-1">{result.error}</p>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}