import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
// Icon is used dynamically via the icon prop in FieldRow
import {
  ArrowLeft, Plus, Download, FileCheck, Loader2, Save,
  FileSpreadsheet, FileText, Building2, MapPin, User, Hash,
  Gavel, Calendar, ChevronDown
} from 'lucide-react';
import RubroSection from '@/components/presupuestos/RubroSection';
import { generatePresupuestoPDF } from '@/components/presupuestos/presupuestoPDF';
import { exportPresupuestoExcel } from '@/utils/exportExcel';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

const estadoConfig = {
  borrador:  { label: 'Borrador',  className: 'bg-slate-100 text-slate-700 border-slate-300' },
  enviado:   { label: 'Enviado',   className: 'bg-blue-100 text-blue-700 border-blue-300' },
  aprobado:  { label: 'Aprobado',  className: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  rechazado: { label: 'Rechazado', className: 'bg-red-100 text-red-700 border-red-300' },
  facturado: { label: 'Facturado', className: 'bg-purple-100 text-purple-700 border-purple-300' },
};

function generateCode() {
  return `PPTO-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
}

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

function FieldRow({ icon: RowIcon, label, children }) {
  const Icon = RowIcon;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2 w-36 shrink-0 pt-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function StickyResumen({ form, onPctChange }) {
  const subtotal = (form.rubros || []).reduce((acc, r) =>
    acc + r.items.reduce((a, i) => a + (i.total || 0), 0), 0
  );
  const gg = subtotal * ((form.gastos_generales_pct || 0) / 100);
  const ben = (subtotal + gg) * ((form.beneficio_pct || 0) / 100);
  const baseImponible = subtotal + gg + ben;
  const iva = baseImponible * ((form.iva_pct || 0) / 100);
  const total = baseImponible + iva;
  const totalItems = (form.rubros || []).reduce((a, r) => a + r.items.length, 0);

  return (
    <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-[#0f1c2e] text-white px-4 py-3">
        <p className="text-xs font-medium text-white/60 uppercase tracking-wide">Resumen</p>
        <p className="text-xl font-bold mt-1">{fmt(total)}</p>
        <p className="text-xs text-white/50 mt-0.5">{totalItems} ítems · {(form.rubros || []).length} rubros</p>
      </div>

      {/* Porcentajes */}
      <div className="p-3 border-b space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Parámetros</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'G. Grales %', key: 'gastos_generales_pct' },
            { label: 'Beneficio %', key: 'beneficio_pct' },
            { label: 'IVA %', key: 'iva_pct' },
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
        <div className="px-3 py-2.5 border-b">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Por rubro</p>
          <div className="space-y-1.5">
            {form.rubros.map((r, i) => {
              const sub = r.items.reduce((a, it) => a + (it.total || 0), 0);
              return (
                <div key={i} className="flex justify-between items-center gap-2">
                  <span className="text-xs text-muted-foreground truncate flex-1">{r.nombre}</span>
                  <span className="text-xs font-semibold whitespace-nowrap">{fmt(sub)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Totales */}
      <div className="px-3 py-2.5 space-y-1.5">
        {[
          { label: 'Subtotal obra', value: subtotal },
          { label: `G. generales (${form.gastos_generales_pct || 0}%)`, value: gg },
          { label: `Beneficio (${form.beneficio_pct || 0}%)`, value: ben },
        ].map(({ label, value }) => (
          <div key={label} className="flex justify-between text-xs">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium">{fmt(value)}</span>
          </div>
        ))}
        <Separator className="my-1" />
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Base imponible</span>
          <span className="font-semibold">{fmt(baseImponible)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">IVA ({form.iva_pct || 0}%)</span>
          <span className="font-medium">{fmt(iva)}</span>
        </div>
        <Separator className="my-1" />
        <div className="flex justify-between items-center pt-1 bg-primary/5 rounded-lg px-2 py-2">
          <span className="font-bold text-sm">TOTAL</span>
          <span className="font-bold text-base text-primary">{fmt(total)}</span>
        </div>
      </div>
    </div>
  );
}

export default function PresupuestoEditor({ presupuesto, onSave, onCancel, saving }) {
  const [form, setForm] = useState(() => presupuesto ? { ...presupuesto } : {
    codigo: generateCode(),
    titulo: '',
    cliente_nombre: '',
    proyecto_nombre: '',
    direccion_obra: '',
    responsable: '',
    licitacion: '',
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
    gastos_generales_pct: 15,
    beneficio_pct: 10,
    iva_pct: 21,
    total: 0,
    notas: '',
  });

  // Cargar precario de la comuna seleccionada
  const { data: precario = [] } = useQuery({
    queryKey: ['precario', form.comuna],
    queryFn: () => base44.entities.PrecarioMinisterio.filter({ comuna: form.comuna, activo: true }, 'codigo', 2000),
    enabled: !!form.comuna,
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const recalc = (rubros, pcts) => {
    const subtotal = rubros.reduce((acc, r) =>
      acc + r.items.reduce((a, i) => a + (i.total || 0), 0), 0);
    const gg = subtotal * ((pcts.gastos_generales_pct || 0) / 100);
    const ben = (subtotal + gg) * ((pcts.beneficio_pct || 0) / 100);
    const baseImponible = subtotal + gg + ben;
    const iva = baseImponible * ((pcts.iva_pct || 0) / 100);
    return { subtotal, total: baseImponible + iva };
  };

  const updateRubros = (rubros) => {
    const { subtotal, total } = recalc(rubros, form);
    setForm(p => ({ ...p, rubros, subtotal, total }));
  };

  const handlePctChange = (key, val) => {
    const updated = { ...form, [key]: val };
    const { subtotal, total } = recalc(form.rubros || [], updated);
    setForm({ ...updated, subtotal, total });
  };

  const handleAddRubro = () => {
    const newRubros = [...(form.rubros || []), { nombre: `Rubro ${(form.rubros || []).length + 1}`, items: [] }];
    updateRubros(newRubros);
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
          r.items.map(i => ({ description: `[${r.nombre}] ${i.descripcion}`, quantity: i.cantidad, unit_price: i.precio_unitario, total: i.total }))
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
      {/* Top bar */}
      <div className="flex items-center gap-3 pb-4 border-b mb-6">
        <Button variant="ghost" size="icon" onClick={onCancel} className="h-9 w-9 shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-bold text-lg leading-tight">
              {presupuesto ? presupuesto.titulo || presupuesto.codigo : 'Nuevo Presupuesto'}
            </h1>
            <Badge variant="outline" className={`text-xs ${estado.className}`}>{estado.label}</Badge>
            {form.comuna && form.comuna !== 'otro' && (
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                Comuna {form.comuna}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">{form.codigo}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Select value={form.estado} onValueChange={v => set('estado', v)}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(estadoConfig).map(([v, { label }]) => (
                <SelectItem key={v} value={v} className="text-xs capitalize">{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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

      {/* Main 2-col layout */}
      <div className="flex gap-6 items-start">
        {/* Left column: metadata + rubros */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* Datos del proyecto */}
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/30">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Datos del Proyecto</h2>
            </div>
            <div className="px-4 py-1">
              <FieldRow icon={Hash} label="Código">
                <Input value={form.codigo || ''} onChange={e => set('codigo', e.target.value)} className="h-8 text-sm font-mono" />
              </FieldRow>
              <FieldRow icon={FileText} label="Título *">
                <Input value={form.titulo || ''} onChange={e => set('titulo', e.target.value)} placeholder="Ej: Refacción Escuela N°15" className="h-8 text-sm" />
              </FieldRow>
              <FieldRow icon={User} label="Cliente / Comitente">
                <Input value={form.cliente_nombre || ''} onChange={e => set('cliente_nombre', e.target.value)} className="h-8 text-sm" />
              </FieldRow>
              <FieldRow icon={Building2} label="Proyecto / Escuela">
                <Input value={form.proyecto_nombre || ''} onChange={e => set('proyecto_nombre', e.target.value)} className="h-8 text-sm" />
              </FieldRow>
              <FieldRow icon={MapPin} label="Dirección obra">
                <Input value={form.direccion_obra || ''} onChange={e => set('direccion_obra', e.target.value)} className="h-8 text-sm" />
              </FieldRow>
              <FieldRow icon={User} label="Responsable">
                <Input value={form.responsable || ''} onChange={e => set('responsable', e.target.value)} className="h-8 text-sm" />
              </FieldRow>
              <FieldRow icon={Gavel} label="Licitación">
                <Input value={form.licitacion || ''} onChange={e => set('licitacion', e.target.value)} placeholder="LICIT. PÚBLICA Nº 558-0158-LPU22" className="h-8 text-sm" />
              </FieldRow>
            </div>
          </div>

          {/* Preciario & coeficientes */}
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/30">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Preciario Ministerial</h2>
            </div>
            <div className="px-4 py-2 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
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
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Coef. Pase</Label>
                <Input type="number" step="0.0001" value={form.coef_pase || 1.6504} onChange={e => set('coef_pase', parseFloat(e.target.value) || 1.6504)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Coef. Oferta</Label>
                <Input type="number" step="0.01" value={form.coef_oferta || 1.38} onChange={e => set('coef_oferta', parseFloat(e.target.value) || 1.38)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Fecha Preciario</Label>
                <Input type="date" value={form.preciario_fecha || ''} onChange={e => set('preciario_fecha', e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Plazo de Obra</Label>
                <Input value={form.plazo || ''} onChange={e => set('plazo', e.target.value)} placeholder="180 días corridos" className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Fecha Emisión</Label>
                <Input type="date" value={form.fecha_emision || ''} onChange={e => set('fecha_emision', e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs text-muted-foreground">Válido Hasta</Label>
                <Input type="date" value={form.fecha_validez || ''} onChange={e => set('fecha_validez', e.target.value)} className="h-8 text-sm" />
              </div>
            </div>
            {precario.length > 0 && (
              <div className="px-4 pb-3">
                <p className="text-xs text-emerald-600 font-medium">✓ {precario.length} ítems del preciario disponibles para Comuna {form.comuna}</p>
              </div>
            )}
            {precario.length === 0 && form.comuna !== 'otro' && (
              <div className="px-4 pb-3">
                <p className="text-xs text-amber-600">⚠ No hay preciario cargado para Comuna {form.comuna}. Importalo desde la pestaña "Preciario Ministerio".</p>
              </div>
            )}
          </div>

          {/* Rubros */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">Rubros e Ítems</h2>
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
          </div>

          {/* Notas */}
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/30">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Notas / Condiciones</h2>
            </div>
            <div className="p-4">
              <Textarea
                rows={3}
                value={form.notas || ''}
                onChange={e => set('notas', e.target.value)}
                placeholder="Condiciones de pago, alcance del trabajo, exclusiones..."
                className="text-sm resize-none"
              />
            </div>
          </div>
        </div>

        {/* Right column: resumen sticky */}
        <div className="w-64 shrink-0 hidden lg:block sticky top-6">
          <StickyResumen form={form} onPctChange={handlePctChange} />
        </div>
      </div>

      {/* Mobile resumen (bottom) */}
      <div className="lg:hidden mt-5">
        <StickyResumen form={form} onPctChange={handlePctChange} />
      </div>
    </div>
  );
}