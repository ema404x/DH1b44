import React, { useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, Plus, FileCheck, Loader2, Save, FileSpreadsheet,
  FileText, ChevronRight, Sparkles, Info, Calculator, Layers,
  Building, MapPin, ClipboardList, StickyNote, Hash
} from 'lucide-react';
import RubroSection from '@/components/presupuestos/RubroSection';
import { generatePresupuestoPDF } from '@/components/presupuestos/presupuestoPDF';
import { exportPresupuestoExcel } from '@/utils/exportExcel';
import { toast } from 'sonner';

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

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ icon: Icon, title, children }) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{title}</h3>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );
}

// ── Field with label ─────────────────────────────────────────────────────────
function F({ label, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground font-medium">{label}</Label>
      {children}
    </div>
  );
}

// ── Resumen Panel ─────────────────────────────────────────────────────────────
function ResumenPanel({ form, onPctChange, onCoefChange }) {
  const cp = form.coef_pase   ?? 1.6504;
  const co = form.coef_oferta ?? 1.38;
  const subtotal = calcTotals(form.rubros, cp, co);
  const gg   = subtotal * ((form.gastos_generales_pct || 0) / 100);
  const ben  = (subtotal + gg) * ((form.beneficio_pct || 0) / 100);
  const base = subtotal + gg + ben;
  const iva  = base * ((form.iva_pct || 0) / 100);
  const total = base + iva;
  const totalItems = (form.rubros || []).reduce((a, r) => a + (r.items || []).length, 0);

  return (
    <div className="rounded-xl border bg-card shadow overflow-hidden">
      {/* Dark header */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white px-4 py-4">
        <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-1">Total Oferta</p>
        <p className="text-3xl font-bold tabular-nums leading-none">{fmt(total)}</p>
        <div className="flex gap-3 mt-2">
          <span className="text-[11px] text-white/40">{(form.rubros || []).length} rubros</span>
          <span className="text-[11px] text-white/40">{totalItems} ítems</span>
        </div>
      </div>

      {/* Coeficientes PCP */}
      <div className="p-3 border-b bg-blue-50/40">
        <p className="text-[10px] font-semibold text-blue-700 uppercase tracking-widest mb-2">Coeficientes PCP</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Coef. Pase', key: 'coef_pase', step: '0.0001' },
            { label: 'Coef. Oferta', key: 'coef_oferta', step: '0.01' },
          ].map(({ label, key, step }) => (
            <div key={key} className="space-y-1">
              <label className="text-[10px] text-muted-foreground font-medium">{label}</label>
              <Input
                type="number" step={step}
                value={form[key] ?? ''}
                onChange={e => onCoefChange(key, parseFloat(e.target.value) || 0)}
                className="h-7 text-xs text-center font-mono px-1"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Parámetros % */}
      <div className="p-3 border-b">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Parámetros</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'G.G. %', key: 'gastos_generales_pct' },
            { label: 'Beneficio %', key: 'beneficio_pct' },
            { label: 'IVA %', key: 'iva_pct' },
          ].map(({ label, key }) => (
            <div key={key} className="space-y-1">
              <label className="text-[10px] text-muted-foreground font-medium">{label}</label>
              <Input
                type="number"
                value={form[key] ?? 0}
                onChange={e => onPctChange(key, parseFloat(e.target.value) || 0)}
                className="h-7 text-xs text-center px-1"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Desglose por rubros */}
      {(form.rubros || []).length > 0 && (
        <div className="p-3 border-b space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Por Rubro</p>
          {(form.rubros || []).map((r, i) => {
            const sub = calcTotals([r], cp, co);
            const pct = subtotal > 0 ? (sub / subtotal) * 100 : 0;
            return (
              <div key={i} className="space-y-1">
                <div className="flex justify-between items-baseline gap-1">
                  <span className="text-[11px] text-muted-foreground truncate flex-1 leading-none">{r.nombre || `Rubro ${i + 1}`}</span>
                  <span className="text-[11px] font-semibold tabular-nums whitespace-nowrap">{fmt(sub)}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary/50 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Totales desglosados */}
      <div className="p-3 space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Subtotal obra</span>
          <span className="tabular-nums font-medium">{fmt(subtotal)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">G. Generales ({form.gastos_generales_pct || 0}%)</span>
          <span className="tabular-nums">{fmt(gg)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Beneficio ({form.beneficio_pct || 0}%)</span>
          <span className="tabular-nums">{fmt(ben)}</span>
        </div>
        <Separator className="my-1" />
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Base imponible</span>
          <span className="tabular-nums font-semibold">{fmt(base)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">IVA ({form.iva_pct || 0}%)</span>
          <span className="tabular-nums">{fmt(iva)}</span>
        </div>
        <Separator className="my-1" />
        <div className="flex justify-between items-center rounded-lg bg-primary/5 px-3 py-2.5">
          <span className="font-bold text-sm">TOTAL</span>
          <span className="font-bold text-base text-primary tabular-nums">{fmt(total)}</span>
        </div>
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function PresupuestoEditor({ presupuesto, onSave, onCancel, saving }) {
  const [form, setForm] = useState(() => presupuesto ? { ...presupuesto } : {
    codigo: generateCode(),
    titulo: '',
    cliente_nombre: 'GCBA - MINISTERIO DE EDUCACIÓN DE LA CIUDAD DE BUENOS AIRES - DGMESC',
    proyecto_nombre: '',
    direccion_obra: '',
    responsable: '',
    inspector: '',
    licitacion: 'LICIT. PÚBLICA Nº 558-0158-LPU22',
    comuna: '8A',
    coef_pase: 1.6504,
    coef_oferta: 1.38,
    preciario_fecha: '',
    plazo: '',
    estado: 'borrador',
    fecha_emision: new Date().toISOString().split('T')[0],
    fecha_validez: '',
    rubros: [{ nombre: 'Rubro 1', items: [] }],
    subtotal: 0,
    gastos_generales_pct: 0,
    beneficio_pct: 0,
    iva_pct: 0,
    total: 0,
    notas: '',
  });

  const { data: precario = [] } = useQuery({
    queryKey: ['precario', form.comuna],
    queryFn: () => base44.entities.PrecarioMinisterio.filter({ comuna: form.comuna, activo: true }, 'codigo', 2000),
    enabled: !!form.comuna,
  });

  const set = useCallback((k, v) => setForm(p => ({ ...p, [k]: v })), []);

  const updateRubros = useCallback((rubros) => {
    setForm(p => {
      const cp = p.coef_pase ?? 1.6504;
      const co = p.coef_oferta ?? 1.38;
      const subtotal = calcTotals(rubros, cp, co);
      return { ...p, rubros, subtotal, total: subtotal };
    });
  }, []);

  const handleCoefChange = (key, val) => {
    setForm(p => {
      const updated = { ...p, [key]: val };
      const subtotal = calcTotals(updated.rubros || [], updated.coef_pase ?? 1.6504, updated.coef_oferta ?? 1.38);
      return { ...updated, subtotal, total: subtotal };
    });
  };

  const handleAddRubro = () => {
    updateRubros([...(form.rubros || []), { nombre: `Rubro ${(form.rubros || []).length + 1}`, items: [] }]);
  };

  const handleGenerateInvoice = async () => {
    if (form.estado !== 'aprobado') { toast.warning('El presupuesto debe estar aprobado para generar factura'); return; }
    try {
      const invoice = await base44.entities.Invoice.create({
        client_name: form.cliente_nombre,
        project_name: form.proyecto_nombre,
        status: 'pendiente',
        subtotal: form.subtotal,
        tax_rate: form.iva_pct,
        total: form.total,
        issue_date: new Date().toISOString().split('T')[0],
        items: (form.rubros || []).flatMap(r =>
          (r.items || []).map(i => ({
            description: `[${r.nombre}] ${i.descripcion}`,
            quantity: i.cantidad,
            unit_price: i.precio_unitario,
            total: i.total,
          }))
        ),
        notes: `Generada desde presupuesto ${form.codigo}`,
      });
      onSave({ ...form, estado: 'facturado', factura_id: invoice.id });
      toast.success('Factura generada');
    } catch { toast.error('Error al generar la factura'); }
  };

  const estado = ESTADO[form.estado] || ESTADO.borrador;
  const isNew = !presupuesto;

  return (
    <div className="flex flex-col min-h-full">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b -mx-6 px-6 py-3 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="icon" onClick={onCancel} className="h-8 w-8 shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1.5 text-sm min-w-0">
            <span className="text-muted-foreground hover:text-foreground cursor-pointer" onClick={onCancel}>Presupuestos</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-semibold truncate max-w-[220px]">
              {isNew ? 'Nuevo Presupuesto' : (presupuesto.titulo || presupuesto.codigo || 'Editar')}
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {/* Estado pill */}
            <Badge variant="outline" className={`text-xs ${estado.cls} hidden sm:flex`}>{estado.label}</Badge>

            {/* Estado selector */}
            <Select value={form.estado} onValueChange={v => set('estado', v)}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ESTADO).map(([v, { label }]) => (
                  <SelectItem key={v} value={v} className="text-xs">{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Exports */}
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 hidden sm:flex" onClick={() => generatePresupuestoPDF(form)}>
              <FileText className="h-3.5 w-3.5" /> PDF
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 text-blue-700 border-blue-200 hover:bg-blue-50 hidden sm:flex" onClick={() => exportPresupuestoExcel(form)}>
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </Button>
            {form.estado === 'aprobado' && !form.factura_id && (
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50" onClick={handleGenerateInvoice}>
                <FileCheck className="h-3.5 w-3.5" /> Factura
              </Button>
            )}
            <Button size="sm" className="h-8 gap-1.5 font-semibold" onClick={() => onSave(form)} disabled={saving || !form.titulo}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Guardar
            </Button>
          </div>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-6 items-start">

        {/* ── LEFT column ── */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* Datos generales */}
          <Section icon={ClipboardList} title="Datos del Proyecto">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <F label="Código">
                <Input value={form.codigo || ''} onChange={e => set('codigo', e.target.value)} className="h-8 text-sm font-mono" />
              </F>
              <F label="Fecha Emisión">
                <Input type="date" value={form.fecha_emision || ''} onChange={e => set('fecha_emision', e.target.value)} className="h-8 text-sm" />
              </F>
              <F label="Plazo de Obra">
                <Input value={form.plazo || ''} onChange={e => set('plazo', e.target.value)} placeholder="Ej: 180 días" className="h-8 text-sm" />
              </F>
            </div>
            <F label="Título *">
              <Input
                value={form.titulo || ''}
                onChange={e => set('titulo', e.target.value)}
                placeholder="Ej: Refacción Escuela N°15 — Aulas y sanitarios"
                className={`h-9 text-sm font-medium ${!form.titulo ? 'border-amber-300 focus-visible:ring-amber-300' : ''}`}
              />
              {!form.titulo && <p className="text-[11px] text-amber-600">Campo requerido para guardar</p>}
            </F>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <F label="Comitente / Cliente">
                <Input value={form.cliente_nombre || ''} onChange={e => set('cliente_nombre', e.target.value)} className="h-8 text-sm" />
              </F>
              <F label="N° Licitación">
                <Input value={form.licitacion || ''} onChange={e => set('licitacion', e.target.value)} placeholder="LICIT. PÚBLICA Nº..." className="h-8 text-sm" />
              </F>
              <F label="Escuela / Proyecto">
                <Input value={form.proyecto_nombre || ''} onChange={e => set('proyecto_nombre', e.target.value)} className="h-8 text-sm" />
              </F>
              <F label="Dirección de Obra">
                <Input value={form.direccion_obra || ''} onChange={e => set('direccion_obra', e.target.value)} className="h-8 text-sm" />
              </F>
              <F label="Supervisor / Responsable">
                <Input value={form.responsable || ''} onChange={e => set('responsable', e.target.value)} className="h-8 text-sm" />
              </F>
              <F label="Inspector">
                <Input value={form.inspector || ''} onChange={e => set('inspector', e.target.value)} className="h-8 text-sm" />
              </F>
            </div>
          </Section>

          {/* Preciario */}
          <Section icon={Calculator} title="Preciario Ministerial y Coeficientes">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <F label="Comuna">
                <Select value={form.comuna || '8A'} onValueChange={v => set('comuna', v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="8A">8A</SelectItem>
                    <SelectItem value="8B">8B</SelectItem>
                    <SelectItem value="10A">10A</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </F>
              <F label="Coef. Pase">
                <Input type="number" step="0.0001" value={form.coef_pase ?? ''} onChange={e => handleCoefChange('coef_pase', parseFloat(e.target.value) || 1.6504)} className="h-8 text-sm font-mono" />
              </F>
              <F label="Coef. Oferta">
                <Input type="number" step="0.01" value={form.coef_oferta ?? ''} onChange={e => handleCoefChange('coef_oferta', parseFloat(e.target.value) || 1.38)} className="h-8 text-sm font-mono" />
              </F>
              <F label="Fecha Preciario">
                <Input type="date" value={form.preciario_fecha || ''} onChange={e => set('preciario_fecha', e.target.value)} className="h-8 text-sm" />
              </F>
            </div>
            {precario.length > 0 ? (
              <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                <span><strong>{precario.length} ítems</strong> disponibles del Preciario Ministerial — Comuna {form.comuna}</span>
              </div>
            ) : form.comuna !== 'otro' ? (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <Info className="h-3.5 w-3.5 shrink-0" />
                <span>No hay preciario para Comuna {form.comuna}. Importalo en la pestaña "Preciario Ministerio".</span>
              </div>
            ) : null}
          </Section>

          {/* Rubros */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-sm flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-muted-foreground" /> Rubros e Ítems
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Precio resultante = PU × {form.coef_pase ?? 1.6504} (pase) × {form.coef_oferta ?? 1.38} (oferta)
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={handleAddRubro} className="h-8 gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" /> Agregar Rubro
              </Button>
            </div>

            {(form.rubros || []).length === 0 ? (
              <button
                onClick={handleAddRubro}
                className="w-full border-2 border-dashed border-border rounded-xl py-12 text-muted-foreground hover:border-primary/40 hover:bg-primary/[0.02] hover:text-primary transition-all flex flex-col items-center gap-2"
              >
                <Layers className="h-7 w-7 opacity-40" />
                <span className="text-sm font-medium">Agregar primer rubro</span>
                <span className="text-xs opacity-60">Podés agregar ítems del preciario o manualmente</span>
              </button>
            ) : (
              <div className="space-y-3">
                {(form.rubros || []).map((rubro, idx) => (
                  <RubroSection
                    key={idx}
                    rubro={rubro}
                    idx={idx}
                    precario={precario}
                    coefPase={form.coef_pase}
                    coefOferta={form.coef_oferta}
                    onChange={(r) => {
                      const rubros = [...(form.rubros || [])];
                      rubros[idx] = r;
                      updateRubros(rubros);
                    }}
                    onDelete={() => updateRubros((form.rubros || []).filter((_, i) => i !== idx))}
                  />
                ))}
                <button
                  onClick={handleAddRubro}
                  className="w-full border border-dashed border-border rounded-xl py-3 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="h-3.5 w-3.5" /> Agregar otro rubro
                </button>
              </div>
            )}
          </div>

          {/* Notas */}
          <Section icon={StickyNote} title="Notas y Condiciones">
            <Textarea
              rows={3}
              value={form.notas || ''}
              onChange={e => set('notas', e.target.value)}
              placeholder="Condiciones de pago, alcance del trabajo, exclusiones..."
              className="text-sm resize-none"
            />
          </Section>

          {/* Bottom save */}
          <div className="flex justify-end gap-2 pt-2 pb-6">
            <Button variant="outline" onClick={onCancel}>Cancelar</Button>
            <Button onClick={() => onSave(form)} disabled={saving || !form.titulo} className="gap-2 px-6">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar Presupuesto
            </Button>
          </div>
        </div>

        {/* ── RIGHT: sticky sidebar ── */}
        <div className="w-64 shrink-0 hidden lg:block sticky top-20">
          <ResumenPanel
            form={form}
            onPctChange={(k, v) => set(k, v)}
            onCoefChange={handleCoefChange}
          />
        </div>
      </div>

      {/* Mobile resumen */}
      <div className="lg:hidden">
        <ResumenPanel
          form={form}
          onPctChange={(k, v) => set(k, v)}
          onCoefChange={handleCoefChange}
        />
      </div>
    </div>
  );
}