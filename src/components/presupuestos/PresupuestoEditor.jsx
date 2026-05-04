import React, { useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft, Save, Loader2, FileSpreadsheet, FileText,
  ChevronRight, BarChart2, Layers, FileCheck, Sparkles, Info
} from 'lucide-react';
import PCPGrid from '@/components/presupuestos/PCPGrid';
import PlanTrabajos from '@/components/presupuestos/PlanTrabajos';
import PAPORCGrid from '@/components/presupuestos/PAPORCGrid';
import { generatePresupuestoPDF } from '@/components/presupuestos/presupuestoPDF';
import { exportPresupuestoExcel } from '@/utils/exportExcel';
import { toast } from 'sonner';

// ── Paleta Mejores — rojo corporativo ──────────────────────────────────────
const RED_MAIN = '#C53030';  // Rojo principal
const RED_DARK = '#9B1C1C';  // Rojo oscuro para headers
const RED_LIGHT = '#FED7D7'; // Rojo claro para fondos
const YELLOW_ACC = '#FCD34D'; // Amarillo accent
const GRAY_ACC = '#4A5568';

const ESTADO = {
  borrador:  { label: 'Borrador',  cls: 'bg-slate-100 text-slate-700 border-slate-300' },
  enviado:   { label: 'Enviado',   cls: 'bg-blue-100 text-blue-700 border-blue-300' },
  aprobado:  { label: 'Aprobado',  cls: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  rechazado: { label: 'Rechazado', cls: 'bg-red-100 text-red-700 border-red-300' },
  facturado: { label: 'Facturado', cls: 'bg-purple-100 text-purple-700 border-purple-300' },
};

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

function generateCode() {
  return `PPTO-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
}

function calcTotals(rubros, cp, co) {
  return (rubros || []).reduce((acc, r) =>
    acc + (r.items || []).reduce((a, i) => {
      const pu = (Number(i.pu_mat) || 0) + (Number(i.pu_mo) || 0);
      return a + pu * cp * co * (Number(i.cantidad) || 0);
    }, 0), 0);
}

// ── Componentes UI con paleta ministerial ────────────────────────────────────
function MetaLabel({ children }) {
  return (
    <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#6B7280' }}>
      {children}
    </label>
  );
}

function MetaInput({ value, onChange, type = 'text', readOnly, placeholder, step, className = '' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      readOnly={readOnly}
      placeholder={placeholder}
      step={step}
      className={`w-full h-8 px-2.5 text-sm rounded border outline-none transition-all
        ${readOnly ? 'bg-gray-50 cursor-default' : 'bg-white focus:ring-1'}
        ${className}`}
      style={{ borderColor: '#E5E7EB', color: RED_DARK, focusRing: RED_MAIN, fontFamily: type === 'number' ? 'monospace' : undefined }}
    />
  );
}

function SectionHeader({ children }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b"
      style={{ background: RED_DARK, borderColor: RED_DARK }}>
      <div className="w-0.5 h-4 rounded-full bg-yellow-300" />
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-white" >{children}</h3>
    </div>
  );
}

// ── Sidebar resumen ──────────────────────────────────────────────────────────
function ResumenPanel({ form, onCoefChange }) {
  const cp = Number(form.coef_pase)   || 1.6504;
  const co = Number(form.coef_oferta) || 1.38;
  const subtotal = calcTotals(form.rubros, cp, co);
  const totalItems = (form.rubros || []).reduce((a, r) => a + (r.items || []).length, 0);

  return (
    <div className="rounded-xl overflow-hidden shadow-md" style={{ border: `1px solid ${RED_DARK}` }}>
      {/* Header rojo */}
      <div className="px-4 py-4" style={{ background: RED_DARK }}>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-1 text-white opacity-90">Total Presupuesto</p>
        <p className="text-2xl font-bold tabular-nums text-white">{fmt(subtotal)}</p>
        <div className="flex gap-3 mt-1.5">
          <span className="text-[11px] text-white opacity-80">{(form.rubros || []).length} rubros</span>
          <span className="text-[11px] text-white opacity-80">{totalItems} ítems</span>
        </div>
      </div>

      {/* Coeficientes — fondo rojo medio */}
      <div className="px-4 py-3 border-b" style={{ background: RED_MAIN, borderColor: '#A91C1C' }}>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-2 text-white opacity-90">Coeficientes PCP</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Coef. Pase', key: 'coef_pase', step: '0.0001' },
            { label: 'Coef. Oferta', key: 'coef_oferta', step: '0.01' },
          ].map(({ label, key, step }) => (
            <div key={key}>
              <label className="text-[10px] font-medium block mb-1 text-white opacity-80">{label}</label>
              <input type="number" step={step} value={form[key] ?? ''}
                onChange={e => onCoefChange(key, parseFloat(e.target.value) || 0)}
                className="w-full h-7 px-2 text-xs text-center font-mono rounded border bg-white/10 text-white outline-none focus:bg-white/20"
                style={{ borderColor: 'rgba(255,255,255,0.3)' }} />
            </div>
          ))}
        </div>
      </div>

      {/* Por rubro — rojo claro */}
      {(form.rubros || []).length > 0 && (
        <div className="px-4 py-3 space-y-2 border-b" style={{ background: RED_LIGHT, borderColor: '#FABCBC' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: RED_DARK }}>Por Rubro</p>
          {(form.rubros || []).map((r, i) => {
            const sub = calcTotals([r], cp, co);
            const pct = subtotal > 0 ? (sub / subtotal) * 100 : 0;
            return (
              <div key={i} className="space-y-0.5">
                <div className="flex justify-between items-baseline gap-1">
                  <span className="text-[11px] truncate flex-1" style={{ color: RED_DARK }}>{r.nombre || `Rubro ${i + 1}`}</span>
                  <span className="text-[11px] font-bold tabular-nums" style={{ color: RED_MAIN }}>{fmt(sub)}</span>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: '#F8AABB' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: RED_DARK }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Total fila — amarillo accent */}
      <div className="px-4 py-3" style={{ background: '#FFFBEB' }}>
        <div className="flex justify-between items-center rounded px-3 py-2.5"
          style={{ background: YELLOW_ACC, border: `1px solid #FCD34D` }}>
          <span className="font-bold text-xs uppercase tracking-wide" style={{ color: RED_DARK }}>TOTAL</span>
          <span className="font-bold text-sm tabular-nums" style={{ color: RED_DARK }}>{fmt(subtotal)}</span>
        </div>
      </div>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function PresupuestoEditor({ presupuesto, onSave, onCancel, saving }) {
  const [view, setView] = useState('editor'); // 'editor' | 'paporc' | 'plan'
  const [form, setForm] = useState(() => presupuesto ? { ...presupuesto } : {
    codigo: generateCode(),
    titulo: '',
    cliente_nombre: 'GCBA - MINISTERIO DE EDUCACIÓN DE LA CIUDAD DE BUENOS AIRES - DGMESC',
    licitacion: '',
    proyecto_nombre: '',
    direccion_obra: '',
    responsable: '',
    inspector: '',
    mtom: '',
    comuna: '8A',
    coef_pase: 1.6504,
    coef_oferta: 1.38,
    preciario_fecha: '',
    plazo: '30',
    estado: 'borrador',
    fecha_emision: new Date().toISOString().split('T')[0],
    rubros: [],
    notas: '',
  });

  const { data: precario = [] } = useQuery({
    queryKey: ['precario', form.comuna],
    queryFn: () => base44.entities.PrecarioMinisterio.filter({ comuna: form.comuna, activo: true }, 'codigo', 2000),
    enabled: !!form.comuna,
  });

  const set = useCallback((k, v) => setForm(p => ({ ...p, [k]: v })), []);
  const handleCoefChange = useCallback((key, val) => setForm(p => ({ ...p, [key]: val })), []);
  const handleRubrosChange = useCallback((rubros) => setForm(p => ({ ...p, rubros })), []);

  const handleGenerateInvoice = async () => {
    if (form.estado !== 'aprobado') { toast.warning('El presupuesto debe estar aprobado para generar factura'); return; }
    try {
      const invoice = await base44.entities.Invoice.create({
        client_name: form.cliente_nombre, project_name: form.proyecto_nombre,
        status: 'pendiente', subtotal: form.subtotal, tax_rate: 0,
        total: calcTotals(form.rubros, form.coef_pase, form.coef_oferta),
        issue_date: new Date().toISOString().split('T')[0],
        items: (form.rubros || []).flatMap(r => (r.items || []).map(i => ({
          description: `[${r.nombre}] ${i.descripcion}`, quantity: i.cantidad,
          unit_price: i.precio_unitario, total: i.total,
        }))),
        notes: `Generada desde presupuesto ${form.codigo}`,
      });
      onSave({ ...form, estado: 'facturado', factura_id: invoice.id });
      toast.success('Factura generada');
    } catch { toast.error('Error al generar la factura'); }
  };

  const totalRubros = calcTotals(form.rubros, form.coef_pase ?? 1.6504, form.coef_oferta ?? 1.38);
  const isNew = !presupuesto;

  if (view === 'plan') return <PlanTrabajos form={form} onBack={() => setView('editor')} />;
  if (view === 'paporc') return (
    <div className="flex flex-col min-h-full">
      {/* Top bar igual al editor */}
      <div className="sticky top-0 z-20 -mx-6 px-6 py-0 mb-6"
        style={{ background: RED_DARK, borderBottom: `2px solid ${RED_MAIN}` }}>
        <div className="flex items-center gap-3 flex-wrap h-12">
          <button onClick={() => setView('editor')} className="flex items-center gap-1.5 text-sm text-white/80 hover:opacity-80">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5 text-sm min-w-0">
            <span className="cursor-pointer text-xs text-white/80 hover:opacity-80" onClick={onCancel}>Presupuestos</span>
            <ChevronRight className="h-3 w-3 text-white/50" />
            <span className="text-xs text-white/80 cursor-pointer hover:opacity-80" onClick={() => setView('editor')}>{form.titulo || form.codigo}</span>
            <ChevronRight className="h-3 w-3 text-white/50" />
            <span className="font-bold text-sm text-white">PAPORC / PAMON</span>
          </div>
          <div className="ml-auto">
            <button onClick={() => onSave(form)} disabled={saving || !form.titulo}
              className="flex items-center gap-1.5 px-4 h-7 text-xs font-bold rounded transition-all disabled:opacity-50"
              style={{ background: YELLOW_ACC, color: RED_DARK }}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Guardar
            </button>
          </div>
        </div>
      </div>
      <PAPORCGrid
        rubros={form.rubros || []}
        onChange={handleRubrosChange}
        coefPase={form.coef_pase}
        coefOferta={form.coef_oferta}
      />
    </div>
  );

  return (
    <div className="flex flex-col min-h-full">

      {/* ── Top bar — réplica del header rojo del Excel ────────────────────── */}
      <div className="sticky top-0 z-20 -mx-6 px-6 py-0 mb-6"
        style={{ background: RED_DARK, borderBottom: `2px solid ${RED_MAIN}` }}>
        <div className="flex items-center gap-3 flex-wrap h-12">
          {/* Breadcrumb */}
          <button onClick={onCancel} className="flex items-center gap-1.5 text-sm transition-colors hover:opacity-80 text-white/80"
            onClick={onCancel}>
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5 text-sm min-w-0">
            <span className="cursor-pointer text-xs hover:opacity-80 transition-opacity text-white/80" onClick={onCancel}>
              Presupuestos
            </span>
            <ChevronRight className="h-3 w-3 text-white/50" />
            <span className="font-bold truncate max-w-[220px] text-sm text-white">
              {isNew ? 'Nuevo Presupuesto' : (presupuesto.titulo || presupuesto.codigo)}
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <Select value={form.estado} onValueChange={v => set('estado', v)}>
              <SelectTrigger className="w-28 h-7 text-xs border-0 bg-white/10 text-white hover:bg-white/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ESTADO).map(([v, { label }]) => (
                  <SelectItem key={v} value={v} className="text-xs">{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <button onClick={() => setView('paporc')}
              className="flex items-center gap-1.5 px-3 h-7 text-xs font-semibold rounded transition-all hover:bg-white/20 text-white/90"
              style={{ border: `1px solid rgba(255,255,255,0.3)` }}>
              <Layers className="h-3.5 w-3.5" /> PAPORC / PAMON
            </button>
            <button onClick={() => setView('plan')}
              className="flex items-center gap-1.5 px-3 h-7 text-xs font-semibold rounded transition-all hover:bg-white/20 text-white/90"
              style={{ border: `1px solid rgba(255,255,255,0.3)` }}>
              <BarChart2 className="h-3.5 w-3.5" /> Plan de Trabajos
            </button>

            <button onClick={() => generatePresupuestoPDF(form)}
              className="hidden sm:flex items-center gap-1.5 px-3 h-7 text-xs font-semibold rounded transition-all hover:bg-white/20 text-white/90"
              style={{ border: `1px solid rgba(255,255,255,0.3)` }}>
              <FileText className="h-3.5 w-3.5" /> PDF
            </button>
            <button onClick={() => exportPresupuestoExcel(form)}
              className="hidden sm:flex items-center gap-1.5 px-3 h-7 text-xs font-semibold rounded transition-all hover:bg-white/20 text-white/90"
              style={{ border: `1px solid rgba(255,255,255,0.3)` }}>
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </button>

            {form.estado === 'aprobado' && !form.factura_id && (
              <button onClick={handleGenerateInvoice}
                className="flex items-center gap-1.5 px-3 h-7 text-xs font-semibold rounded transition-all"
                style={{ background: '#22c55e', color: 'white' }}>
                <FileCheck className="h-3.5 w-3.5" /> Factura
              </button>
            )}

            <button onClick={() => onSave(form)} disabled={saving || !form.titulo}
              className="flex items-center gap-1.5 px-4 h-7 text-xs font-bold rounded transition-all disabled:opacity-50"
              style={{ background: YELLOW_ACC, color: RED_DARK }}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Guardar
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex gap-6 items-start">

        {/* ── LEFT ── */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* CABECERA — estructura idéntica al Excel */}
          <div className="rounded-xl overflow-hidden shadow-sm" style={{ border: `1px solid ${RED_DARK}` }}>
            <SectionHeader>Cabecera del Presupuesto</SectionHeader>

            {/* Bloque datos — fondo rojo muy claro */}
            <div className="p-4 space-y-3" style={{ background: '#FEF2F2' }}>

              {/* Fila 1: Comitente */}
              <div>
                <MetaLabel>Comitente</MetaLabel>
                <MetaInput value={form.cliente_nombre || ''} onChange={e => set('cliente_nombre', e.target.value)} />
              </div>

              {/* Fila 2: Licitación + Nº Presupuesto */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <MetaLabel>Licitación</MetaLabel>
                  <MetaInput value={form.licitacion || ''} onChange={e => set('licitacion', e.target.value)} placeholder="LICIT. PÚBLICA Nº..." />
                </div>
                <div>
                  <MetaLabel>Nº Presupuesto</MetaLabel>
                  <MetaInput value={form.codigo || ''} onChange={e => set('codigo', e.target.value)} className="font-mono" />
                </div>
              </div>

              {/* Fila 3: Empresa + Zona */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <MetaLabel>Empresa</MetaLabel>
                  <MetaInput value="MEJORES HOSPITALES S.A." readOnly />
                </div>
                <div>
                  <MetaLabel>Zona / Comuna</MetaLabel>
                  <Select value={form.comuna || '8A'} onValueChange={v => set('comuna', v)}>
                    <SelectTrigger className="h-8 text-sm" style={{ borderColor: '#E5E7EB', color: RED_DARK }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="8A">8A</SelectItem>
                      <SelectItem value="8B">8B</SelectItem>
                      <SelectItem value="10A">10A</SelectItem>
                      <SelectItem value="otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Fila 4: Dirección + Escuela */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <MetaLabel>Dirección de Obra</MetaLabel>
                  <MetaInput value={form.direccion_obra || ''} onChange={e => set('direccion_obra', e.target.value)} />
                </div>
                <div>
                  <MetaLabel>Escuela / Proyecto</MetaLabel>
                  <MetaInput value={form.proyecto_nombre || ''} onChange={e => set('proyecto_nombre', e.target.value)} />
                </div>
              </div>

              {/* Fila 5: Obra (título) */}
              <div>
                <MetaLabel>Obra *</MetaLabel>
                <MetaInput value={form.titulo || ''} onChange={e => set('titulo', e.target.value)}
                  placeholder="Descripción de la obra..."
                  className={`font-semibold ${!form.titulo ? 'border-red-400' : ''}`} />
                {!form.titulo && <p className="text-[11px] mt-0.5" style={{ color: '#ef4444' }}>Campo requerido</p>}
              </div>

              {/* Fila 6: MTOM + Supervisor + Inspector */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <MetaLabel>MTOM Nº</MetaLabel>
                  <MetaInput value={form.mtom || ''} onChange={e => set('mtom', e.target.value)} />
                </div>
                <div>
                  <MetaLabel>Supervisor</MetaLabel>
                  <MetaInput value={form.responsable || ''} onChange={e => set('responsable', e.target.value)} />
                </div>
                <div>
                  <MetaLabel>Inspector</MetaLabel>
                  <MetaInput value={form.inspector || ''} onChange={e => set('inspector', e.target.value)} />
                </div>
              </div>

              {/* Separador */}
              <div className="border-t" style={{ borderColor: '#E5E7EB' }} />

              {/* Fila 7: Fechas + Coefs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <MetaLabel>Fecha Ingreso SAP</MetaLabel>
                  <MetaInput type="date" value={form.fecha_emision || ''} onChange={e => set('fecha_emision', e.target.value)} />
                </div>
                <div>
                  <MetaLabel>Plazo (días)</MetaLabel>
                  <MetaInput type="number" value={form.plazo || ''} onChange={e => set('plazo', e.target.value)} placeholder="60" />
                </div>
                <div>
                  <MetaLabel>Preciario Utilizado</MetaLabel>
                  <MetaInput type="date" value={form.preciario_fecha || ''} onChange={e => set('preciario_fecha', e.target.value)} />
                </div>
                <div>
                  <MetaLabel>Coef. Pase</MetaLabel>
                  <MetaInput type="number" step="0.0001" value={form.coef_pase ?? ''}
                    onChange={e => handleCoefChange('coef_pase', parseFloat(e.target.value) || 1.6504)} />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <MetaLabel>Coef. Oferta</MetaLabel>
                  <MetaInput type="number" step="0.01" value={form.coef_oferta ?? ''}
                    onChange={e => handleCoefChange('coef_oferta', parseFloat(e.target.value) || 1.38)} />
                </div>
              </div>

              {/* Preciario status */}
              {precario.length > 0 ? (
                <div className="flex items-center gap-2 text-xs rounded px-3 py-2" style={{ background: '#E2EFDA', border: `1px solid #A9D18E`, color: RED_DARK }}>
                  <Sparkles className="h-3.5 w-3.5 shrink-0" style={{ color: '#375623' }} />
                  <span><strong>{precario.length} ítems</strong> disponibles del Preciario Ministerial — Comuna {form.comuna}</span>
                </div>
              ) : form.comuna !== 'otro' ? (
                <div className="flex items-center gap-2 text-xs rounded px-3 py-2 bg-amber-50 border border-amber-200 text-amber-700">
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  <span>No hay preciario para Comuna {form.comuna}. Importalo en la pestaña "Preciario Ministerio".</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* GRILLA PCP */}
          <div className="rounded-xl overflow-hidden shadow-sm" style={{ border: `1px solid ${RED_DARK}` }}>
            {/* Header — réplica del encabezado de tabla Excel */}
            <div className="px-4 py-2.5 flex items-center justify-between"
              style={{ background: RED_DARK, borderBottom: `1px solid ${RED_MAIN}` }}>
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-white" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-white">
                  Planilla de Cómputo y Presupuesto (PCP)
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono text-white/80">
                  × {form.coef_pase ?? 1.6504} × {form.coef_oferta ?? 1.38}
                </span>
                <span className="ml-3 text-sm font-bold tabular-nums text-yellow-300">{fmt(totalRubros)}</span>
              </div>
            </div>
            <div className="p-4" style={{ background: '#FFFBF7' }}>
              <PCPGrid
                rubros={form.rubros || []}
                onChange={handleRubrosChange}
                precario={precario}
                coefPase={form.coef_pase}
                coefOferta={form.coef_oferta}
              />
            </div>
          </div>

          {/* NOTAS */}
          <div className="rounded-xl overflow-hidden shadow-sm" style={{ border: `1px solid ${RED_DARK}` }}>
            <SectionHeader>Notas y Condiciones</SectionHeader>
            <div className="p-4" style={{ background: '#FEF2F2' }}>
              <Textarea rows={3} value={form.notas || ''} onChange={e => set('notas', e.target.value)}
                placeholder="Condiciones de pago, alcance del trabajo, exclusiones..."
                className="text-sm resize-none" style={{ borderColor: '#E5E7EB' }} />
            </div>
          </div>

          {/* Bottom save */}
          <div className="flex justify-end gap-2 pt-2 pb-8">
            <button onClick={onCancel}
              className="px-4 h-9 text-sm rounded border font-medium transition-all hover:opacity-80"
              style={{ borderColor: '#E5E7EB', color: RED_DARK }}>
              Cancelar
            </button>
            <button onClick={() => onSave(form)} disabled={saving || !form.titulo}
              className="flex items-center gap-2 px-6 h-9 text-sm font-bold rounded transition-all disabled:opacity-50"
              style={{ background: RED_DARK, color: YELLOW_ACC }}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar Presupuesto
            </button>
          </div>
        </div>

        {/* ── RIGHT sidebar ── */}
        <div className="w-64 shrink-0 hidden lg:block sticky top-14">
          <ResumenPanel form={form} onCoefChange={handleCoefChange} />
        </div>
      </div>
    </div>
  );
}