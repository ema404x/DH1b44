import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, FileSpreadsheet, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

const SUPPORTED_ENTITIES = [
  'Clientes', 'Empleados', 'Materiales', 'Proyectos',
  'Órdenes de Trabajo', 'Activos', 'Preciario Ministerial',
  'Certificados', 'Presupuestos', 'Facturas'
];

export default function ImportStepUpload({ onFileUploaded }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef(null);

  const readFileData = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheets = {};
          workbook.SheetNames.forEach(name => {
            const ws = workbook.Sheets[name];
            const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
            if (json.length > 0) {
              sheets[name] = json.slice(0, 20); // primeras 20 filas para preview
            }
          });
          resolve(sheets);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const processFile = async (file) => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    const isValid = validTypes.includes(file.type) || file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (!isValid) {
      toast.error('Solo se admiten archivos Excel (.xlsx, .xls) o CSV');
      return;
    }

    setIsUploading(true);
    try {
      const rawData = await readFileData(file);
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onFileUploaded(file, file_url, rawData);
    } catch (err) {
      toast.error('Error al subir el archivo: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
  };

  return (
    <div className="space-y-6">
      {/* Drop Zone */}
      <Card
        className={`border-2 border-dashed transition-all cursor-pointer ${
          isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !isUploading && inputRef.current?.click()}
      >
        <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
          {isUploading ? (
            <>
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
              <p className="font-semibold">Subiendo archivo...</p>
            </>
          ) : (
            <>
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-lg">Arrastrá tu archivo aquí</p>
                <p className="text-sm text-muted-foreground mt-1">o hacé clic para seleccionar</p>
              </div>
              <div className="flex gap-2">
                {['.xlsx', '.xls', '.csv'].map(ext => (
                  <span key={ext} className="px-2.5 py-1 bg-muted rounded-md text-xs font-mono font-medium">{ext}</span>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <input ref={inputRef} type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} />

      {/* Supported entities */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Entidades detectables automáticamente</p>
        <div className="flex flex-wrap gap-2">
          {SUPPORTED_ENTITIES.map(e => (
            <span key={e} className="px-3 py-1 bg-card border border-border rounded-full text-xs font-medium">{e}</span>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="flex gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">¿Cómo funciona?</p>
          <p className="text-xs mt-1 text-blue-700">La IA analiza los encabezados y datos de tu archivo, detecta qué tipo de entidad es cada hoja y mapea automáticamente las columnas a los campos del sistema. Podés revisar y ajustar el mapeo antes de confirmar la importación.</p>
        </div>
      </div>
    </div>
  );
}