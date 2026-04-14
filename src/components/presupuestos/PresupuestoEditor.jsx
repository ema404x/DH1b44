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
  ArrowLeft, Plus, Download, FileCheck, Loader2, Save,
  FileSpreadsheet, FileText, Building2, MapPin, User, Hash,
  Gavel, Calendar, Eye, ChevronRight, Sparkles, Info
} from 'lucide-react';
import RubroSection from '@/components/presupuestos/RubroSection';
import { generatePresupuestoPDF } from '@/components/presupuestos/presupuestoPDF';
import { exportPresupuestoExcel } from '@/utils/exportExcel';
import { toast } from 'sonner';

const estadoConfig = {
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
  const subtotal = rubros.reduce((acc, r) =>
    acc + (r.items || []).reduce((a, i) => {
      const pu = (Number(i.pu_mat) || 0) + (Number(i.pu_mo) || 0);
      return a + pu * cp * co * (Number(i.cantidad) || 0);
    }, 0), 0);
  return subtotal;
}

// ── Sección de metadatos ────────────────────────────────────────────────────────
function MetaSection({ title, children }) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-4 py-2.5 border-b bg-muted/30">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{title}</h3>
      </div>
      <div className="px-4 py-3 space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children, cols = 1 }) {
  return (
    <div className={cols > 1 ? `grid grid-cols-${cols} gap-3` : 'space-y-1'}>
      {label && <Label className="text-xs text-muted-foreground font-medium">{label}</Label>}
      {children}
    </div>
  );
}

// ── Panel de resumen sticky ─────────────────────────────────────────────────────
function ResumenPanel({ form, onPctChange, onCoefChange }) {
  const cp = form.coef_pase  ?? 1.6504;
  const co = form.coef_oferta ?? 1.38;
  const subtotal = calcTotals(form.rubros || [], cp, co);
  const gg  = subtotal * ((form.gastos_generales_pct || 0) / 100);
  const ben = (subtotal + gg) * ((form.beneficio_pct || 0) / 100);
  const base = subtotal + gg + ben;
  const iva  = base * ((form.iva_pct || 0) / 100);
  const total = base + iva;
  const totalItems = (form.rubros || []).reduce((a, r) => a + (r.items || []).length, 0);

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-[#0a1834] text-white px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-medium text-white/50 uppercase tracking-widest">Total Oferta</p>
          <Badge variant="outline" className="text-[10px] border-white/20 text-white/60">
            {totalItems} ítems
          </Badge>
        </div>
        <p className="text-2xl font-bold tabular-nums">{fmt(total)}</p>
        <p className="text-xs text-white/40 mt-0.5">{(form.rubros || []).length} rubros</p>
      </div>

      {/* Coeficientes */}
      <div className="p-3 border-b bg-blue-50/50 space-y-2">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Coeficientes PCP</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Coef. Pase', key: 'coef_pase', step: '0.0001' },
            { label: 'Coef. Oferta', key: 'coef_oferta', step: '0.01' },
          ].map(({ label, key, step }) => (
            <div key={key} className="space-y-1">
              <label className="text-[10px] text-muted-foreground font-medium">{label}</label>
              <Input
                type="number"
                step={step}
                value={form[key] || ''}
                onChange={e => onCoefChange(key, parseFloat(e.target.value) || 0)}
                className="h-7 text-xs text-center px-1 font-mono"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Parámetros financieros */}
      <div className="p-3 border-b space-y-2">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Parámetros</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'G. Grales %', key: 'gastos_generales_pct' },
            { label: 'Beneficio %', key: 'beneficio_pct' },
            { label: 'IVA %',       key: 'iva_pct' },
          ].map(({ label, key }) => (
            <div key={key} className="space-y-1">
              <label className="text-[10px] text-muted-foreground font-medium">{label}</label>
              <Input
                type="number"
                value={form[key] || 0}
                onChange={e => onPctChange(key, parseFloat(e.target.value) || 0)}
                className="h-7 text-xs text-center px-1"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Desglose por rubros */}
      {(form.rubros || []).length > 0 && (
        <div className="px-3 py-2.5 border-b space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Por Rubro</p>
          {(form.rubros || []).map((r, i) => {
            const sub = calcTotals([r], cp, co);
            const pct = subtotal > 0 ? (sub / subtotal) * 100 : 0;
            return (
              <div key={i} className="space-y-0.5">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-xs text-muted-foreground truncate flex-1">{r.nombre}</span>
                  <span className="text-xs font-semibold whitespace-nowrap tabular-nums">{fmt(sub)}</span>
                </div>
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary/60 rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Totales desglosados */}
      <div className="px-3 py-2.5 space-y-1">
        {[
          { label: 'Subtotal obra', value: subtotal },
          { label: `G. generales (${form.gastos_generales_pct || 0}%)`, value: gg },
          { label: `Beneficio (${form.beneficio_pct || 0}%)`, value: ben },
        ].map(({ label, value }) => (
          <div key={label} className="flex justify-between text-xs">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium tabular-nums">{fmt(value)}</span>
          </div>
        ))}
        <Separator className="my-1.5" />
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Base imponible</span>
          <span className="font-semibold tabular-nums">{fmt(base)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">IVA ({form.iva_pct || 0}%)</span>
          <span className="tabular-nums">{fmt(iva)}</span>
        </div>
        <Separator className="my-1.5" />
        <div className="flex justify-between items-center py-2 px-2.5 bg-primary/5 rounded-lg">
          <span className="font-bold text-sm">TOTAL</span>
          <span className="font-bold text-base text-primary tabular-nums">{fmt(total)}</span>
        </div>
      </div>
    </div>
  );
}

// ── MAIN ────────────────────────────────────────────────────────────────────────
export default function PresupuestoEditor({ presupuesto, onSave, onCancel, saving }) {
  const [form, setForm] = useState(() => presupuesto ? { ...presupuesto } : {
    codigo: generateCode(),
    titulo: '',
    cliente_nombre: 'GCBA - MINISTERIO DE EDUCACIÓN DE LA CIUDAD DE BUENOS AIRES - DGMESC',
    proyecto_nombre: '',
    direccion_obra: '',
    responsable: '',
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
    const cp = form.coef_pase ?? 1.6504;
    const co = form.coef_oferta ?? 1.38;
    const subtotal = calcTotals(rubros, cp, co);
    setForm(p => ({ ...p, rubros, subtotal, total: subtotal }));
  }, [form.coef_pase, form.coef_oferta]);

  const handlePctChange = (key, val) => {
    setForm(p => ({ ...p, [key]: val }));
  };

  const handleCoefChange = (key, val) => {
    setForm(p => {
      const updated = { ...p, [key]: val };
      const cp = updated.coef_pase  ?? 1.6504;
      const co = updated.coef_oferta ?? 1.38;
      const subtotal = calcTotals(updated.rubros || [], cp, co);
      return { ...updated, subtotal, total: subtotal };
    });
  };

  const handleAddRubro = () => {
    const rubros = [...(form.rubros || []), { nombre: `Rubro ${(form.rubros || []).length + 1}`, items: [] }];
    updateRubros(rubros);
  };

  const handleGenerateInvoice = async () => {
    if (form.estado !== 'aprobado') {
      toast.warning('El presupuesto debe estar aprobado para generar factura');
      return;
    }
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
    } catch {
      toast.error('Error al generar la factura');
    }
  };

  const estado = estadoConfig[form.estado] || estadoConfig.borrador;

  return (
    <div className="flex flex-col min-h-full">
      {/* ── Top Bar ── */}
      <div className="flex items-center gap-3 pb-4 border-b mb-5 flex-wrap">
        <Button variant="ghost" size="icon" onClick={onCancel} className="h-9 w-9 shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground shrink-0">
          <span className="hover:text-foreground cursor-pointer" onClick={onCancel}>Presupuestos</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-semibold text-foreground truncate max-w-[200px]">
            {presupuesto ? (presupuesto.titulo || presupuesto.codigo) : 'Nuevo Presupuesto'}
          </span>
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <Badge variant="outline" className={`text-xs ${estado.cls}`}>{estado.label}</Badge>
          {form.comuna && form.comuna !== 'otro' && (
            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
              Comuna {form.comuna}
            </Badge>
          )}

          {/* Estado select */}
          <Select value={form.estado} onValueChange={v => set('estado', v)}>
            <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(estadoConfig).map(([v, { label }]) => (
                <SelectItem key={v} value={v} className="text-xs">{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Export actions */}
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => generatePresupuestoPDF(form)}>
            <FileText className="h-3.5 w-3.5" /> PDF
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs text-blue-700 border-blue-300 hover:bg-blue-50" onClick={() => exportPresupuestoExcel(form)}>
            <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
          </Button>
          {form.estado === 'aprobado' && !form.factura_id && (
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50" onClick={handleGenerateInvoice}>
              <FileCheck className="h-3.5 w-3.5" /> Factura
            </Button>
          )}
          <Button size="sm" className="h-8 gap-1.5" onClick={() => onSave(form)} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Guardar
          </Button>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="flex gap-5 items-start">
        {/* ── Left: metadata + rubros ── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Datos básicos en grid horizontal */}
          <MetaSection title="Datos del Proyecto">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Código</Label>
                <Input value={form.codigo || ''} onChange={e => set('codigo', e.target.value)} className="h-8 text-sm font-mono" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Fecha Emisión</Label>
                <Input type="date" value={form.fecha_emision || ''} onChange={e => set('fecha_emision', e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Plazo de Obra</Label>
                <Input value={form.plazo || ''} onChange={e => set('plazo', e.target.value)} placeholder="Ej: 180 días" className="h-8 text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Título *</Label>
              <Input value={form.titulo || ''} onChange={e => set('titulo', e.target.value)} placeholder="Ej: Refacción Escuela N°15 - Aulas y sanitarios" className="h-8 text-sm" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Comitente / Cliente</Label>
                <Input value={form.cliente_nombre || ''} onChange={e => set('cliente_nombre', e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Licitación</Label>
                <Input value={form.licitacion || ''} onChange={e => set('licitacion', e.target.value)} placeholder="LICIT. PÚBLICA Nº..." className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Escuela / Proyecto</Label>
                <Input value={form.proyecto_nombre || ''} onChange={e => set('proyecto_nombre', e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Dirección obra</Label>
                <Input value={form.direccion_obra || ''} onChange={e => set('direccion_obra', e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Supervisor / Responsable</Label>
                <Input value={form.responsable || ''} onChange={e => set('responsable', e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Inspector</Label>
                <Input value={form.inspector || ''} onChange={e => set('inspector', e.target.value)} className="h-8 text-sm" />
              </div>
            </div>
          </MetaSection>

          {/* Preciario & coefs */}
          <MetaSection title="Preciario Ministerial">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Comuna</Label>
                <Select value={form.comuna || '8A'} onValueChange={v => set('comuna', v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="8A">8A</SelectItem>
                    <SelectItem value="8B">8B</SelectItem>
                    <SelectItem value="10A">10A</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Coef. Pase</Label>
                <Input type="number" step="0.0001" value={form.coef_pase || ''} onChange={e => handleCoefChange('coef_pase', parseFloat(e.target.value) || 1.6504)} className="h-8 text-sm font-mono" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Coef. Oferta</Label>
                <Input type="number" step="0.01" value={form.coef_oferta || ''} onChange={e => handleCoefChange('coef_oferta', parseFloat(e.target.value) || 1.38)} className="h-8 text-sm font-mono" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Fecha Preciario</Label>
                <Input type="date" value={form.preciario_fecha || ''} onChange={e => set('preciario_fecha', e.target.value)} className="h-8 text-sm" />
              </div>
            </div>
            {precario.length > 0 ? (
              <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                <span>{precario.length} ítems disponibles del Preciario Ministerial — Comuna {form.comuna}</span>
              </div>
            ) : form.comuna !== 'otro' ? (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                <Info className="h-3.5 w-3.5 shrink-0" />
                <span>No hay preciario cargado para Comuna {form.comuna}. Importalo desde la pestaña "Preciario Ministerio".</span>
              </div>
            ) : null}
          </MetaSection>

          {/* ── Rubros ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-sm">Rubros e Ítems</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Los precios se calculan automáticamente: PU × Coef. Pase × Coef. Oferta
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={handleAddRubro} className="h-8 gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" /> Agregar Rubro
              </Button>
            </div>

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
                onDelete={() => {
                  const rubros = (form.rubros || []).filter((_, i) => i !== idx);
                  updateRubros(rubros);
                }}
              />
            ))}

            {(form.rubros || []).length === 0 && (
              <button
                onClick={handleAddRubro}
                className="w-full border-2 border-dashed border-border rounded-xl py-10 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors flex flex-col items-center gap-2"
              >
                <Plus className="h-6 w-6" />
                <span className="text-sm font-medium">Agregar primer rubro</span>
              </button>
            )}
          </div>

          {/* Notas */}
          <MetaSection title="Notas y Condiciones">
            <Textarea
              rows={3}
              value={form.notas || ''}
              onChange={e => set('notas', e.target.value)}
              placeholder="Condiciones de pago, alcance del trabajo, exclusiones..."
              className="text-sm resize-none"
            />
          </MetaSection>
        </div>

        {/* ── Right: resumen sticky ── */}
        <div className="w-64 shrink-0 hidden lg:block sticky top-6">
          <ResumenPanel form={form} onPctChange={handlePctChange} onCoefChange={handleCoefChange} />
        </div>
      </div>

      {/* Mobile resumen */}
      <div className="lg:hidden mt-5">
        <ResumenPanel form={form} onPctChange={handlePctChange} onCoefChange={handleCoefChange} />
      </div>
    </div>
  );
}