import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { base44 } from '@/api/base44Client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, X, ChevronRight, User, Table2
} from 'lucide-react';
import { toast } from 'sonner';

const STEPS = ['upload', 'preview', 'importing', 'result'];

export default function PendientesImportModal({ open, onOpenChange, onImported }) {
  const [step, setStep] = useState('upload');
  const [files, setFiles] = useState([]);
  const [processedData, setProcessedData] = useState([]);
  const [sheetPreview, setSheetPreview] = useState(null);
  const [inspectorName, setInspectorName] = useState('');
  const [inspectorEmail, setInspectorEmail] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileRef = useRef();

  const reset = () => {
    setStep('upload');
    setFiles([]);
    setProcessedData([]);
    setSheetPreview(null);
    setResult(null);
    setIsProcessing(false);
  };

  const processFiles = (fileList) => {
    const newFiles = Array.from(fileList);
    setFiles(prev => [...prev, ...newFiles]);
    let totalPreviewRows = 0;
    const allData = [];

    newFiles.forEach((f) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const raw = {};
        wb.SheetNames.forEach(name => {
          const ws = wb.Sheets[name];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          raw[name] = data;
        });

        allData.push({ filename: f.name, data: raw });
        if (allData.length === newFiles.length) {
          setProcessedData(allData);

          // Crear preview de todos los sheets
          const keys = [];
          allData.forEach(({ data }) => keys.push(...Object.keys(data)));
          const best = keys.find(k => {
            const n = k.toLowerCase();
            return n.includes('pendiente') || n.includes('sap') || n.includes('orden') || n.includes('aviso');
          }) || keys[0];

          let totalRows = 0;
          allData.forEach(({ data }) => {
            const sheetRows = data[best] || [];
            totalRows += Math.max(0, sheetRows.length - 1);
          });

          const sheetRows = allData[0]?.data[best] || [];
          const headers = (sheetRows[0] || []).map(h => String(h || '').trim());
          const previewRows = sheetRows.slice(1, 6).filter(r => r.some(c => c !== null && c !== undefined && c !== ''));

          setSheetPreview({ sheetName: best, headers, rows: previewRows, totalRows, fileCount: newFiles.length });
          setStep('preview');
        }
      };
      reader.readAsArrayBuffer(f);
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  };

  const handleFileChange = (e) => {
    processFiles(e.target.files);
  };

  const handleImport = async () => {
    setStep('importing');
    setIsProcessing(true);
    try {
      let totalImported = 0;
      let totalErrors = 0;

      // Procesar cada archivo secuencialmente
      for (const { data } of processedData) {
        const res = await base44.functions.invoke('importarPendientesSAP', {
          raw_data: data,
          inspector_name: inspectorName || null,
          inspector_email: inspectorEmail || null,
        });
        totalImported += res.data.totalImported || 0;
        totalErrors += res.data.totalErrors || 0;
      }

      setResult({
        imported: totalImported,
        errors: totalErrors,
        skipped: 0,
        total_rows: totalImported + totalErrors,
      });
      setStep('result');
      if (onImported) onImported();
    } catch (err) {
      toast.error('Error al importar: ' + err.message);
      setStep('preview');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar Pendientes SAP desde Excel
          </DialogTitle>
          <DialogDescription>
            Cargá el archivo Excel de SAP. La IA mapea automáticamente las columnas, detecta el inspector y la comuna, y asigna a los responsables.
          </DialogDescription>
        </DialogHeader>

        {/* Step: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'}`}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current.click()}
            >
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="font-semibold text-foreground">Arrastrá el archivo o hacé clic para seleccionar</p>
              <p className="text-sm text-muted-foreground mt-1">Formatos: .xlsx, .xls, .csv</p>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} multiple />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-1">
              <p className="font-semibold">¿Qué hace la importación?</p>
              <ul className="space-y-0.5 text-xs list-disc list-inside">
                <li>Detecta automáticamente las columnas del Excel SAP (N° Orden, Descripción, Sitio, etc.)</li>
                <li>Mapea <strong>Inspector</strong> y <strong>Comuna</strong> si están presentes</li>
                <li>Asigna automáticamente al Jefe de Sitio si el nombre coincide con un empleado del sistema</li>
                <li>Normaliza estados, prioridades y fechas de SAP al formato del sistema</li>
              </ul>
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && sheetPreview && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Table2 className="h-4 w-4 text-primary" />
                <span className="font-semibold">{sheetPreview.sheetName}</span>
                <Badge variant="secondary">{sheetPreview.totalRows} filas</Badge>
                <Badge variant="secondary">{sheetPreview.headers.length} columnas</Badge>
                {sheetPreview.fileCount > 1 && <Badge className="bg-blue-100 text-blue-700 border-blue-200">{sheetPreview.fileCount} archivos</Badge>}
              </div>
              <Button variant="ghost" size="sm" onClick={reset} className="gap-1 text-xs">
                <X className="h-3.5 w-3.5" /> Cambiar archivo
              </Button>
            </div>

            {/* Preview table */}
            <div className="rounded-lg border overflow-auto max-h-52">
              <table className="text-xs w-full">
                <thead>
                  <tr className="bg-muted/60">
                    {sheetPreview.headers.map((h, i) => (
                      <th key={i} className="px-2 py-1.5 text-left font-semibold border-r border-border whitespace-nowrap max-w-32 truncate">{h || `Col ${i + 1}`}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sheetPreview.rows.map((row, ri) => (
                    <tr key={ri} className="border-t border-border/50 hover:bg-muted/20">
                      {sheetPreview.headers.map((_, ci) => (
                        <td key={ci} className="px-2 py-1 border-r border-border/30 max-w-32 truncate text-muted-foreground">{String(row[ci] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Inspector override */}
            <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
              <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> Inspector que carga (opcional — si no está en el Excel)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Nombre del inspector</Label>
                  <Input
                    value={inspectorName}
                    onChange={e => setInspectorName(e.target.value)}
                    placeholder="Ej: Carlos Rodríguez"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email del inspector</Label>
                  <Input
                    value={inspectorEmail}
                    onChange={e => setInspectorEmail(e.target.value)}
                    placeholder="inspector@empresa.com"
                    type="email"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t">
              <Button variant="outline" onClick={reset}>Cancelar</Button>
              <Button onClick={handleImport} className="flex-1 gap-2">
                Importar {sheetPreview.totalRows} pendientes con IA
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === 'importing' && (
          <div className="py-16 text-center space-y-4">
            <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto" />
            <p className="font-semibold text-lg">Procesando con IA...</p>
            <p className="text-sm text-muted-foreground">
              Mapeando columnas, detectando inspector, comuna y asignando responsables automáticamente
            </p>
          </div>
        )}

        {/* Step: Result */}
        {step === 'result' && result && (
          <div className="space-y-5">
            <div className={`rounded-xl p-5 text-center ${result.errors === 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-yellow-50 border border-yellow-200'}`}>
              {result.errors === 0 ? (
                <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
              ) : (
                <AlertCircle className="h-10 w-10 text-yellow-500 mx-auto mb-2" />
              )}
              <p className="text-2xl font-bold">{result.imported} importados</p>
              <p className="text-sm text-muted-foreground mt-1">
                {result.skipped > 0 && `${result.skipped} filas vacías omitidas · `}
                {result.errors > 0 && `${result.errors} errores · `}
                {result.total_rows} filas procesadas
              </p>
            </div>

            {/* Mapping summary */}
            {result.column_mapping && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Mapeo de columnas detectado por IA</p>
                <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
                  {Object.entries(result.column_mapping).map(([col, field]) => (
                    <div key={col} className="flex items-center gap-2 text-xs bg-muted/40 rounded px-2 py-1">
                      <span className="font-mono text-muted-foreground truncate flex-1">{col}</span>
                      <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="font-semibold text-primary truncate">{field}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Errors */}
            {result.error_details?.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-red-700 mb-1">Errores ({result.errors}):</p>
                {result.error_details.map((e, i) => (
                  <p key={i} className="text-xs text-red-600">• {e.row}: {e.error}</p>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t">
              <Button variant="outline" className="flex-1" onClick={() => { reset(); onOpenChange(false); }}>
                Cerrar
              </Button>
              <Button className="flex-1" onClick={() => { reset(); }}>
                Importar otro archivo
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}