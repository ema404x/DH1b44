import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Download, Info } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// --- Helpers de extracción robusta (precisión) ---
// Normaliza un encabezado: mayúsculas, sin acentos, símbolos → espacio, colapsa espacios.
const normKey = (s) => String(s == null ? '' : s)
  .toUpperCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^A-Z0-9 ]/g, ' ')
  .replace(/\s+/g, ' ').trim();

// Busca el valor de una columna con tolerancia: 1) exacto (case/trim),
// 2) normalizado igual, 3) normalizado contiene el token.
// Acepta varios alias por campo para soportar variantes del Excel real.
function pick(row, tokens) {
  const arr = Array.isArray(tokens) ? tokens : [tokens];
  const entries = Object.entries(row);
  // 1) exacto case-insensitive (respeta encabezados literales como "%")
  for (const [k, v] of entries) {
    if (arr.some(t => k.trim().toUpperCase() === String(t).toUpperCase())) return v;
  }
  // 2) normalizado igual
  for (const [k, v] of entries) {
    const nk = normKey(k);
    if (arr.some(t => nk && nk === normKey(t))) return v;
  }
  // 3) normalizado contiene (más laxo, último recurso)
  for (const [k, v] of entries) {
    const nk = normKey(k);
    if (!nk) continue;
    if (arr.some(t => { const nt = normKey(t); return nt && nk.includes(nt); })) return v;
  }
  return undefined;
}

// Parseo de números en formato es-AR ("876.435,98") o numéricos directos.
function parseNum(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  let s = String(v).trim().replace(/[^0-9.,-]/g, '');
  if (!s) return 0;
  const dots = (s.match(/\./g) || []).length;
  const commas = (s.match(/,/g) || []).length;
  let norm;
  if (commas > 0) {
    // coma decimal, puntos de miles → "876.435,98" => "876435.98"
    norm = s.replace(/\./g, '').replace(',', '.');
  } else if (dots > 1) {
    // varios puntos = separadores de miles sin coma → "1.234.567" => "1234567"
    norm = s.replace(/\./g, '');
  } else if (dots === 1) {
    const [ent, dec] = s.split('.');
    // "1.234" (3 dec) → miles en AR; "1.23" (2 dec) → decimal
    if (dec && dec.length === 3 && /^\d+$/.test(ent)) norm = s.replace('.', '');
    else norm = s;
  } else {
    norm = s;
  }
  const n = parseFloat(norm);
  return isNaN(n) ? 0 : n;
}

// Parseo de fechas: Date de Excel (cellDates), serial de Excel, dd/mm/yyyy, yyyy-mm-dd.
function parseDate(v) {
  if (v == null || v === '') return undefined;
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().split('T')[0];
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/); // dd/mm/yyyy
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = '20' + y;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/); // yyyy-mm-dd
  if (m) {
    let [, y, mo, d] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  } catch { /* ignora */ }
  return undefined;
}

function toString(v) {
  if (v == null) return '';
  // Nros grandes en notación científica o float → enteros legibles
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
  return String(v).trim();
}

// Mapeo robusto de columnas del Excel de Actas (tolera variantes de encabezados)
function mapRow(row, comuna) {
  const get = (tokens) => pick(row, tokens);

  const avanceRaw = parseNum(get(['%', '% AVANCE', 'AVANCE', 'AVANCE %', 'PORCENTAJE', 'PORCENTAJE DE AVANCE', 'PORCENT']));
  const avance = avanceRaw <= 1 && avanceRaw > 0 ? avanceRaw * 100 : avanceRaw; // normalizar a 0-100

  // Tramo y color según % de avance
  let tramo_certificacion = undefined;
  let color_avance = 'auto';
  if (avance >= 100) {
    tramo_certificacion = undefined;
    color_avance = 'verde';
  } else if (avance > 50) {
    tramo_certificacion = 'segundo_50';
    color_avance = 'naranja';
  } else if (avance > 0) {
    tramo_certificacion = 'primer_50';
    color_avance = 'amarillo';
  }

  // Determinar estado según observaciones (normalizado, sin acentos)
  const obs = normKey(get(['OBSERVACIONES', 'OBSERVACION', 'OBS', 'NOTAS', 'ESTADO']));
  let estado_cobro = 'pendiente';
  let prioridad = 'normal';
  if (obs.includes('LISTO') && obs.includes('CERTIFIC')) {
    estado_cobro = 'listo_certificar'; prioridad = 'alta';
  } else if (obs.includes('FALTA') && obs.includes('MEIN')) {
    estado_cobro = 'falta_aprobar_mein';
  } else if (obs.includes('FALTA') && obs.includes('ACTA')) {
    estado_cobro = 'faltan_actas';
  } else if (obs.includes('OBSERV')) {
    estado_cobro = 'observado';
  }

  const montoBase = parseNum(get(['MONTO BASE', 'MONTO BASE FEB-23', 'MONTO BASE FEB 23', 'MONTO CONTRATO', 'MONTO CONTRATADO', 'MONTO', 'IMPORTE']));

  const obj = {
    titulo:           toString(get(['TITULO DE OBRA EN SAP', 'TITULO DE OBRA', 'TITULO OBRA', 'TITULO', 'OBRA EN SAP', 'OBRA'])) || '',
    direccion:        toString(get(['DIRECCION', 'DIRECCION DE OBRA', 'DOMICILIO'])) || '',
    establecimiento:  toString(get(['ESTABLECIMIENTO', 'ESCUELA', 'ESTABLECIMIENTO DE OBRA'])) || '',
    comuna:           comuna,
    jefe_sitio:       toString(get(['JEFE DE SITIO', 'JEFE SITIO', 'JEFE DE OBRA', 'JEFE'])) || '',
    inspector:        toString(get(['INSPECTOR', 'INSPECCION', 'SUPERVISOR'])) || '',
    oc_numero:        toString(get(['N° MTOM', 'Nº MTOM', 'MTOM', 'NRO MTOM', 'NUMERO MTOM', 'N MTOM', 'ORDEN MTOM', 'MTOM N'])),
    ada_numero:       toString(get(['N° MEIN', 'Nº MEIN', 'MEIN', 'NRO MEIN', 'NUMERO MEIN', 'N MEIN', 'ORDEN MEIN', 'MEIN N', 'ADA'])),
    monto_contrato:   montoBase,
    porcentaje_avance: avance,
    plazo_dias:       parseNum(get(['PLAZO', 'PLAZO DIAS', 'PLAZO DE OBRA', 'DIAS'])),
    fecha_inicio:     parseDate(get(['ACTA DE INICIO', 'INICIO', 'FECHA INICIO', 'ACTA INICIO', 'INICIO DE OBRA'])),
    fecha_fin_estimada: parseDate(get(['ACTA DE RECEPCION', 'ACTA DE RECEPCION PROVISIONAL', 'RECEPCION', 'RECEPCION PROVISIONAL', 'FECHA RECEPCION', 'FIN', 'FECHA FIN', 'ACTA RECEPCION'])),
    notas:            toString(get(['OBSERVACIONES', 'OBSERVACION', 'OBS', 'NOTAS'])) || '',
    estado_cobro,
    prioridad,
    monto_a_cobrar:   montoBase,
    color_avance,
    tramo_certificacion,
  };

  // Limpiar undefined y null — un enum (ej: comuna) en null rompe la validación al crear.
  Object.keys(obj).forEach(k => { if (obj[k] === undefined || obj[k] === null) delete obj[k]; });
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

// Detecta filas de TOTAL / SUBTOTAL del Excel que no son obras reales.
// El Excel trae filas como "TOTAL", "TOTAL PARA CERTIFICAR", "TOTAL GENERAL"
// con un título pero sin MTOM/dirección/jefe → no deben importarse como obras.
function esFilaResumen(obra) {
  const t = (obra.titulo || '').toUpperCase().trim();
  if (!t) return false;
  if (/^(TOTAL|SUBTOTAL|TOTALES|SUB TOTAL|SALDO|GRAN TOTAL|TOTAL GENERAL|TOTAL PARA CERTIFICAR|SUMA)\b/.test(t)) return true;
  // Sin MTOM, sin dirección, sin jefe y sin establecimiento → no es una obra real
  if (!obra.oc_numero && !obra.direccion && !obra.jefe_sitio && !obra.establecimiento) return true;
  return false;
}

export default function ImportarObrasExcel({ open, onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);   // [{obra, sheetName, rowIndex}]
  const [errors, setErrors] = useState([]);
  const [ignored, setIgnored] = useState([]);    // filas de TOTAL/subtotal descartadas
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef();

  const reset = () => {
    setFile(null); setPreview([]); setErrors([]); setIgnored([]); setResult(null);
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
      const ignoredRows = [];

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
          // Descartar filas de TOTAL / SUBTOTAL (no son obras reales)
          if (esFilaResumen(obra)) {
            ignoredRows.push({ sheet: sheetName, row: i + 2, titulo: obra.titulo });
            return;
          }
          allRows.push({ obra, sheetName, rowIndex: i + 2 });
        });
      });

      setPreview(allRows);
      setErrors(errs);
      setIgnored(ignoredRows);
    };
    reader.readAsArrayBuffer(f);
  };

  const handleImport = async () => {
    if (!preview.length) return;
    setImporting(true);
    // Mapa de obras existentes por N° MTOM (para upsert, bypassa RLS).
    // Re-importar el Excel mensual => si la obra ya está, se actualiza; si no, se crea.
    const existingMap = new Map();
    try {
      const res = await base44.functions.invoke('gestionarObrasCertificacion', { action: 'list' });
      (res.data.obras || []).forEach(o => {
        if (o.oc_numero) existingMap.set(String(o.oc_numero).trim(), o);
      });
    } catch { /* si falla, todo será create */ }

    let created = 0, updated = 0, failed = 0;
    const detalles = [];
    for (const { obra, sheetName, rowIndex } of preview) {
      // Limpieza final: nunca enviar null/undefined (rompe enums en la creación)
      const clean = {};
      for (const [k, v] of Object.entries(obra)) {
        if (v === undefined || v === null) continue;
        clean[k] = v;
      }
      // Asegurar tipos numéricos (evita rechazos por string donde se espera number)
      ['monto_contrato', 'monto_a_cobrar', 'porcentaje_avance', 'plazo_dias'].forEach(f => {
        if (clean[f] !== undefined) clean[f] = Number(clean[f]) || 0;
      });
      // Asegurar strings en campos de texto
      ['oc_numero', 'ada_numero', 'titulo', 'jefe_sitio', 'inspector'].forEach(f => {
        if (clean[f] !== undefined) clean[f] = String(clean[f]).trim();
      });

      const key = clean.oc_numero ? String(clean.oc_numero) : '';
      const existing = key ? existingMap.get(key) : null;
      try {
        if (existing) {
          await base44.functions.invoke('gestionarObrasCertificacion', {
            action: 'update', id: existing.id, data: clean,
          });
          updated++;
          detalles.push({ sheet: sheetName, row: rowIndex, titulo: clean.titulo, estado: 'ok', motivo: 'actualizada' });
        } else {
          const res = await base44.functions.invoke('gestionarObrasCertificacion', { action: 'create', data: clean });
          if (key && res?.data?.obra?.id) existingMap.set(key, { id: res.data.obra.id });
          created++;
          detalles.push({ sheet: sheetName, row: rowIndex, titulo: clean.titulo, estado: 'ok', motivo: 'creada' });
        }
      } catch (err) {
        failed++;
        const motivo = err?.response?.data?.error || err?.message || 'Error al guardar';
        detalles.push({ sheet: sheetName, row: rowIndex, titulo: clean.titulo, estado: 'failed', motivo });
      }
    }
    setImporting(false);
    setResult({ ok: created + updated, created, updated, failed, detalles });
    if (created + updated > 0) onImported();
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

          {/* Filas de totales ignoradas */}
          {ignored.length > 0 && (
            <div className="flex items-start gap-2 px-4 py-2.5 rounded-xl border border-sky-500/30 bg-sky-500/5">
              <Info className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
              <div className="text-xs text-sky-300">
                <span className="font-medium text-sky-200">{ignored.length} fila(s) de totales ignorada(s)</span> (no son obras reales):
                <span className="text-sky-400/70"> {ignored.slice(0, 4).map(i => `"${i.titulo}"`).join(', ')}{ignored.length > 4 ? '…' : ''}</span>
              </div>
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
                                r.estado_cobro === 'listo_certificar' ? 'bg-emerald-500/20 text-emerald-300' :
                                r.estado_cobro === 'faltan_actas'     ? 'bg-yellow-500/20 text-yellow-300' :
                                r.estado_cobro === 'observado'        ? 'bg-slate-500/20 text-slate-300' :
                                'bg-red-500/20 text-red-300'
                              }`}>
                                {r.estado_cobro === 'listo_certificar' ? 'Listo' :
                                 r.estado_cobro === 'faltan_actas'     ? 'Faltan Actas' :
                                 r.estado_cobro === 'observado'        ? 'Observado' : 'Pendiente'}
                              </span>
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
            <div className="space-y-3">
              <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${result.failed === 0 ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
                {result.failed === 0
                  ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                  : <AlertCircle className="h-5 w-5 shrink-0 text-amber-400" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">
                    {result.ok} de {preview.length} obras procesadas
                    {result.created > 0 && <span className="text-emerald-400"> · {result.created} nuevas</span>}
                    {result.updated > 0 && <span className="text-sky-400"> · {result.updated} actualizadas</span>}
                    {result.failed > 0 && <span className="text-red-400"> · {result.failed} fallida(s)</span>}
                  </p>
                </div>
              </div>

              {/* Detalle de filas fallidas */}
              {result.detalles?.some(d => d.estado === 'failed') && (
                <div className="max-h-56 overflow-y-auto rounded-xl border border-border divide-y divide-border">
                  {result.detalles.filter(d => d.estado === 'failed').map((d, i) => (
                    <div key={i} className="flex items-start gap-2 px-3 py-2 text-xs">
                      <span className="shrink-0 mt-0.5 font-bold text-red-400">✕</span>
                      <div className="min-w-0">
                        <p className="text-foreground truncate">
                          <span className="text-muted-foreground">{d.sheet} · fila {d.row}:</span>{' '}
                          {d.titulo || '(sin título)'}
                        </p>
                        {d.motivo && <p className="text-[11px] text-red-400/80">{d.motivo}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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