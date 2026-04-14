import React, { useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, Save, Loader2, FileSpreadsheet, FileText,
  ChevronRight, BarChart2, Download, Layers, FileCheck,
  Sparkles, Info
} from 'lucide-react';
import PCPGrid from '@/components/presupuestos/PCPGrid';
import PlanTrabajos from '@/components/presupuestos/PlanTrabajos';
import { generatePresupuestoPDF } from '@/components/presupuestos/presupuestoPDF';
import { exportPresupuestoExcel } from '@/utils/exportExcel';
import { toast } from 'sonner';

const ESTADO = {
  borrador:  { label: 'Borrador',  cls: 'bg-gray-100 text-gray-700 border-gray-300' },
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

function Field({ label, children, className = '' }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{label}</Label>
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div className="flex items-center gap-2 pb-2 border-b border-gray-200 mb-3">
      <div className="w-1 h-4 bg-red-600 rounded-full" />
      <h3 className="text-xs font-bold text-gray-700 uppercase tracking-widest">{children}</h3>
    </div>
  );
}

// ── Summary Sidebar ────────────────────────────────────────────────────────
function ResumenPanel({ form, onCoefChange }) {
  const cp = form.coef_pase   ?? 1.6504;
  const co = form.coef_oferta ?? 1.38;
  const subtotal = calcTotals(form.rubros, cp, co);
  const totalItems = (form.rubros || []).reduce((a, r) => a + (r.items || []).length, 0);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Dark header */}
      <div className="bg-gray-900 text-white px-4 py-4">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Presupuesto</p>
        <p className="text-2xl font-bold tabular-nums">{fmt(subtotal)}</p>
        <div className="flex gap-3 mt-1.5">
          <span className="text-[11px] text-gray-500">{(form.rubros || []).length} rubros</span>
          <span className="text-[11px] text-gray-500">{totalItems} ítems</span>
        </div>
      </div>

      {/* Coefs */}
      <div className="p-3 border-b border-gray-100">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Coeficientes PCP</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Coef. Pase', key: 'coef_pase', step: '0.0001' },
            { label: 'Coef. Oferta', key: 'coef_oferta', step: '0.01' },
          ].map(({ label, key, step }) => (
            <div key={key} className="space-y-1">
              <label className="text-[10px] text-gray-400 font-medium">{label}</label>
              <Input type="number" step={step}
                value={form[key] ?? ''}
                onChange={e => onCoefChange(key, parseFloat(e.target.value) || 0)}
                className="h-7 text-xs text-center font-mono px-1 border-gray-200" />
            </div>
          ))}
        </div>
      </div>

      {/* Por rubro */}
      {(form.rubros || []).length > 0 && (
        <div className="p-3 space-y-2 border-b border-gray-100">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Por Rubro</p>
          {(form.rubros || []).map((r, i) => {
            const sub = calcTotals([r], cp, co);
            const pct = subtotal > 0 ? (sub / subtotal) * 100 : 0;
            return (
              <div key={i} className="space-y-1">
                <div className="flex justify-between items-baseline gap-1">
                  <span className="text-[11px] text-gray-600 truncate flex-1">{r.nombre || `Rubro ${i + 1}`}</span>
                  <span className="text-[11px] font-bold tabular-nums text-gray-800">{fmt(sub)}</span>
                </div>
                <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Total */}
      <div className="p-3">
        <div className="flex justify-between items-center rounded-lg bg-red-600 px-3 py-2.5">
          <span className="font-bold text-xs text-red-100 uppercase tracking-wide">TOTAL</span>
          <span className="font-bold text-sm text-white tabular-nums">{fmt(subtotal)}</span>
        </div>
      </div>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────
export default function PresupuestoEditor({ presupuesto, onSave, onCancel, saving }) {
  const [view, setView] = useState('editor'); // 'editor' | 'plan'
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

  const handleCoefChange = useCallback((key, val) => {
    setForm(p => ({ ...p, [key]: val }));
  }, []);

  const handleRubrosChange = useCallback((rubros) => {
    setForm(p => ({ ...p, rubros }));
  }, []);

  const handleGenerateInvoice = async () => {
    if (form.estado !== 'aprobado') { toast.warning('El presupuesto debe estar aprobado para generar factura'); return; }
    try {
      const invoice = await base44.entities.Invoice.create({
        client_name: form.cliente_nombre, project_name: form.proyecto_nombre,
        status: 'pendiente', subtotal: form.subtotal, tax_rate: 0, total: calcTotals(form.rubros, form.coef_pase, form.coef_oferta),
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

  // ── Plan de Trabajos view ───────────────────────────────────────────────
  if (view === 'plan') {
    return <PlanTrabajos form={form} onBack={() => setView('editor')} />;
  }

  return (
    <div className="flex flex-col min-h-full">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-200 -mx-6 px-6 py-3 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={onCancel} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5 text-sm min-w-0">
            <span className="text-gray-400 hover:text-gray-700 cursor-pointer text-xs" onClick={onCancel}>Presupuestos</span>
            <ChevronRight className="h-3 w-3 text-gray-300" />
            <span className="font-semibold text-gray-900 truncate max-w-[200px] text-sm">
              {isNew ? 'Nuevo Presupuesto' : (presupuesto.titulo || presupuesto.codigo)}
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {/* Estado */}
            <Select value={form.estado} onValueChange={v => set('estado', v)}>
              <SelectTrigger className="w-28 h-8 text-xs border-gray-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ESTADO).map(([v, { label }]) => (
                  <SelectItem key={v} value={v} className="text-xs">{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Plan de Trabajos */}
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-gray-300 hover:border-red-400 hover:text-red-700"
              onClick={() => setView('plan')}>
              <BarChart2 className="h-3.5 w-3.5" /> Plan de Trabajos
            </Button>

            {/* Exports */}
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-gray-300 hidden sm:flex"
              onClick={() => generatePresupuestoPDF(form)}>
              <FileText className="h-3.5 w-3.5" /> PDF
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-gray-300 hidden sm:flex"
              onClick={() => exportPresupuestoExcel(form)}>
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </Button>

            {form.estado === 'aprobado' && !form.factura_id && (
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                onClick={handleGenerateInvoice}>
                <FileCheck className="h-3.5 w-3.5" /> Factura
              </Button>
            )}

            <Button size="sm" className="h-8 gap-1.5 font-semibold bg-red-600 hover:bg-red-700 text-white"
              onClick={() => onSave(form)} disabled={saving || !form.titulo}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Guardar
            </Button>
          </div>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="flex gap-6 items-start">

        {/* ── LEFT ── */}
        <div className="flex-1 min-w-0 space-y-6">

          {/* CABECERA */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
            <SectionTitle>Cabecera del Presupuesto</SectionTitle>

            {/* Row 1: Comitente */}
            <Field label="Comitente">
              <Input value={form.cliente_nombre || ''} onChange={e => set('cliente_nombre', e.target.value)}
                className="h-8 text-sm border-gray-200" />
            </Field>

            {/* Row 2: Licitación + Nº Presupuesto */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Licitación">
                <Input value={form.licitacion || ''} onChange={e => set('licitacion', e.target.value)}
                  placeholder="LICIT. PÚBLICA Nº..." className="h-8 text-sm border-gray-200" />
              </Field>
              <Field label="Nº Presupuesto">
                <Input value={form.codigo || ''} onChange={e => set('codigo', e.target.value)}
                  className="h-8 text-sm font-mono border-gray-200" />
              </Field>
            </div>

            {/* Row 3: Empresa (readonly) + Zona */}
            <div className="grid grid-cols-3 gap-3">
              <Field label="Empresa" className="col-span-2">
                <Input value="MEJORES HOSPITALES S.A." readOnly className="h-8 text-sm border-gray-200 bg-gray-50 text-gray-500" />
              </Field>
              <Field label="Zona / Comuna">
                <Select value={form.comuna || '8A'} onValueChange={v => set('comuna', v)}>
                  <SelectTrigger className="h-8 text-sm border-gray-200"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="8A">8A</SelectItem>
                    <SelectItem value="8B">8B</SelectItem>
                    <SelectItem value="10A">10A</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {/* Row 4: Dirección + Escuela */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Dirección de Obra">
                <Input value={form.direccion_obra || ''} onChange={e => set('direccion_obra', e.target.value)}
                  className="h-8 text-sm border-gray-200" />
              </Field>
              <Field label="Escuela / Proyecto">
                <Input value={form.proyecto_nombre || ''} onChange={e => set('proyecto_nombre', e.target.value)}
                  className="h-8 text-sm border-gray-200" />
              </Field>
            </div>

            {/* Row 5: Obra (título) */}
            <Field label="Obra *">
              <Input value={form.titulo || ''} onChange={e => set('titulo', e.target.value)}
                placeholder="Descripción de la obra..."
                className={`h-8 text-sm border-gray-200 font-medium ${!form.titulo ? 'border-red-300' : ''}`} />
              {!form.titulo && <p className="text-[11px] text-red-500">Campo requerido</p>}
            </Field>

            {/* Row 6: MTOM + Supervisor + Inspector */}
            <div className="grid grid-cols-3 gap-3">
              <Field label="MTOM Nº">
                <Input value={form.mtom || ''} onChange={e => set('mtom', e.target.value)}
                  className="h-8 text-sm border-gray-200" />
              </Field>
              <Field label="Supervisor">
                <Input value={form.responsable || ''} onChange={e => set('responsable', e.target.value)}
                  className="h-8 text-sm border-gray-200" />
              </Field>
              <Field label="Inspector">
                <Input value={form.inspector || ''} onChange={e => set('inspector', e.target.value)}
                  className="h-8 text-sm border-gray-200" />
              </Field>
            </div>

            <Separator className="my-1 bg-gray-100" />

            {/* Row 7: Fecha SAP + Plazo + Preciario + Coef */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="Fecha Ingreso SAP">
                <Input type="date" value={form.fecha_emision || ''} onChange={e => set('fecha_emision', e.target.value)}
                  className="h-8 text-sm border-gray-200" />
              </Field>
              <Field label="Plazo (días)">
                <Input type="number" value={form.plazo || ''} onChange={e => set('plazo', e.target.value)}
                  placeholder="Ej: 60" className="h-8 text-sm border-gray-200 font-mono" />
              </Field>
              <Field label="Preciario Utilizado">
                <Input type="date" value={form.preciario_fecha || ''} onChange={e => set('preciario_fecha', e.target.value)}
                  className="h-8 text-sm border-gray-200" />
              </Field>
              <Field label="Coef. Pase">
                <Input type="number" step="0.0001" value={form.coef_pase ?? ''} onChange={e => handleCoefChange('coef_pase', parseFloat(e.target.value) || 1.6504)}
                  className="h-8 text-sm font-mono border-gray-200" />
              </Field>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="Coef. Oferta">
                <Input type="number" step="0.01" value={form.coef_oferta ?? ''} onChange={e => handleCoefChange('coef_oferta', parseFloat(e.target.value) || 1.38)}
                  className="h-8 text-sm font-mono border-gray-200" />
              </Field>
            </div>

            {/* Preciario status */}
            {precario.length > 0 ? (
              <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <Sparkles className="h-3.5 w-3.5 text-red-500 shrink-0" />
                <span><strong>{precario.length} ítems</strong> disponibles del Preciario Ministerial — Comuna {form.comuna}</span>
              </div>
            ) : form.comuna !== 'otro' ? (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <Info className="h-3.5 w-3.5 shrink-0" />
                <span>No hay preciario para Comuna {form.comuna}. Importalo en la pestaña "Preciario Ministerio".</span>
              </div>
            ) : null}
          </div>

          {/* GRILLA PCP */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-red-600" />
                  Planilla de Cómputo y Presupuesto (PCP)
                </h2>
                <p className="text-[11px] text-gray-400 mt-0.5 font-mono">
                  Precio Resultante = (PU MAT + PU MO) × {form.coef_pase ?? 1.6504} × {form.coef_oferta ?? 1.38}
                </p>
              </div>
              <span className="text-lg font-bold text-red-700 tabular-nums">{fmt(totalRubros)}</span>
            </div>
            <PCPGrid
              rubros={form.rubros || []}
              onChange={handleRubrosChange}
              precario={precario}
              coefPase={form.coef_pase}
              coefOferta={form.coef_oferta}
            />
          </div>

          {/* NOTAS */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <SectionTitle>Notas y Condiciones</SectionTitle>
            <Textarea rows={3} value={form.notas || ''} onChange={e => set('notas', e.target.value)}
              placeholder="Condiciones de pago, alcance del trabajo, exclusiones..."
              className="text-sm resize-none border-gray-200 mt-1" />
          </div>

          {/* Bottom save */}
          <div className="flex justify-end gap-2 pt-2 pb-8">
            <Button variant="outline" onClick={onCancel} className="border-gray-300">Cancelar</Button>
            <Button onClick={() => onSave(form)} disabled={saving || !form.titulo}
              className="gap-2 px-6 bg-red-600 hover:bg-red-700 text-white">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar Presupuesto
            </Button>
          </div>
        </div>

        {/* ── RIGHT sidebar ── */}
        <div className="w-60 shrink-0 hidden lg:block sticky top-20">
          <ResumenPanel form={form} onCoefChange={handleCoefChange} />
        </div>
      </div>
    </div>
  );
}