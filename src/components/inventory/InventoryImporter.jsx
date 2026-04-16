import React, { useState, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  X, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2,
  Download, Brain, Sparkles, Package, ArrowRight, RefreshCw,
  AlertTriangle, TrendingUp, DollarSign, BarChart2
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

// ─── Field aliases ─────────────────────────────────────────────────────────────
const FIELD_ALIASES = {
  name:       ['nombre', 'name', 'material', 'descripcion', 'descripción', 'articulo', 'artículo', 'item', 'detalle', 'producto'],
  code:       ['codigo', 'code', 'cod', 'id', 'referencia', 'ref', 'sku', 'numero'],
  category:   ['categoria', 'categoría', 'category', 'rubro', 'tipo', 'type', 'familia'],
  unit:       ['unidad', 'unit', 'um', 'u.m.', 'medida', 'und'],
  stock:      ['stock', 'cantidad', 'qty', 'quantity', 'existencia', 'saldo', 'disponible', 'cant'],
  min_stock:  ['minimo', 'mínimo', 'min', 'min_stock', 'stock_min', 'stock minimo', 'minstock'],
  unit_cost:  ['precio', 'price', 'cost', 'costo', 'valor', 'unit_cost', 'costo_unitario', 'precio_unitario', 'p.u.'],
  supplier:   ['proveedor', 'supplier', 'vendor', 'fabricante', 'marca'],
  location:   ['ubicacion', 'ubicación', 'location', 'deposito', 'depósito', 'estante', 'pasillo', 'lugar'],
  notes:      ['notas', 'notes', 'observaciones', 'comentarios', 'obs'],
};

// ─── Category normalizer ───────────────────────────────────────────────────────
const CATEGORY_MAP = {
  electrico: ['electrico', 'eléctrico', 'electric', 'electricidad', 'cable', 'cables', 'elect'],
  plomeria:  ['plomeria', 'plomería', 'plumbing', 'sanitario', 'caño', 'caños', 'agua'],
  pintura:   ['pintura', 'paint', 'pintura y revestimiento', 'revestimiento'],
  construccion: ['construccion', 'construcción', 'civil', 'obra', 'albañilería', 'albanileria', 'cemento'],
  herreria:  ['herreria', 'herrería', 'metalico', 'metálico', 'metal', 'hierro', 'acero'],
  herramientas: ['herramienta', 'herramientas', 'tool', 'tools', 'equipo', 'equipos'],
  seguridad: ['seguridad', 'epp', 'proteccion', 'protección', 'safety'],
  climatizacion: ['climatizacion', 'climatización', 'hvac', 'aire', 'ventilacion', 'calefaccion'],
  otros:     ['otros', 'other', 'general', 'varios', 'miscelaneo', 'miscelánea'],
};

const UNIT_MAP = {
  unidad:  ['unidad', 'unidades', 'u', 'un', 'und', 'pza', 'pieza', 'piezas', 'pc', 'pcs', 'unit', 'units'],
  metro:   ['metro', 'metros', 'm', 'ml', 'metro lineal', 'metros lineales'],
  metro2:  ['m2', 'm²', 'metro2', 'metros2', 'metro cuadrado', 'metros cuadrados'],
  metro3:  ['m3', 'm³', 'metro3', 'metros3', 'metro cubico', 'metros cúbicos'],
  kg:      ['kg', 'kilo', 'kilos', 'kilogramo', 'kilogramos'],
  litro:   ['litro', 'litros', 'l', 'lt', 'lts'],
  bolsa:   ['bolsa', 'bolsas', 'saco', 'sacos', 'bag'],
  caja:    ['caja', 'cajas', 'box', 'cajon'],
  rollo:   ['rollo', 'rollos', 'roll'],
};

function normalizeText(t) {
  return String(t || '').toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function detectCategory(val) {
  const n = normalizeText(val);
  for (const [cat, aliases] of Object.entries(CATEGORY_MAP)) {
    if (aliases.some(a => n.includes(normalizeText(a)))) return cat;
  }
  return 'otros';
}

function detectUnit(val) {
  const n = normalizeText(val);
  for (const [unit, aliases] of Object.entries(UNIT_MAP)) {
    if (aliases.some(a => n === normalizeText(a) || n.startsWith(normalizeText(a)))) return unit;
  }
  return 'unidad';
}

function detectFieldMapping(headers) {
  const mapping = {};
  headers.forEach(h => {
    const norm = normalizeText(h);
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (!mapping[field] && aliases.some(a => norm.includes(normalizeText(a)))) {
        mapping[field] = h;
      }
    }
  });
  return mapping;
}

function parseNum(val) {
  if (!val && val !== 0) return 0;
  const s = String(val).replace(/[$\s.]/g, '').replace(',', '.');
  return parseFloat(s) || 0;
}

function parseRow(row, mapping) {
  const item = { category: 'otros', unit: 'unidad', stock: 0, min_stock: 0, unit_cost: 0 };
  for (const [field, header] of Object.entries(mapping)) {
    const val = row[header];
    if (val === undefined || val === null || val === '') continue;
    if (field === 'category') item[field] = detectCategory(val);
    else if (field === 'unit') item[field] = detectUnit(val);
    else if (['stock', 'min_stock', 'unit_cost'].includes(field)) item[field] = parseNum(val);
    else item[field] = String(val).trim();
  }
  return item;
}

// ─── Steps ─────────────────────────────────────────────────────────────────────
const STEPS = ['Subir', 'Mapeo IA', 'Previsualizar', 'Resultado'];

const categoryLabels = {
  electrico: 'Eléctrico', plomeria: 'Plomería', pintura: 'Pintura', construccion: 'Construcción',
  herreria: 'Herrería', herramientas: 'Herramientas', seguridad: 'Seguridad', climatizacion: 'Climatización', otros: 'Otros',
};
const unitLabels = {
  unidad: 'UN', metro: 'ML', metro2: 'm²', metro3: 'm³', kg: 'Kg', litro: 'Lt', bolsa: 'Bolsa', caja: 'Caja', rollo: 'Rollo',
};

const CAT_COLORS = {
  electrico: 'bg-yellow-100 text-yellow-700', plomeria: 'bg-blue-100 text-blue-700',
  pintura: 'bg-purple-100 text-purple-700', construccion: 'bg-orange-100 text-orange-700',
  herreria: 'bg-slate-100 text-slate-700', herramientas: 'bg-red-100 text-red-700',
  seguridad: 'bg-green-100 text-green-700', climatizacion: 'bg-cyan-100 text-cyan-700',
  otros: 'bg-gray-100 text-gray-600',
};

export default function InventoryImporter({ onClose, onImported }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [step, setStep] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [parsed, setParsed] = useState(null);   // { rows, headers, mapping, fileName, sheetName }
  const [preview, setPreview] = useState([]);   // parsed rows
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const processFile = (file) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target.result, { type: 'array' });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (!rows.length) { toast.error('El archivo está vacío'); return; }
      const headers = Object.keys(rows[0]);
      setAnalyzing(true);
      setTimeout(() => {
        const mapping = detectFieldMapping(headers);
        const parsedRows = rows.map(r => parseRow(r, mapping));
        setParsed({ rows, headers, mapping, fileName: file.name, sheetName });
        setPreview(parsedRows);
        setAnalyzing(false);
        setStep(1);
      }, 800);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFile = (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) { toast.error('Formato no soportado'); return; }
    processFile(file);
  };

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const handleImport = async () => {
    setImporting(true);
    setStep(2);
    let success = 0; const errors = [];
    for (let i = 0; i < preview.length; i++) {
      const item = preview[i];
      if (!item.name) { errors.push(`Fila ${i + 1}: sin nombre`); setProgress(Math.round((i + 1) / preview.length * 100)); continue; }
      try {
        await base44.entities.Material.create(item);
        success++;
      } catch (err) {
        errors.push(`"${item.name}": ${err.message}`);
      }
      setProgress(Math.round((i + 1) / preview.length * 100));
    }
    queryClient.invalidateQueries({ queryKey: ['materials'] });
    const totalValue = preview.reduce((s, r) => s + (r.stock || 0) * (r.unit_cost || 0), 0);
    const catBreakdown = {};
    preview.forEach(r => { catBreakdown[r.category] = (catBreakdown[r.category] || 0) + 1; });
    setResult({ success, errors, total: preview.length, totalValue, catBreakdown });
    setImporting(false);
    setStep(3);
    if (success > 0) onImported?.();
  };

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['nombre', 'codigo', 'categoria', 'unidad', 'stock', 'minimo', 'precio', 'proveedor', 'ubicacion', 'notas'],
      ['Cable 2.5mm²', 'CAB-001', 'electrico', 'metro', 150, 50, 850, 'ElectroSur', 'Estante A1', ''],
      ['Cemento Portland', 'CEM-001', 'construccion', 'bolsa', 80, 20, 2400, 'Cementos SA', 'Deposito', ''],
      ['Pintura látex blanca', 'PIN-001', 'pintura', 'litro', 40, 10, 3200, 'PinturaMax', 'Estante B2', ''],
      ['Caño PVC 4"', 'CAÑ-001', 'plomeria', 'metro', 60, 15, 1200, 'PlomSur', 'Estante C1', ''],
    ]);
    ws['!cols'] = Array(10).fill({ wch: 20 });
    XLSX.utils.book_append_sheet(wb, ws, 'Stock Pañol');
    XLSX.writeFile(wb, 'plantilla_stock_panol.xlsx');
  };

  const coveredFields = parsed ? Object.keys(parsed.mapping).length : 0;
  const totalFields = Object.keys(FIELD_ALIASES).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={!importing ? onClose : undefined} />
      <div className="relative bg-background rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-primary/5 to-primary/0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                Importador Inteligente <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium flex items-center gap-1"><Sparkles className="h-3 w-3" />PRO</span>
              </h2>
              <p className="text-xs text-muted-foreground">Stock del Pañol · Detección automática de columnas</p>
            </div>
          </div>
          {!importing && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>}
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 px-6 py-3 bg-muted/30 border-b">
          {STEPS.map((s, i) => (
            <React.Fragment key={i}>
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                i === step ? 'bg-primary text-primary-foreground' :
                i < step ? 'bg-emerald-100 text-emerald-700' : 'text-muted-foreground'
              }`}>
                {i < step ? <CheckCircle2 className="h-3 w-3" /> : <span className="w-3 h-3 rounded-full border border-current inline-flex items-center justify-center text-[9px]">{i+1}</span>}
                {s}
              </div>
              {i < STEPS.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
            </React.Fragment>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* STEP 0 - Upload */}
          {step === 0 && !analyzing && (
            <div className="space-y-4">
              <div
                className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${dragOver ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border hover:border-primary/50 hover:bg-muted/30'}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <FileSpreadsheet className="h-8 w-8 text-primary" />
                </div>
                <p className="text-lg font-semibold mb-1">Arrastrá tu planilla de stock</p>
                <p className="text-sm text-muted-foreground mb-4">Formatos soportados: Excel (.xlsx, .xls) · CSV</p>
                <Button variant="outline" size="sm" className="gap-2">
                  <Upload className="h-4 w-4" /> Seleccionar archivo
                </Button>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => handleFile(e.target.files[0])} />
              </div>

              {/* Supported fields */}
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <Brain className="h-3.5 w-3.5" /> Campos que detecta automáticamente
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.keys(FIELD_ALIASES).map(f => (
                    <span key={f} className="text-xs bg-background border px-2 py-0.5 rounded-full text-muted-foreground">{f}</span>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center">
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={downloadTemplate}>
                  <Download className="h-3.5 w-3.5" /> Descargar plantilla modelo
                </Button>
              </div>
            </div>
          )}

          {/* Analyzing overlay */}
          {analyzing && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center relative">
                <Brain className="h-10 w-10 text-primary" />
                <div className="absolute inset-0 rounded-2xl border-2 border-primary/30 animate-ping" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold">Analizando con IA...</p>
                <p className="text-sm text-muted-foreground mt-1">Detectando columnas y normalizando datos</p>
              </div>
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}

          {/* STEP 1 - Mapping review */}
          {step === 1 && parsed && (
            <div className="space-y-4">
              {/* File info */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-semibold">{parsed.fileName}</p>
                    <p className="text-xs text-muted-foreground">{parsed.sheetName} · {parsed.rows.length} filas detectadas</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> {coveredFields}/{totalFields} campos
                  </span>
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setParsed(null); setPreview([]); setStep(0); }}>
                    <RefreshCw className="h-3 w-3 mr-1" /> Cambiar
                  </Button>
                </div>
              </div>

              {/* Field mapping */}
              <div className="rounded-xl border overflow-hidden">
                <div className="px-4 py-2.5 bg-muted/40 border-b flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <p className="text-xs font-bold uppercase tracking-wide">Mapeo detectado</p>
                </div>
                <div className="divide-y">
                  {Object.entries(FIELD_ALIASES).map(([field]) => {
                    const header = parsed.mapping[field];
                    return (
                      <div key={field} className={`flex items-center justify-between px-4 py-2 ${header ? '' : 'opacity-40'}`}>
                        <span className="text-sm font-medium w-32">{field}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        {header
                          ? <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full font-mono">{header}</span>
                          : <span className="text-xs text-muted-foreground italic">no detectado</span>
                        }
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Preview table */}
              <div className="rounded-xl border overflow-hidden">
                <div className="px-4 py-2.5 bg-muted/40 border-b">
                  <p className="text-xs font-bold uppercase tracking-wide">Vista previa (primeras 5 filas)</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/20">
                      <tr>
                        {['Nombre', 'Código', 'Categoría', 'Unidad', 'Stock', 'Mín.', 'Precio', 'Proveedor'].map(h => (
                          <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {preview.slice(0, 5).map((r, i) => (
                        <tr key={i} className="hover:bg-muted/20">
                          <td className="px-3 py-2 font-medium">{r.name || <span className="text-red-500 italic">vacío</span>}</td>
                          <td className="px-3 py-2 font-mono text-muted-foreground">{r.code || '—'}</td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${CAT_COLORS[r.category] || CAT_COLORS.otros}`}>
                              {categoryLabels[r.category] || r.category}
                            </span>
                          </td>
                          <td className="px-3 py-2">{unitLabels[r.unit] || r.unit}</td>
                          <td className="px-3 py-2 font-medium">{r.stock}</td>
                          <td className="px-3 py-2 text-muted-foreground">{r.min_stock}</td>
                          <td className="px-3 py-2">${r.unit_cost?.toLocaleString()}</td>
                          <td className="px-3 py-2 text-muted-foreground truncate max-w-[100px]">{r.supplier || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Ítems a importar', value: preview.length, icon: Package, color: 'text-primary' },
                  { label: 'Con nombre válido', value: preview.filter(r => r.name).length, icon: CheckCircle2, color: 'text-emerald-600' },
                  { label: 'Valor total estimado', value: `$${preview.reduce((s, r) => s + (r.stock || 0) * (r.unit_cost || 0), 0).toLocaleString()}`, icon: DollarSign, color: 'text-amber-600' },
                ].map(stat => (
                  <div key={stat.label} className="rounded-xl border bg-card p-3 text-center">
                    <stat.icon className={`h-5 w-5 mx-auto mb-1 ${stat.color}`} />
                    <p className="text-lg font-bold">{stat.value}</p>
                    <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2 - Importing progress */}
          {step === 2 && importing && (
            <div className="flex flex-col items-center justify-center py-16 gap-6">
              <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center relative">
                <Package className="h-10 w-10 text-primary" />
              </div>
              <div className="text-center w-full max-w-sm">
                <p className="text-lg font-semibold mb-1">Importando stock al pañol...</p>
                <p className="text-sm text-muted-foreground mb-4">{Math.round(progress * preview.length / 100)} de {preview.length} materiales</p>
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-2">{progress}% completado</p>
              </div>
            </div>
          )}

          {/* STEP 3 - Result */}
          {step === 3 && result && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className={`h-16 w-16 rounded-2xl mx-auto flex items-center justify-center mb-3 ${result.errors.length === 0 ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                  {result.errors.length === 0
                    ? <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                    : <AlertCircle className="h-8 w-8 text-amber-600" />
                  }
                </div>
                <p className="text-2xl font-bold">{result.success} materiales importados</p>
                <p className="text-sm text-muted-foreground">de {result.total} registros procesados</p>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
                  <DollarSign className="h-8 w-8 text-amber-500 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Valor total del stock</p>
                    <p className="text-xl font-bold">${result.totalValue.toLocaleString()}</p>
                  </div>
                </div>
                <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
                  <BarChart2 className="h-8 w-8 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Categorías detectadas</p>
                    <p className="text-xl font-bold">{Object.keys(result.catBreakdown).length}</p>
                  </div>
                </div>
              </div>

              {/* Category breakdown */}
              <div className="rounded-xl border overflow-hidden">
                <div className="px-4 py-2.5 bg-muted/40 border-b">
                  <p className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Por categoría</p>
                </div>
                <div className="divide-y">
                  {Object.entries(result.catBreakdown).sort((a,b) => b[1]-a[1]).map(([cat, count]) => (
                    <div key={cat} className="flex items-center justify-between px-4 py-2.5">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${CAT_COLORS[cat] || CAT_COLORS.otros}`}>
                        {categoryLabels[cat] || cat}
                      </span>
                      <div className="flex items-center gap-3">
                        <div className="w-24 bg-muted rounded-full h-1.5">
                          <div className="bg-primary rounded-full h-1.5" style={{ width: `${(count / result.success) * 100}%` }} />
                        </div>
                        <span className="text-sm font-semibold w-6 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Errors */}
              {result.errors.length > 0 && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 max-h-32 overflow-y-auto">
                  <p className="text-xs font-bold text-destructive mb-1.5 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {result.errors.length} errores</p>
                  {result.errors.map((e, i) => <p key={i} className="text-xs text-muted-foreground">{e}</p>)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/20">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={downloadTemplate}>
            <Download className="h-3.5 w-3.5" /> Plantilla modelo
          </Button>
          <div className="flex gap-2">
            {step === 3 ? (
              <Button onClick={onClose}>Listo</Button>
            ) : step === 1 ? (
              <>
                <Button variant="outline" size="sm" onClick={() => { setParsed(null); setPreview([]); setStep(0); }}>Atrás</Button>
                <Button size="sm" className="gap-1.5" onClick={handleImport} disabled={preview.filter(r => r.name).length === 0}>
                  <Upload className="h-3.5 w-3.5" />
                  Importar {preview.filter(r => r.name).length} materiales
                </Button>
              </>
            ) : step === 0 ? (
              <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}