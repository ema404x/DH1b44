import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Download, Info } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Mapeo exacto de columnas del Excel de Actas
function mapRow(row, comuna) {
  const get = (key) => {
    const found = Object.entries(row).find(([k]) =>
      k.trim().toUpperCase() === key.toUpperCase()
    );
    return found ? found[1] : undefined;
  };

  const toDateStr = (val) => {
    if (!val) return undefined;
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return undefined;
      return d.toISOString().split('T')[0];
    } catch { return undefined; }
  };

  const avance = parseFloat(get('%')) || 0;

  // Determinar estado según observaciones del Excel
  const obs = (get('OBSERVACIONES') || '').toUpperCase();
  let estado_cobro = 'pendiente';
  let prioridad = 'normal';
  if (obs.includes('LISTO PARA CERTIFICAR')) {
    estado_cobro = 'listo_certificar'; prioridad = 'alta';
  } else if (obs.includes('FALTA CARGAR ACTAS') || obs.includes('FALTAN ACTAS') || obs.includes('FALTA CARGAR')) {
    estado_cobro = 'faltan_actas';
  } else if (obs.includes('OBSERVADO') || obs.includes('OBSERVACION')) {
    estado_cobro = 'observado';
  }

  const obj = {
    titulo:           get('TITULO DE OBRA EN SAP') || '',
    direccion:        get('DIRECCION') || '',
    establecimiento:  get('ESTABLECIMIENTO') || '',
    comuna:           comuna,
    jefe_sitio:       get('JEFE DE SITIO') || '',
    inspector:        get('INSPECTOR') || '',
    oc_numero:        get('N° MTOM') ? String(get('N° MTOM')) : '',
    ada_numero:       get('N° MEIN') ? String(get('N° MEIN')) : '',
    monto_contrato:   parseFloat(get('MONTO BASE FEB-23')) || 0,
    porcentaje_avance: avance <= 1 ? avance * 100 : avance, // normalizar a 0-100
    plazo_dias:       parseFloat(get('Plazo')) || 0,
    fecha_inicio:     toDateStr(get('Acta de inicio')),
    fecha_fin_estimada: toDateStr(get('Acta de recepcion')),
    notas:            get('OBSERVACIONES') || '',
    estado_cobro,
    prioridad,
    monto_a_cobrar:   parseFloat(get('MONTO BASE FEB-23')) || 0,
  };

  // Limpiar undefined
  Object.keys(obj).forEach(k => { if (obj[k] === undefined) delete obj[k]; });
  return obj;
}

function descargarPlantilla() {
  const wb = XLSX.utils.book_new();
  const headers = ['DIRECCION','ESTABLECIMIENTO','TITULO DE OBRA EN SAP','MONTO BASE FEB-23','N° MTOM','N° MEIN','%','Plazo','Acta de inicio','Acta de recepcion','JEFE DE SITIO','INSPECTOR','OBSERVACIONES'];
  const example = ['OLIDEN 2851','JIC N° 01/13°','Cambio de piso en sala','876435.98','421441336','421475354','0.5','5','2026-02-26','2026-03-04','DANA, Daniel','CORTEZ, Abel','LISTO PARA CERTIFICAR'];
  ['COMUNA 8A','COMUNA 8B','COMUNA 10A'].forEach(sheet => {
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    XLSX.utils.book_append_sheet(wb, ws, sheet);
  });
  XLSX.writeFile(wb, 'plantilla_actas_certificacion.xlsx');
}

// Detectar comuna desde nombre de hoja
function detectarComuna(sheetName) {
  const n = sheetName.toUpperCase();
  if (n.includes('8A')) return '8A';
  if (n.includes('8B')) return '8B';
  if (n.includes('10A')) return '10A';
  return null;
}

export default function ImportarObrasExcel({ open, onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);   // [{obra, sheetName, rowIndex}]
  const [errors, setErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef();

  const reset = () => {
    setFile(null); setPreview([]); setErrors([]); setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClose = () => { reset(); onClose(); };

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f); setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target.result, { type: 'array', cellDates: true });
      const allRows = [];
      const errs = [];

      wb.SheetNames.forEach(sheetName => {
        const comuna = detectarComuna(sheetName);
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

        rows.forEach((row, i) => {
          const obra = mapRow(row, comuna);
          if (!obra.titulo) {
            errs.push(`${sheetName} fila ${i + 2}: falta "TITULO DE OBRA EN SAP"`);
            return;
          }
          allRows.push({ obra, sheetName, rowIndex: i + 2 });
        });
      });

      setPreview(allRows);
      setErrors(errs);
    };
    reader.readAsArrayBuffer(f);
  };

  const handleImport = async () => {
    if (!preview.length) return;
    setImporting(true);
    let ok = 0, fail = 0;
    for (const { obra } of preview) {
      try {
        await base44.entities.ObraCertificacion.create(obra);
        ok++;
      } catch { fail++; }
    }
    setImporting(false);
    setResult({ ok, fail });
    onImported();
  };

  // Agrupar preview por hoja para mostrar en tabla
  const bySheet = preview.reduce((acc, r) => {
    if (!acc[r.sheetName]) acc[r.sheetName] = [];
    acc[r.sheetName].push(r.obra);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
            Importar Actas de Certificación desde Excel
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Info formato esperado */}
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-blue-500/30 bg-blue-500/5">
            <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-300 space-y-0.5">
              <p className="font-semibold text-blue-200">Formato esperado</p>
              <p>El Excel debe tener una hoja por comuna: <strong>COMUNA 8A</strong>, <strong>COMUNA 8B</strong>, <strong>COMUNA 10A</strong></p>
              <p>Columnas requeridas: <code>TITULO DE OBRA EN SAP</code>, <code>MONTO BASE FEB-23</code>, <code>N° MTOM</code>, <code>N° MEIN</code>, <code>JEFE DE SITIO</code>, <code>INSPECTOR</code>, <code>OBSERVACIONES</code></p>
            </div>
          </div>

          {/* Plantilla + Upload */}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-muted/30">
            <div>
              <p className="text-sm font-medium">¿Necesitás la plantilla?</p>
              <p className="text-xs text-muted-foreground">Excel modelo con el formato correcto de 3 hojas</p>
            </div>
            <Button variant="outline" size="sm" onClick={descargarPlantilla} className="gap-2 shrink-0">
              <Download className="h-4 w-4" /> Plantilla
            </Button>
          </div>

          {!result && (
            <div
              className="border-2 border-dashed border-border hover:border-primary/40 rounded-xl p-8 text-center cursor-pointer transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">{file ? file.name : 'Seleccioná el archivo Excel de Actas'}</p>
              <p className="text-xs text-muted-foreground mt-1">.xlsx — con hojas COMUNA 8A / 8B / 10A</p>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
            </div>
          )}

          {/* Errores */}
          {errors.length > 0 && (
            <div className="px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/5 space-y-1">
              <p className="text-sm font-medium text-red-400 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" /> {errors.length} fila{errors.length > 1 ? 's' : ''} con problemas (se omitirán)
              </p>
              {errors.slice(0, 5).map((e, i) => <p key={i} className="text-xs text-red-300">• {e}</p>)}
              {errors.length > 5 && <p className="text-xs text-red-300">...y {errors.length - 5} más</p>}
            </div>
          )}

          {/* Preview por hoja */}
          {preview.length > 0 && !result && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">
                Vista previa — <span className="text-foreground font-semibold">{preview.length} obras</span> en {Object.keys(bySheet).length} hoja{Object.keys(bySheet).length > 1 ? 's' : ''}
              </p>

              {Object.entries(bySheet).map(([sheet, rows]) => (
                <div key={sheet} className="rounded-xl border border-border overflow-hidden">
                  <div className="px-3 py-2 bg-muted/40 flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">{sheet}</span>
                    <span className="text-xs text-muted-foreground">{rows.length} obras</span>
                  </div>
                  <div className="overflow-x-auto max-h-48">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/20">
                        <tr>
                          {['Establecimiento', 'Título obra SAP', 'Monto Base', 'MTOM', 'MEIN', '%', 'Jefe Sitio', 'Estado'].map(h => (
                            <th key={h} className="px-3 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={i} className="border-t border-border">
                            <td className="px-3 py-1.5 max-w-[120px] truncate">{r.establecimiento || r.direccion || '—'}</td>
                            <td className="px-3 py-1.5 max-w-[180px] truncate">{r.titulo}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap">${Number(r.monto_contrato).toLocaleString('es-AR', {maximumFractionDigits: 0})}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap">{r.oc_numero}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap">{r.ada_numero}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap">{r.porcentaje_avance}%</td>
                            <td className="px-3 py-1.5 whitespace-nowrap">{r.jefe_sitio}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                r.estado_cobro === 'en_gestion' ? 'bg-blue-500/20 text-blue-300' :
                                r.estado_cobro === 'cobrado' ? 'bg-emerald-500/20 text-emerald-300' :
                                'bg-amber-500/20 text-amber-300'
                              }`}>{r.estado_cobro}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Resultado */}
          {result && (
            <div className={`flex items-center gap-3 px-4 py-4 rounded-xl border ${result.fail === 0 ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
              <CheckCircle2 className={`h-5 w-5 shrink-0 ${result.fail === 0 ? 'text-emerald-400' : 'text-amber-400'}`} />
              <div>
                <p className="text-sm font-semibold">{result.ok} obras importadas correctamente</p>
                {result.fail > 0 && <p className="text-xs text-muted-foreground">{result.fail} filas fallaron</p>}
              </div>
            </div>
          )}

          {/* Acciones */}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={handleClose}>
              {result ? 'Cerrar' : 'Cancelar'}
            </Button>
            {!result && preview.length > 0 && (
              <Button onClick={handleImport} disabled={importing} className="gap-2">
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