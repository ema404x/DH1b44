import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Loader2, BarChart2, ChevronRight, ArrowLeft, CheckCircle2, Clock, AlertCircle, Save, Zap, Plus, Upload, FileSpreadsheet, Download, Trash2, X, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);
const RED_DARK = '#9B1C1C';
const RED_MAIN = '#C53030';
const RED_LIGHT = '#FED7D7';

function calcTotalPresupuesto(rubros, cp, co) {
  return (rubros || []).reduce((a, r) =>
    a + (r.items || []).reduce((b, i) => {
      const pu = (Number(i.pu_mat) || 0) + (Number(i.pu_mo) || 0);
      return b + pu * cp * co * (Number(i.cantidad) || 0);
    }, 0), 0);
}

function calcAvanceTotal(rubros, cp, co) {
  let total = 0, acum = 0;
  (rubros || []).forEach(r =>
    (r.items || []).forEach(i => {
      const sub = ((Number(i.pu_mat) || 0) + (Number(i.pu_mo) || 0)) * cp * co * (Number(i.cantidad) || 0);
      const ant = Number(i.avance_anterior_pct) || 0;
      const act = Number(i.avance_actual_pct) || 0;
      total += sub;
      acum  += sub * Math.min(ant + act, 100) / 100;
    })
  );
  return { total, acum, pct: total > 0 ? (acum / total) * 100 : 0 };
}

// ── Card de presupuesto en la lista ─────────────────────────────────────────
function PresupuestoCard({ p, onOpen, onDelete }) {
  const cp = p.coef_pase   ?? 1.6504;
  const co = p.coef_oferta ?? 1.38;
  const { total, acum, pct } = calcAvanceTotal(p.rubros, cp, co);
  const totalItems = (p.rubros || []).reduce((a, r) => a + (r.items || []).length, 0);
  const [uploadingExcel, setUploadingExcel] = useState(false);
  const excelRef = useRef();

  const pctColor = pct >= 100 ? 'text-emerald-600' : pct > 0 ? 'text-blue-600' : 'text-gray-400';
  const barColor = pct >= 100 ? '#22c55e' : pct > 0 ? '#3b82f6' : '#e5e7eb';

  const handleExcelUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingExcel(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.PresupuestoObraEnhanced.update(p.id, { archivo_url: file_url, archivo_nombre: file.name });
    toast.success('Excel actualizado');
    setUploadingExcel(false);
    e.target.value = '';
  };

  return (
    <div className="border rounded-xl bg-white hover:shadow-md transition-all" style={{ borderColor: '#E2E8F0' }}>
      {/* Área clickeable */}
      <div onClick={() => onOpen(p)} className="group cursor-pointer p-4 hover:border-red-300 rounded-t-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm truncate group-hover:text-red-700 transition-colors" style={{ color: RED_DARK }}>{p.titulo || '(Sin título)'}</p>
            <p className="text-[10px] font-mono text-gray-400 mt-0.5">{p.codigo}</p>
            {p.escuela && <p className="text-xs text-gray-500 mt-0.5 truncate">{p.escuela}</p>}
            <p className="text-[10px] text-gray-400 mt-1">{totalItems} ítems · {(p.rubros || []).length} rubros</p>
          </div>
          <div className="text-right shrink-0">
            <p className={`text-xl font-bold tabular-nums ${pctColor}`}>{pct.toFixed(0)}%</p>
            <p className="text-[10px] text-gray-400">acumulado</p>
          </div>
        </div>

        <div className="mt-3 h-2 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: barColor }} />
        </div>

        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-gray-400">{fmt(total)}</span>
          <span className="text-[10px] font-semibold" style={{ color: pct > 0 ? '#3b82f6' : '#9CA3AF' }}>{fmt(acum)} certificado</span>
        </div>

        <div className="mt-3 pt-2">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border
            ${pct >= 100 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
              pct > 0 ? 'bg-blue-50 text-blue-700 border-blue-200' :
              'bg-gray-50 text-gray-500 border-gray-200'}`}>
            {pct >= 100 ? '✓ Obra completa' : pct > 0 ? 'En progreso' : 'Sin avance'}
          </span>
        </div>
      </div>

      {/* Barra de acciones */}
      <div className="flex items-center gap-1 px-3 py-2 border-t border-gray-100 bg-gray-50/50 rounded-b-xl">
        <span className="text-[10px] text-gray-400 flex-1">
          {p.archivo_nombre
            ? <span className="flex items-center gap-1 text-emerald-700"><FileSpreadsheet className="h-3 w-3" />{p.archivo_nombre}</span>
            : <span className="text-gray-400 italic">Sin Excel adjunto</span>}
        </span>
        {/* Subir / reemplazar Excel */}
        <input ref={excelRef} type="file" accept=".xlsx,.xls" onChange={handleExcelUpload} className="hidden" />
        <button
          onClick={e => { e.stopPropagation(); excelRef.current?.click(); }}
          className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded border border-gray-200 text-gray-600 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition-all"
          title="Subir Excel">
          {uploadingExcel ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
          {p.archivo_url ? 'Reemplazar' : 'Subir Excel'}
        </button>
        {/* Descargar Excel */}
        {p.archivo_url && (
          <a href={p.archivo_url} target="_blank" rel="noopener noreferrer" download onClick={e => e.stopPropagation()}>
            <button className="p-1 rounded border border-gray-200 text-gray-500 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition-all" title="Descargar Excel">
              <Download className="h-3.5 w-3.5" />
            </button>
          </a>
        )}
        {/* Cargar avance */}
        <button onClick={() => onOpen(p)}
          className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded transition-all"
          style={{ background: RED_DARK, color: 'white' }}>
          Avance <ChevronRight className="h-3 w-3" />
        </button>
        {/* Eliminar */}
        <button
          onClick={e => { e.stopPropagation(); if (confirm('¿Eliminar este presupuesto?')) onDelete(p.id); }}
          className="p-1 rounded border border-gray-200 text-gray-400 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-all" title="Eliminar">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Zona de importación inteligente con IA ───────────────────────────────────
function ImportarExcelIA({ onClose, onCreated }) {
  const [step, setStep] = useState('idle'); // idle | uploading | analyzing | done | error
  const [fileName, setFileName] = useState('');
  const [stats, setStats] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef();

  const processFile = async (file) => {
    if (!file?.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Solo se aceptan archivos Excel (.xlsx, .xls)');
      return;
    }
    setFileName(file.name);
    setStep('uploading');
    setErrorMsg('');

    // 1. Subir el archivo
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    // 2. IA analiza y crea el presupuesto
    setStep('analyzing');
    const res = await base44.functions.invoke('importarExcelPresupuesto', {
      file_url,
      archivo_nombre: file.name,
    });

    if (res.data?.success) {
      setStats(res.data.stats);
      setStep('done');
      onCreated();
    } else {
      setErrorMsg(res.data?.error || 'Error al procesar el Excel');
      setStep('error');
    }
  };

  const handleFileInput = (e) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) processFile(f);
  };

  const isProcessing = step === 'uploading' || step === 'analyzing';

  return (
    <div className="rounded-xl border-2 overflow-hidden" style={{ borderColor: RED_DARK }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ background: RED_DARK }}>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-yellow-300" />
          <span className="font-bold text-sm text-white">Importar Excel con IA</span>
          <span className="text-[10px] text-white/60 bg-white/10 px-2 py-0.5 rounded-full">Automático</span>
        </div>
        {!isProcessing && <button onClick={onClose} className="text-white/60 hover:text-white"><X className="h-4 w-4" /></button>}
      </div>

      <div className="bg-white p-5">
        {/* Estado: idle — zona de drop */}
        {step === 'idle' && (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all
              ${dragging ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-red-300 hover:bg-red-50/30'}`}
          >
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileInput} className="hidden" />
            <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p className="font-bold text-sm text-gray-700">Arrastrá tu Excel aquí o hacé click para seleccionar</p>
            <p className="text-xs text-gray-400 mt-1">La IA detectará automáticamente rubros, ítems, precios y datos del presupuesto</p>
            <div className="flex items-center justify-center gap-2 mt-4">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">PCP</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">PAPORC</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">PAMON</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-200">Otros formatos</span>
            </div>
          </div>
        )}

        {/* Estado: procesando */}
        {isProcessing && (
          <div className="text-center py-8 space-y-4">
            <div className="relative mx-auto h-14 w-14">
              <Loader2 className="h-14 w-14 animate-spin" style={{ color: RED_MAIN }} />
              <Sparkles className="h-5 w-5 absolute inset-0 m-auto text-yellow-400" />
            </div>
            <div>
              <p className="font-bold text-sm" style={{ color: RED_DARK }}>
                {step === 'uploading' ? 'Subiendo archivo...' : 'IA analizando el presupuesto...'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {step === 'uploading'
                  ? `Cargando ${fileName}`
                  : 'Detectando rubros, ítems, precios y datos del presupuesto'}
              </p>
            </div>
            {step === 'analyzing' && (
              <div className="flex justify-center gap-4 text-[10px] text-gray-400">
                <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Excel leído</span>
                <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin text-blue-500" /> Procesando con IA...</span>
              </div>
            )}
          </div>
        )}

        {/* Estado: done */}
        {step === 'done' && (
          <div className="text-center py-6 space-y-3">
            <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500" />
            <p className="font-bold text-sm text-emerald-700">¡Presupuesto importado correctamente!</p>
            {stats && (
              <p className="text-xs text-gray-500">
                Se detectaron <strong>{stats.rubros} rubros</strong> y <strong>{stats.items} ítems</strong>
              </p>
            )}
            <Button size="sm" onClick={onClose} style={{ background: RED_DARK, color: 'white' }}>
              Ver presupuesto
            </Button>
          </div>
        )}

        {/* Estado: error */}
        {step === 'error' && (
          <div className="text-center py-6 space-y-3">
            <AlertCircle className="h-10 w-10 mx-auto text-red-500" />
            <p className="font-bold text-sm text-red-700">No se pudo procesar el Excel</p>
            <p className="text-xs text-gray-500">{errorMsg}</p>
            <Button size="sm" variant="outline" onClick={() => setStep('idle')}>Intentar de nuevo</Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function AvanceObra() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null); // presupuesto abierto
  const [showNuevo, setShowNuevo] = useState(false);

  const { data: presupuestos = [], isLoading } = useQuery({
    queryKey: ['presupuestos-obra'],
    queryFn: () => base44.entities.PresupuestoObraEnhanced.list('-updated_date', 100),
  });

  const saveMutation = useMutation({
    mutationFn: ({ id, rubros }) => base44.entities.PresupuestoObraEnhanced.update(id, { rubros }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['presupuestos-obra'] });
      toast.success('Avance guardado correctamente');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PresupuestoObraEnhanced.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['presupuestos-obra'] });
      toast.success('Presupuesto eliminado');
    },
  });

  const filtered = presupuestos.filter(p => {
    const q = search.toLowerCase();
    return !q || p.titulo?.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q) || p.escuela?.toLowerCase().includes(q);
  });

  // Stats globales
  const totalObras = presupuestos.length;
  const completas  = presupuestos.filter(p => {
    const { pct } = calcAvanceTotal(p.rubros, p.coef_pase ?? 1.6504, p.coef_oferta ?? 1.38);
    return pct >= 100;
  }).length;
  const enProgreso = presupuestos.filter(p => {
    const { pct } = calcAvanceTotal(p.rubros, p.coef_pase ?? 1.6504, p.coef_oferta ?? 1.38);
    return pct > 0 && pct < 100;
  }).length;

  // ── Helpers para edición inline ────────────────────────────────────────────
  const setItemAvance = (rIdx, iIdx, value) => {
    setSelected(s => {
      const rubros = s.rubros.map((r, ri) => {
        if (ri !== rIdx) return r;
        return {
          ...r, items: r.items.map((item, ii) => {
            if (ii !== iIdx) return item;
            const anterior = Number(item.avance_anterior_pct) || 0;
            const v = Math.max(0, Math.min(parseFloat(value) || 0, 100 - anterior));
            return { ...item, avance_actual_pct: v };
          })
        };
      });
      return { ...s, rubros };
    });
  };

  const applyToRubro = (rIdx, pct) => {
    setSelected(s => {
      const rubros = s.rubros.map((r, ri) => {
        if (ri !== rIdx) return r;
        return {
          ...r, items: r.items.map(item => {
            const anterior = Number(item.avance_anterior_pct) || 0;
            const disponible = Math.max(0, pct - anterior);
            return { ...item, avance_actual_pct: disponible };
          })
        };
      });
      return { ...s, rubros };
    });
  };

  const applyToAll = (pct) => {
    setSelected(s => ({
      ...s,
      rubros: (s.rubros || []).map(r => ({
        ...r, items: (r.items || []).map(item => {
          const anterior = Number(item.avance_anterior_pct) || 0;
          const disponible = Math.max(0, pct - anterior);
          return { ...item, avance_actual_pct: disponible };
        })
      }))
    }));
  };

  // Vista detalle — tabla intuitiva con botones rápidos
  if (selected) {
    const cp = selected.coef_pase   ?? 1.6504;
    const co = selected.coef_oferta ?? 1.38;

    const calcSub = (item) => ((Number(item.pu_mat)||0)+(Number(item.pu_mo)||0))*cp*co*(Number(item.cantidad)||0);

    let totalPpto = 0, totalActual = 0, totalAcum = 0;
    (selected.rubros||[]).forEach(r => (r.items||[]).forEach(i => {
      const sub = calcSub(i);
      const ant = Number(i.avance_anterior_pct)||0;
      const act = Number(i.avance_actual_pct)||0;
      totalPpto  += sub;
      totalActual+= sub * act / 100;
      totalAcum  += sub * Math.min(ant+act,100) / 100;
    }));
    const pctAcum = totalPpto > 0 ? (totalAcum/totalPpto)*100 : 0;

    return (
      <div className="flex flex-col min-h-full space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" className="gap-1.5 text-gray-500" onClick={() => setSelected(null)}>
            <ArrowLeft className="h-4 w-4" /> Volver
          </Button>
          <div className="flex items-center gap-1.5 text-sm min-w-0">
            <span className="text-gray-400 text-xs">Avance de Obra</span>
            <ChevronRight className="h-3 w-3 text-gray-300" />
            <span className="font-bold truncate max-w-xs" style={{ color: RED_DARK }}>{selected.titulo}</span>
          </div>
          <div className="ml-auto flex gap-2">
            <Button size="sm" className="gap-1.5" style={{ background: RED_DARK, color: 'white' }}
              onClick={() => saveMutation.mutate({ id: selected.id, rubros: selected.rubros })}
              disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Guardar
            </Button>
          </div>
        </div>

        {/* Info + totales */}
        <div className="rounded-xl border px-4 py-3 flex flex-wrap items-center gap-6 text-xs"
          style={{ background: RED_LIGHT, borderColor: RED_MAIN }}>
          <div><span className="text-gray-500">Código:</span> <span className="font-mono font-bold" style={{ color: RED_DARK }}>{selected.codigo}</span></div>
          {selected.escuela && <div><span className="text-gray-500">Escuela:</span> <span className="font-semibold" style={{ color: RED_DARK }}>{selected.escuela}</span></div>}
          <div className="ml-auto flex gap-6">
            <div className="text-center">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Presupuesto</p>
              <p className="font-bold tabular-nums" style={{ color: RED_DARK }}>{fmt(totalPpto)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Este período</p>
              <p className="font-bold tabular-nums text-green-700">{fmt(totalActual)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Acumulado</p>
              <p className="font-bold tabular-nums text-blue-700">{fmt(totalAcum)} ({pctAcum.toFixed(0)}%)</p>
            </div>
          </div>
        </div>

        {/* Botones masivos */}
        <div className="flex items-center gap-2 px-1 flex-wrap">
          <Zap className="h-4 w-4 shrink-0" style={{ color: RED_MAIN }} />
          <span className="text-xs font-semibold text-gray-600">Aplicar a TODA la obra:</span>
          <button onClick={() => applyToAll(0)}
            className="px-3 py-1.5 text-xs font-bold rounded-lg border transition-all bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100">
            0%
          </button>
          <button onClick={() => applyToAll(50)}
            className="px-3 py-1.5 text-xs font-bold rounded-lg border transition-all bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100">
            50% a todo
          </button>
          <button onClick={() => applyToAll(100)}
            className="px-3 py-1.5 text-xs font-bold rounded-lg border transition-all bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100">
            100% a todo
          </button>
        </div>

        {/* Rubros y tablas */}
        <div className="space-y-4">
          {(selected.rubros || []).length === 0 ? (
            <div className="text-center py-16 text-gray-400">Sin rubros. Cargalos en el editor de presupuesto.</div>
          ) : (selected.rubros || []).map((rubro, rIdx) => {
            const rubroItems = rubro.items || [];
            const rubroTotal = rubroItems.reduce((a, i) => a + calcSub(i), 0);
            const rubroAcum  = rubroItems.reduce((a, i) => {
              const sub = calcSub(i);
              const ant = Number(i.avance_anterior_pct)||0;
              const act = Number(i.avance_actual_pct)||0;
              return a + sub * Math.min(ant+act,100)/100;
            }, 0);
            const rubroPct = rubroTotal > 0 ? (rubroAcum/rubroTotal)*100 : 0;

            return (
              <div key={rIdx} className="rounded-xl border overflow-hidden bg-white shadow-sm" style={{ borderColor: '#E2E8F0' }}>
                {/* Header del rubro */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b"
                  style={{ background: RED_DARK, borderColor: '#7A1010' }}>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center h-5 w-5 rounded bg-white/20 text-white text-[10px] font-bold">{rIdx+1}</span>
                    <span className="text-sm font-bold text-white">{rubro.nombre}</span>
                    <span className="text-[10px] text-white/60 tabular-nums">{rubroItems.length} ítems</span>
                  </div>
                  {/* Botones rápidos por rubro */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-white/60 mr-1">Rubro:</span>
                    <button onClick={() => applyToRubro(rIdx, 0)}
                      className="px-2 py-0.5 text-[10px] font-bold rounded border border-white/30 text-white/80 hover:bg-white/20 transition-all">0%</button>
                    <button onClick={() => applyToRubro(rIdx, 50)}
                      className="px-2 py-0.5 text-[10px] font-bold rounded border border-amber-300 bg-amber-500/30 text-amber-200 hover:bg-amber-500/50 transition-all">50%</button>
                    <button onClick={() => applyToRubro(rIdx, 100)}
                      className="px-2 py-0.5 text-[10px] font-bold rounded border border-emerald-300 bg-emerald-500/30 text-emerald-200 hover:bg-emerald-500/50 transition-all">100%</button>
                    <span className="ml-3 text-xs font-bold text-yellow-300 tabular-nums">{fmt(rubroTotal)}</span>
                    <span className="text-[10px] text-white/60 ml-1">({rubroPct.toFixed(0)}% acum)</span>
                  </div>
                </div>

                {/* Tabla ítems */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-3 py-2 text-gray-500 font-semibold w-6">#</th>
                        <th className="text-left px-3 py-2 text-gray-500 font-semibold">Descripción</th>
                        <th className="text-center px-3 py-2 text-gray-500 font-semibold w-14">UM</th>
                        <th className="text-right px-3 py-2 text-gray-500 font-semibold w-14">Cant.</th>
                        <th className="text-right px-3 py-2 text-gray-500 font-semibold w-28">Subtotal</th>
                        <th className="text-center px-2 py-2 text-amber-600 font-semibold w-20">Anterior</th>
                        <th className="text-center px-2 py-2 text-green-700 font-semibold w-40">Avance actual</th>
                        <th className="text-center px-2 py-2 text-blue-700 font-semibold w-20">Acumulado</th>
                        <th className="text-right px-3 py-2 text-green-700 font-semibold w-28">Imp. Actual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rubroItems.map((item, iIdx) => {
                        const sub   = calcSub(item);
                        const ant   = Number(item.avance_anterior_pct) || 0;
                        const act   = Number(item.avance_actual_pct)   || 0;
                        const acum2 = Math.min(ant + act, 100);
                        const impAct = sub * act / 100;
                        const isComplete = acum2 >= 100;
                        return (
                          <tr key={iIdx} className={`border-b border-gray-100 ${iIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'} ${isComplete ? 'bg-emerald-50/30' : ''}`}>
                            <td className="px-3 py-2 text-gray-400 text-center">
                              {isComplete ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mx-auto" /> : <span>{iIdx+1}</span>}
                            </td>
                            <td className="px-3 py-2 text-gray-700 max-w-xs">
                              <span className="line-clamp-2 leading-snug">{item.descripcion}</span>
                              {item.codigo && <span className="text-[10px] font-mono text-gray-400 block">{item.codigo}</span>}
                            </td>
                            <td className="px-3 py-2 text-center text-gray-500">{item.unidad}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-gray-600">{item.cantidad}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-semibold" style={{ color: RED_DARK }}>{fmt(sub)}</td>
                            {/* Anterior — solo lectura */}
                            <td className="px-2 py-2 text-center">
                              <span className="inline-block px-2 py-0.5 rounded text-xs font-mono bg-amber-50 border border-amber-200 text-amber-700 tabular-nums">{ant}%</span>
                            </td>
                            {/* Avance actual — botones + input */}
                            <td className="px-2 py-1.5">
                              <div className="flex items-center gap-1 justify-center">
                                <button
                                  onClick={() => setItemAvance(rIdx, iIdx, 0)}
                                  className="px-1.5 py-0.5 text-[10px] font-bold rounded border border-gray-200 text-gray-500 hover:bg-gray-100 transition-all">
                                  0
                                </button>
                                <button
                                  onClick={() => setItemAvance(rIdx, iIdx, Math.max(0, 50 - ant))}
                                  className="px-1.5 py-0.5 text-[10px] font-bold rounded border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-all">
                                  50%
                                </button>
                                <button
                                  onClick={() => setItemAvance(rIdx, iIdx, Math.max(0, 100 - ant))}
                                  className="px-1.5 py-0.5 text-[10px] font-bold rounded border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-all">
                                  100%
                                </button>
                                <Input
                                  type="number"
                                  min={0}
                                  max={100 - ant}
                                  value={act === 0 && item.avance_actual_pct === undefined ? '' : act}
                                  onChange={e => setItemAvance(rIdx, iIdx, e.target.value)}
                                  className="h-7 w-14 text-xs text-center font-mono border-gray-300 tabular-nums"
                                  placeholder="%"
                                />
                              </div>
                            </td>
                            {/* Acumulado */}
                            <td className="px-2 py-2 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold tabular-nums border
                                ${acum2 >= 100 ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : acum2 > 0  ? 'bg-blue-100 text-blue-800 border-blue-300'
                                  : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                                {acum2}%
                              </span>
                            </td>
                            {/* Importe actual */}
                            <td className="px-3 py-2 text-right tabular-nums font-semibold text-green-700">{fmt(impAct)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-900 border-t-2 border-gray-600">
                        <td colSpan={4} className="px-3 py-2 text-xs font-bold text-gray-300">SUBTOTAL {rubro.nombre}</td>
                        <td className="px-3 py-2 text-right font-bold text-red-300 tabular-nums">{fmt(rubroTotal)}</td>
                        <td />
                        <td />
                        <td className="px-2 py-2 text-center text-xs font-bold text-blue-300">{rubroPct.toFixed(0)}%</td>
                        <td className="px-3 py-2 text-right font-bold text-green-300 tabular-nums">{fmt(rubroAcum)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer guardar */}
        <div className="flex justify-end pb-8">
          <Button className="gap-2 px-6" style={{ background: RED_DARK, color: 'white' }}
            onClick={() => saveMutation.mutate({ id: selected.id, rubros: selected.rubros })}
            disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar Avance
          </Button>
        </div>
      </div>
    );
  }

  // Vista lista
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: RED_DARK }}>
            <BarChart2 className="h-5 w-5" style={{ color: RED_MAIN }} />
            Avance de Obra — PAMON / PAPORC
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Seguimiento físico de avance por obra y certificación mensual</p>
        </div>
        <Button size="sm" className="gap-1.5" style={{ background: RED_DARK, color: 'white' }}
          onClick={() => setShowNuevo(v => !v)}>
          <Plus className="h-4 w-4" /> Nuevo Presupuesto
        </Button>
      </div>

      {/* Importador IA */}
      {showNuevo && (
        <ImportarExcelIA
          onClose={() => setShowNuevo(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ['presupuestos-obra'] })}
        />
      )}

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-0 rounded-xl overflow-hidden border shadow-sm" style={{ borderColor: RED_DARK }}>
        {[
          { label: 'Total Obras', value: totalObras, icon: BarChart2, bg: RED_DARK, color: 'white' },
          { label: 'En Progreso', value: enProgreso, icon: Clock, bg: RED_MAIN, color: 'white' },
          { label: 'Completadas', value: completas, icon: CheckCircle2, bg: '#ffffff', color: RED_DARK },
        ].map(({ label, value, icon: Icon, bg, color }, i) => (
          <div key={label} className={`flex items-center gap-3 px-4 py-3 ${i < 2 ? 'border-r' : ''}`}
            style={{ background: bg, borderColor: RED_DARK }}>
            <Icon className="h-5 w-5 shrink-0" style={{ color: i < 2 ? 'rgba(255,255,255,0.8)' : RED_MAIN }} />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: i < 2 ? 'rgba(255,255,255,0.7)' : '#6B7280' }}>{label}</p>
              <p className="text-xl font-bold tabular-nums leading-none mt-0.5" style={{ color: i < 2 ? '#fff' : RED_DARK }}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Buscador */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <Input placeholder="Buscar obra..." value={search} onChange={e => setSearch(e.target.value)}
          className="pl-9 h-9" />
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" style={{ color: RED_DARK }} /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-20 gap-3" style={{ borderColor: RED_LIGHT }}>
          <AlertCircle className="h-10 w-10" style={{ color: RED_LIGHT }} />
          <p className="font-semibold" style={{ color: RED_DARK }}>
            {presupuestos.length === 0 ? 'No hay presupuestos de obra cargados' : 'Sin resultados'}
          </p>
          <p className="text-sm text-gray-400">Cargá presupuestos en el módulo "Presupuestos Obra" primero.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(p => (
            <PresupuestoCard key={p.id} p={p} onOpen={setSelected} onDelete={id => deleteMutation.mutate(id)} />
          ))}
        </div>
      )}
    </div>
  );
}