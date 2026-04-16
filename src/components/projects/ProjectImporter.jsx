import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, X, Download } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

const EXPECTED_FIELDS = {
  name: ['nombre', 'proyecto', 'name', 'obra'],
  code: ['codigo', 'code', 'cod', 'id'],
  client_name: ['cliente', 'client', 'comitente'],
  type: ['tipo', 'type'],
  status: ['estado', 'status'],
  priority: ['prioridad', 'priority'],
  address: ['direccion', 'dirección', 'address', 'domicilio', 'sitio'],
  start_date: ['inicio', 'start', 'fecha_inicio', 'start_date', 'fecha inicio'],
  end_date: ['fin', 'end', 'fecha_fin', 'end_date', 'fecha fin', 'fecha_finalizacion'],
  estimated_budget: ['presupuesto', 'budget', 'monto', 'estimated_budget'],
  progress: ['avance', 'progress', 'porcentaje', '%'],
  description: ['descripcion', 'descripción', 'description', 'detalle'],
  notes: ['notas', 'notes', 'observaciones'],
};

const TYPE_MAP = {
  'obra nueva': 'obra_nueva', 'nueva': 'obra_nueva',
  'remodelacion': 'remodelacion', 'remodelación': 'remodelacion', 'refaccion': 'remodelacion',
  'mantenimiento preventivo': 'mantenimiento_preventivo', 'preventivo': 'mantenimiento_preventivo',
  'mantenimiento correctivo': 'mantenimiento_correctivo', 'correctivo': 'mantenimiento_correctivo',
  'emergencia': 'emergencia', 'inspeccion': 'inspeccion', 'inspección': 'inspeccion',
};

const STATUS_MAP = {
  'pendiente': 'pendiente', 'pending': 'pendiente',
  'en progreso': 'en_progreso', 'en_progreso': 'en_progreso', 'progreso': 'en_progreso', 'activo': 'en_progreso',
  'pausado': 'pausado', 'pausa': 'pausado',
  'completado': 'completado', 'completo': 'completado', 'finalizado': 'completado',
  'cancelado': 'cancelado', 'cancelado': 'cancelado',
};

const PRIORITY_MAP = {
  'baja': 'baja', 'low': 'baja',
  'media': 'media', 'medium': 'media', 'normal': 'media',
  'alta': 'alta', 'high': 'alta',
  'urgente': 'urgente', 'urgent': 'urgente', 'critica': 'urgente',
};

function normalizeHeader(h) {
  return String(h || '').toLowerCase().trim().replace(/\s+/g, '_').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function detectMapping(headers) {
  const mapping = {};
  headers.forEach((header) => {
    const norm = normalizeHeader(header);
    for (const [field, aliases] of Object.entries(EXPECTED_FIELDS)) {
      if (aliases.some(a => norm.includes(normalizeHeader(a)))) {
        if (!mapping[field]) mapping[field] = header;
      }
    }
  });
  return mapping;
}

function parseRow(row, mapping) {
  const project = { status: 'pendiente', priority: 'media', type: 'obra_nueva', progress: 0 };
  for (const [field, header] of Object.entries(mapping)) {
    let val = row[header];
    if (val === undefined || val === null || val === '') continue;
    val = String(val).trim();
    if (field === 'type') project[field] = TYPE_MAP[val.toLowerCase()] || 'obra_nueva';
    else if (field === 'status') project[field] = STATUS_MAP[val.toLowerCase()] || 'pendiente';
    else if (field === 'priority') project[field] = PRIORITY_MAP[val.toLowerCase()] || 'media';
    else if (field === 'estimated_budget' || field === 'progress') project[field] = parseFloat(val.replace(',', '.')) || 0;
    else project[field] = val;
  }
  return project;
}

export default function ProjectImporter({ onClose, onImported }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [parsedData, setParsedData] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (!rows.length) { toast.error('El archivo está vacío'); return; }
      const headers = Object.keys(rows[0]);
      const mapping = detectMapping(headers);
      const preview = rows.slice(0, 5).map(r => parseRow(r, mapping));
      setParsedData({ rows, headers, mapping, preview, fileName: file.name });
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (!parsedData) return;
    setImporting(true);
    let success = 0, errors = [];
    for (const row of parsedData.rows) {
      const project = parseRow(row, parsedData.mapping);
      if (!project.name) { errors.push('Fila sin nombre omitida'); continue; }
      try {
        await base44.entities.Project.create(project);
        success++;
      } catch (err) {
        errors.push(`"${project.name}": ${err.message}`);
      }
    }
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    setResult({ success, errors, total: parsedData.rows.length });
    setImporting(false);
    if (success > 0) onImported?.();
  };

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['nombre', 'codigo', 'cliente', 'tipo', 'estado', 'prioridad', 'direccion', 'inicio', 'fin', 'presupuesto', 'avance', 'descripcion'],
      ['Obra Ejemplo', 'PRO-001', 'Cliente S.A.', 'obra_nueva', 'en_progreso', 'alta', 'Av. Corrientes 1234', '2024-01-01', '2024-12-31', '500000', '30', 'Descripción de la obra'],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Proyectos');
    XLSX.writeFile(wb, 'plantilla_proyectos.xlsx');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" /> Importar Proyectos
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Importá proyectos desde un archivo Excel o CSV</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {!result ? (
            <>
              {/* Upload zone */}
              {!parsedData ? (
                <div
                  className="border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="font-medium">Seleccioná tu archivo Excel o CSV</p>
                  <p className="text-sm text-muted-foreground mt-1">Formatos soportados: .xlsx, .xls, .csv</p>
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">{parsedData.fileName}</span>
                      <Badge variant="secondary">{parsedData.rows.length} filas</Badge>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { setParsedData(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>
                      Cambiar
                    </Button>
                  </div>

                  {/* Mapping preview */}
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">CAMPOS DETECTADOS</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(parsedData.mapping).map(([field, header]) => (
                        <span key={field} className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                          {header} → {field}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Preview table */}
                  <div className="rounded-lg border overflow-hidden">
                    <p className="text-xs font-semibold text-muted-foreground px-3 pt-2 pb-1">VISTA PREVIA (primeras 3 filas)</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-3 py-1.5 text-left">Nombre</th>
                            <th className="px-3 py-1.5 text-left">Código</th>
                            <th className="px-3 py-1.5 text-left">Cliente</th>
                            <th className="px-3 py-1.5 text-left">Estado</th>
                            <th className="px-3 py-1.5 text-left">Avance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsedData.preview.slice(0, 3).map((p, i) => (
                            <tr key={i} className="border-t">
                              <td className="px-3 py-1.5 font-medium">{p.name || '—'}</td>
                              <td className="px-3 py-1.5 text-muted-foreground">{p.code || '—'}</td>
                              <td className="px-3 py-1.5">{p.client_name || '—'}</td>
                              <td className="px-3 py-1.5">{p.status}</td>
                              <td className="px-3 py-1.5">{p.progress}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={downloadTemplate}>
                  <Download className="h-3.5 w-3.5" /> Descargar plantilla
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
                  <Button size="sm" disabled={!parsedData || importing} onClick={handleImport} className="gap-1.5">
                    {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    {importing ? 'Importando...' : `Importar ${parsedData?.rows.length || 0} proyectos`}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            /* Result */
            <div className="text-center py-6 space-y-4">
              <div className={`h-16 w-16 rounded-full mx-auto flex items-center justify-center ${result.errors.length === 0 ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                {result.errors.length === 0
                  ? <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                  : <AlertCircle className="h-8 w-8 text-amber-600" />
                }
              </div>
              <div>
                <p className="text-xl font-bold">{result.success} proyectos importados</p>
                <p className="text-sm text-muted-foreground">de {result.total} filas procesadas</p>
              </div>
              {result.errors.length > 0 && (
                <div className="text-left rounded-lg border bg-muted/30 p-3 max-h-32 overflow-y-auto">
                  <p className="text-xs font-semibold text-destructive mb-1">{result.errors.length} errores:</p>
                  {result.errors.map((e, i) => <p key={i} className="text-xs text-muted-foreground">{e}</p>)}
                </div>
              )}
              <Button onClick={onClose}>Cerrar</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}