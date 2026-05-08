import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Download, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Mapeo de columnas del Excel → campos de la entidad
// Acepta variantes de nombres de columnas (mayúsculas, con/sin tildes, etc.)
const COLUMN_MAP = {
  titulo:              ['titulo', 'título', 'obra', 'nombre', 'nombre obra', 'descripcion obra'],
  codigo:              ['codigo', 'código', 'cod', 'id obra'],
  contratista:         ['contratista', 'empresa', 'subcontratista', 'proveedor'],
  establecimiento:     ['establecimiento', 'escuela', 'colegio', 'lugar', 'ubicacion', 'ubicación'],
  jefe_sitio:          ['jefe sitio', 'jefe de sitio', 'responsable', 'jefe'],
  oc_numero:           ['oc', 'oc numero', 'oc número', 'orden compra', 'orden de compra', 'nro oc', 'n° oc'],
  ada_numero:          ['ada', 'ada numero', 'ada número', 'nro ada', 'n° ada'],
  monto_contrato:      ['monto contrato', 'monto total', 'precio', 'importe contrato', 'valor contrato'],
  monto_a_cobrar:      ['monto cobrar', 'monto a cobrar', 'importe cobrar', 'a cobrar', 'pendiente cobro'],
  porcentaje_avance:   ['avance', 'avance %', '% avance', 'porcentaje avance', 'pct avance'],
  periodo:             ['periodo', 'período', 'mes', 'periodo certificacion'],
  fecha_inicio:        ['fecha inicio', 'inicio', 'fecha desde'],
  fecha_fin_estimada:  ['fecha fin', 'fin estimado', 'fecha finalizacion', 'fecha fin estimada'],
  estado_cobro:        ['estado', 'estado cobro', 'estado de cobro'],
  prioridad:           ['prioridad'],
  descripcion:         ['descripcion', 'descripción', 'detalle', 'trabajo'],
  notas:               ['notas', 'observaciones', 'comentarios'],
};

const ESTADO_VALID = ['pendiente', 'en_gestion', 'cobrado', 'rechazado'];
const PRIORIDAD_VALID = ['normal', 'alta', 'urgente'];

function normalizeKey(str) {
  return str?.toString().toLowerCase().trim()
    .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n');
}

function mapRow(row) {
  const normalizedRow = {};
  Object.entries(row).forEach(([k, v]) => {
    normalizedRow[normalizeKey(k)] = v;
  });

  const obj = {};
  Object.entries(COLUMN_MAP).forEach(([field, aliases]) => {
    for (const alias of aliases) {
      const normAlias = normalizeKey(alias);
      if (normalizedRow[normAlias] !== undefined && normalizedRow[normAlias] !== '') {
        obj[field] = normalizedRow[normAlias];
        break;
      }
    }
  });

  // Normalizar estado
  if (obj.estado_cobro) {
    const e = normalizeKey(String(obj.estado_cobro)).replace(/\s/g, '_');
    obj.estado_cobro = ESTADO_VALID.includes(e) ? e : 'pendiente';
  } else {
    obj.estado_cobro = 'pendiente';
  }

  // Normalizar prioridad
  if (obj.prioridad) {
    const p = normalizeKey(String(obj.prioridad));
    obj.prioridad = PRIORIDAD_VALID.includes(p) ? p : 'normal';
  } else {
    obj.prioridad = 'normal';
  }

  // Números
  ['monto_contrato', 'monto_a_cobrar', 'porcentaje_avance'].forEach(f => {
    if (obj[f] !== undefined) {
      const n = parseFloat(String(obj[f]).replace(/[^\d.,-]/g, '').replace(',', '.'));
      obj[f] = isNaN(n) ? 0 : n;
    }
  });

  return obj;
}

function descargarPlantilla() {
  const headers = [
    'titulo', 'codigo', 'contratista', 'establecimiento', 'jefe_sitio',
    'oc_numero', 'ada_numero', 'monto_contrato', 'monto_a_cobrar',
    'porcentaje_avance', 'periodo', 'fecha_inicio', 'fecha_fin_estimada',
    'estado_cobro', 'prioridad', 'descripcion', 'notas'
  ];
  const example = [
    'Refacción Baños Escuela 12', 'OBR-001', 'Constructora SA', 'Escuela N°12', 'Juan Pérez',
    'OC-2025-001', 'ADA-123', 5000000, 2500000, 65, 'Mayo 2025',
    '2025-03-01', '2025-06-30', 'pendiente', 'alta', 'Refacción completa de baños', ''
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Obras');
  XLSX.writeFile(wb, 'plantilla_certificacion_obras.xlsx');
}

export default function ImportarObrasExcel({ open, onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [errors, setErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef();

  const reset = () => {
    setFile(null);
    setPreview([]);
    setErrors([]);
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClose = () => { reset(); onClose(); };

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

      const mapped = rows.map((r, i) => ({ ...mapRow(r), _rowIndex: i + 2 }));
      const errs = [];
      mapped.forEach((r, i) => {
        if (!r.titulo) errs.push(`Fila ${r._rowIndex}: falta "titulo"`);
        if (!r.contratista) errs.push(`Fila ${r._rowIndex}: falta "contratista"`);
      });

      setPreview(mapped);
      setErrors(errs);
    };
    reader.readAsArrayBuffer(f);
  };

  const handleImport = async () => {
    if (!preview.length) return;
    setImporting(true);
    let ok = 0, fail = 0;
    for (const row of preview) {
      const { _rowIndex, ...data } = row;
      if (!data.titulo || !data.contratista) { fail++; continue; }
      await base44.entities.ObraCertificacion.create(data);
      ok++;
    }
    setImporting(false);
    setResult({ ok, fail });
    onImported();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
            Importar Obras desde Excel
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Descargar plantilla */}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-muted/30">
            <div>
              <p className="text-sm font-medium">¿Necesitás la plantilla?</p>
              <p className="text-xs text-muted-foreground">Descargá el Excel modelo con las columnas correctas</p>
            </div>
            <Button variant="outline" size="sm" onClick={descargarPlantilla} className="gap-2 shrink-0">
              <Download className="h-4 w-4" /> Plantilla
            </Button>
          </div>

          {/* Upload */}
          {!result && (
            <div
              className="border-2 border-dashed border-border hover:border-primary/40 rounded-xl p-8 text-center cursor-pointer transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">{file ? file.name : 'Seleccioná un archivo Excel'}</p>
              <p className="text-xs text-muted-foreground mt-1">.xlsx o .xls</p>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
            </div>
          )}

          {/* Errores de validación */}
          {errors.length > 0 && (
            <div className="space-y-1 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/5">
              <p className="text-sm font-medium text-red-400 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" /> {errors.length} error{errors.length > 1 ? 'es' : ''} encontrados
              </p>
              <ul className="text-xs text-red-300 space-y-0.5 mt-1">
                {errors.slice(0, 5).map((e, i) => <li key={i}>• {e}</li>)}
                {errors.length > 5 && <li>• ...y {errors.length - 5} más</li>}
              </ul>
            </div>
          )}

          {/* Preview */}
          {preview.length > 0 && !result && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Vista previa — <span className="text-foreground">{preview.length} registros</span>
              </p>
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto max-h-56">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        {['Título', 'Contratista', 'Establecimiento', 'Monto a Cobrar', 'Estado', 'Prioridad'].map(h => (
                          <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.slice(0, 10).map((r, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-3 py-2 max-w-[160px] truncate">{r.titulo || <span className="text-red-400">—</span>}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{r.contratista || <span className="text-red-400">—</span>}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{r.establecimiento || '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{r.monto_a_cobrar ? `$${Number(r.monto_a_cobrar).toLocaleString('es-AR')}` : '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{r.estado_cobro}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{r.prioridad}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {preview.length > 10 && (
                  <p className="text-xs text-muted-foreground text-center py-2 border-t border-border">
                    ...y {preview.length - 10} registros más
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Resultado */}
          {result && (
            <div className={`flex items-center gap-3 px-4 py-4 rounded-xl border ${result.fail === 0 ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
              <CheckCircle2 className={`h-5 w-5 shrink-0 ${result.fail === 0 ? 'text-emerald-400' : 'text-amber-400'}`} />
              <div>
                <p className="text-sm font-semibold">{result.ok} obras importadas correctamente</p>
                {result.fail > 0 && <p className="text-xs text-muted-foreground">{result.fail} filas omitidas por datos incompletos</p>}
              </div>
            </div>
          )}

          {/* Acciones */}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={handleClose}>
              {result ? 'Cerrar' : 'Cancelar'}
            </Button>
            {!result && preview.length > 0 && (
              <Button onClick={handleImport} disabled={importing || errors.length > 0} className="gap-2">
                {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                Importar {preview.length} obras
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}