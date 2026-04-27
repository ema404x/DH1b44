import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AsignadorJefesEscuelas({ onSuccess }) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [selectedComuna, setSelectedComuna] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedComuna) {
      toast.error('Selecciona una comuna primero');
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      // Subir el archivo
      const uploadRes = await base44.integrations.Core.UploadFile({ file });
      const fileUrl = uploadRes.file_url;

      // Procesar con la función backend
      const response = await base44.functions.invoke('procesarAsignacionJefes', {
        fileUrl,
        comunaId: selectedComuna,
      });

      setResult({
        success: response.data.success,
        updatedLocations: response.data.updatedLocations,
        errors: response.data.errors,
        message: response.data.message,
      });

      if (response.data.success) {
        toast.success(`✅ ${response.data.updatedLocations} escuelas actualizadas`);
        setTimeout(() => {
          onSuccess?.();
          setResult(null);
          setSelectedComuna('');
        }, 2000);
      }
    } catch (error) {
      toast.error('Error al procesar archivo');
      setResult({
        success: false,
        message: error.message,
      });
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-dashed border-2 hover:border-primary/50 transition-colors">
        <CardContent className="pt-6 space-y-4">
          <div>
            <label className="text-sm font-semibold block mb-2">Selecciona Comuna</label>
            <Select value={selectedComuna} onValueChange={setSelectedComuna}>
              <SelectTrigger>
                <SelectValue placeholder="8A, 8B o 10A" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="8A">Comuna 8A</SelectItem>
                <SelectItem value="8B">Comuna 8B</SelectItem>
                <SelectItem value="10A">Comuna 10A</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-3 py-8 cursor-pointer hover:bg-slate-50 rounded-lg transition-colors"
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
              disabled={isLoading || !selectedComuna}
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
                      ✅ {result.message}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-red-900">Error en la asignación</p>
                    <p className="text-sm text-red-700 mt-1">{result.message}</p>
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