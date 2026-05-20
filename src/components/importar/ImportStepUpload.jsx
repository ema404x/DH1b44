import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, FileSpreadsheet, FileText, AlertCircle, Loader2, File, X, Eye, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

const SUPPORTED_ENTITIES = [
  { label: 'Clientes', color: 'bg-blue-100 text-blue-700' },
  { label: 'Empleados', color: 'bg-purple-100 text-purple-700' },
  { label: 'Materiales', color: 'bg-amber-100 text-amber-700' },
  { label: 'Proyectos', color: 'bg-emerald-100 text-emerald-700' },
  { label: 'Órdenes de Trabajo', color: 'bg-orange-100 text-orange-700' },
  { label: 'Activos', color: 'bg-red-100 text-red-700' },
  { label: 'Preciario Ministerial', color: 'bg-slate-100 text-slate-700' },
  { label: 'Presupuestos', color: 'bg-teal-100 text-teal-700' },
  { label: 'Facturas', color: 'bg-pink-100 text-pink-700' },
];

export default function ImportStepUpload({ onFileUploaded }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState(null); // { file, rawData }
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
            if (json.length > 1) sheets[name] = json;
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
    const isValid = ['.xlsx', '.xls', '.csv'].some(ext => file.name.toLowerCase().endsWith(ext));
    if (!isValid) {
      toast.error('Solo se admiten archivos Excel (.xlsx, .xls) o CSV');
      return;
    }
    try {
      const rawData = await readFileData(file);
      if (Object.keys(rawData).length === 0) {
        toast.error('El archivo no contiene datos válidos');
        return;
      }
      setPreview({ file, rawData });
    } catch (err) {
      toast.error('Error al leer el archivo: ' + err.message);
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
    e.target.value = '';
  };

  const handleConfirmUpload = async () => {
    if (!preview) return;
    setIsUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: preview.file });
      onFileUploaded(preview.file, file_url, preview.rawData);
    } catch (err) {
      toast.error('Error al subir el archivo: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const totalRows = preview ? Object.values(preview.rawData).reduce((acc, rows) => acc + Math.max(0, rows.length - 1), 0) : 0;
  const sheetCount = preview ? Object.keys(preview.rawData).length : 0;

  if (preview) {
    return (
      <div className="space-y-5">
        {/* File info */}
        <div className="flex items-center gap-4 p-4 bg-card border rounded-xl">
          <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{preview.file.name}</p>
            <p className="text-sm text-muted-foreground">
              {sheetCount} hoja{sheetCount !== 1 ? 's' : ''} · {totalRows.toLocaleString()} filas de datos
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setPreview(null)} className="flex-shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Sheets preview */}
           <div className="space-y-3">
             <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
               <Info className="h-4 w-4 text-blue-600 flex-shrink-0" />
               <span className="text-xs text-blue-700"><strong>Tip:</strong> Revisá que las columnas y datos se vean correctos antes de continuar.</span>
             </div>
             <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vista previa de hojas detectadas</p>
             {Object.entries(preview.rawData).map(([sheetName, rows]) => {
            // Find first non-empty row as headers
            let headerRowIdx = 0;
            for (let i = 0; i < Math.min(rows.length, 5); i++) {
              const row = rows[i] || [];
              const nonEmptyCells = row.filter(cell => cell && String(cell).trim());
              if (nonEmptyCells.length > 0) {
                headerRowIdx = i;
                break;
              }
            }
            const headers = rows[headerRowIdx] || [];
            const sampleRow = rows[headerRowIdx + 1] || [];
            const rowCount = Math.max(0, rows.length - headerRowIdx - 1);
            return (
              <Card key={sheetName} className="overflow-hidden">
                <CardHeader className="py-3 px-4 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-semibold">{sheetName}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">{rowCount.toLocaleString()} filas</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/20">
                        {headers.slice(0, 6).map((h, i) => (
                          <th key={i} className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">{String(h)}</th>
                        ))}
                        {headers.length > 6 && <th className="px-3 py-2 text-muted-foreground">+{headers.length - 6} más</th>}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {headers.slice(0, 6).map((_, i) => (
                          <td key={i} className="px-3 py-2 text-foreground/70 whitespace-nowrap truncate max-w-32">
                            {String(sampleRow[i] ?? '—')}
                          </td>
                        ))}
                        {headers.length > 6 && <td className="px-3 py-2 text-muted-foreground">...</td>}
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setPreview(null)} disabled={isUploading}>
            Cambiar archivo
          </Button>
          <Button onClick={handleConfirmUpload} disabled={isUploading} className="flex-1 gap-2">
            {isUploading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Subiendo...</>
            ) : (
              <><Upload className="h-4 w-4" /> Analizar con IA — {totalRows.toLocaleString()} filas</>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Drop Zone */}
      <div
        className={`border-2 border-dashed rounded-2xl transition-all cursor-pointer ${
          isDragging ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border hover:border-primary/50 hover:bg-muted/20'
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className={`h-20 w-20 rounded-2xl flex items-center justify-center transition-all ${isDragging ? 'bg-primary/20' : 'bg-primary/10'}`}>
            <Upload className={`h-10 w-10 transition-colors ${isDragging ? 'text-primary' : 'text-primary/70'}`} />
          </div>
          <div className="text-center">
            <p className="font-bold text-lg">Arrastrá tu archivo aquí</p>
            <p className="text-sm text-muted-foreground mt-1">o hacé clic para seleccionar desde tu dispositivo</p>
          </div>
          <div className="flex gap-2">
            {['.xlsx', '.xls', '.csv'].map(ext => (
              <span key={ext} className="px-3 py-1.5 bg-card border border-border rounded-lg text-xs font-mono font-semibold text-muted-foreground">{ext}</span>
            ))}
          </div>
        </div>
      </div>

      <input ref={inputRef} type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} />

      {/* Supported entities */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Entidades detectables automáticamente</p>
        <div className="flex flex-wrap gap-2">
          {SUPPORTED_ENTITIES.map(e => (
            <span key={e.label} className={`px-3 py-1.5 rounded-full text-xs font-medium ${e.color}`}>{e.label}</span>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { step: '1', title: 'Subís tu archivo', desc: 'Excel o CSV con cualquier estructura de columnas', icon: FileSpreadsheet },
          { step: '2', title: 'La IA mapea todo', desc: 'Detecta entidades y relaciona columnas automáticamente', icon: AlertCircle },
          { step: '3', title: 'Revisás y confirmás', desc: 'Ajustás el mapeo si es necesario y ejecutás la importación', icon: File },
        ].map(({ step, title, desc, icon: Icon }) => (
          <div key={step} className="flex gap-3 p-4 bg-muted/30 rounded-xl">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">{step}</div>
            <div>
              <p className="font-semibold text-sm">{title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}