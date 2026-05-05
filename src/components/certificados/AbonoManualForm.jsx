import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, Loader2, Plus, Trash2 } from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

function Field({ label, children, span = 1 }) {
  return (
    <div className={span === 2 ? 'col-span-2' : ''}>
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">{label}</label>
      {children}
    </div>
  );
}

const EMPTY_ITEM = {
  descripcion: '',
  um: 'GL',
  cantidad: 1,
  importe_unitario: 0,
  importe_total: 0,
};

const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function AbonoManualForm({ initialData = {}, onSave, onCancel, saving }) {
  const [form, setForm] = useState({
    // Encabezado
    contratista: initialData.contratista || '',
    emprendimiento: initialData.emprendimiento || '',
    obra_servicio: initialData.obra_servicio || '',
    ada_numero: initialData.ada_numero || '',
    oc_numero: initialData.oc_numero || '',
    mes_periodo: initialData.mes_periodo || '',
    fecha_inicio: initialData.fecha_inicio || '',
    plazo_obra: initialData.plazo_obra || '',
    plazo_entrega: initialData.plazo_entrega || '',
    fecha_finalizacion: initialData.fecha_finalizacion || '',
    fecha_certificado: initialData.fecha_certificado || new Date().toISOString().split('T')[0],
    numero_recepcion: initialData.numero_recepcion || '',
    condiciones_pago: initialData.condiciones_pago || '',
    monto_contratado: initialData.monto_contratado || 0,
    monto_obra_contratada: initialData.monto_obra_contratada || 0,
    porcentaje_avance: initialData.porcentaje_avance || 0,
    base: initialData.base || '',
    // Ítems
    items: initialData.items?.length
      ? initialData.items.map(it => ({ ...it, importe_total: it.importe_total || it.cantidad * it.importe_unitario || 0 }))
      : [{ ...EMPTY_ITEM }],
    // Deducciones
    anticipo_pct: initialData.anticipo_pct ?? 0,
    fondo_reparo_pct: initialData.fondo_reparo_pct ?? 0,
    // Misc
    notas: initialData.notas || '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const setItem = (i, k, v) => {
    const items = [...form.items];
    items[i] = { ...items[i], [k]: v };
    if (k === 'cantidad' || k === 'importe_unitario') {
      items[i].importe_total = (items[i].cantidad || 0) * (items[i].importe_unitario || 0);
    }
    setForm(f => ({ ...f, items }));
  };

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { ...EMPTY_ITEM }] }));
  const removeItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  const subtotal = form.items.reduce((acc, it) => acc + (it.importe_total || 0), 0);
  const anticipo = form.anticipo_pct > 0 ? subtotal * (form.anticipo_pct / 100) : 0;
  const fondoReparo = form.fondo_reparo_pct > 0 ? subtotal * (form.fondo_reparo_pct / 100) : 0;
  const totalNeto = subtotal - anticipo - fondoReparo;

  const handleSave = () => {
    onSave({ ...form, subtotal, tipo: 'abono_mensual' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b">
        <Button variant="ghost" size="icon" onClick={onCancel}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold">Nuevo Certificado Manual</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Completá todos los campos del certificado de abono mensual</p>
        </div>
        <Button onClick={handleSave} disabled={saving || !form.contratista} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Guardando...' : 'Guardar Certificado'}
        </Button>
      </div>

      {/* Sección: Datos del Contrato */}
      <section className="bg-card rounded-lg border p-5 space-y-4">
        <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Datos del Contrato</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Contratista *" span={2}>
            <Input placeholder="Nombre del contratista" value={form.contratista} onChange={e => set('contratista', e.target.value)} />
          </Field>
          <Field label="Emprendimiento">
            <Input placeholder="Ej: EDUCACION COMUNA 8A" value={form.emprendimiento} onChange={e => set('emprendimiento', e.target.value)} />
          </Field>
          <Field label="Obra / Servicio">
            <Input placeholder="Descripción del servicio" value={form.obra_servicio} onChange={e => set('obra_servicio', e.target.value)} />
          </Field>
          <Field label="N° ADA">
            <Input placeholder="Ej: ADA-5678" value={form.ada_numero} onChange={e => set('ada_numero', e.target.value)} />
          </Field>
          <Field label="N° Orden de Compra">
            <Input placeholder="Ej: OC-1234" value={form.oc_numero} onChange={e => set('oc_numero', e.target.value)} />
          </Field>
        </div>
      </section>

      {/* Sección: Período y Fechas */}
      <section className="bg-card rounded-lg border p-5 space-y-4">
        <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Período y Fechas</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Mes / Período">
            <Input placeholder="Ej: Mayo 2026 o 2026-05" value={form.mes_periodo} onChange={e => set('mes_periodo', e.target.value)} />
          </Field>
          <Field label="Fecha del Certificado">
            <Input type="date" value={form.fecha_certificado} onChange={e => set('fecha_certificado', e.target.value)} />
          </Field>
          <Field label="Fecha de Inicio">
            <Input type="date" value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)} />
          </Field>
          <Field label="Fecha de Finalización">
            <Input type="date" value={form.fecha_finalizacion} onChange={e => set('fecha_finalizacion', e.target.value)} />
          </Field>
          <Field label="Plazo de Obra">
            <Input placeholder="Ej: Mensual / 6 meses" value={form.plazo_obra} onChange={e => set('plazo_obra', e.target.value)} />
          </Field>
          <Field label="Plazo de Entrega">
            <Input placeholder="Ej: 30 días" value={form.plazo_entrega} onChange={e => set('plazo_entrega', e.target.value)} />
          </Field>
          <Field label="N° de Recepción">
            <Input placeholder="Número de recepción" value={form.numero_recepcion} onChange={e => set('numero_recepcion', e.target.value)} />
          </Field>
          <Field label="Base">
            <Input placeholder="Base del certificado" value={form.base} onChange={e => set('base', e.target.value)} />
          </Field>
        </div>
      </section>

      {/* Sección: Montos del Contrato */}
      <section className="bg-card rounded-lg border p-5 space-y-4">
        <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Montos y Avance</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Monto Contratado $">
            <Input type="number" value={form.monto_contratado} onChange={e => set('monto_contratado', +e.target.value)} />
          </Field>
          <Field label="Monto Obra Contratada $">
            <Input type="number" value={form.monto_obra_contratada} onChange={e => set('monto_obra_contratada', +e.target.value)} />
          </Field>
          <Field label="% Avance de Obra">
            <Input type="number" min="0" max="100" value={form.porcentaje_avance} onChange={e => set('porcentaje_avance', +e.target.value)} />
          </Field>
          <Field label="Condiciones de Pago" span={2}>
            <Textarea placeholder="Ej: 30 días hábiles desde presentación de factura..." value={form.condiciones_pago} onChange={e => set('condiciones_pago', e.target.value)} className="h-16 text-sm resize-none" />
          </Field>
        </div>
      </section>

      {/* Sección: Ítems */}
      <section className="bg-card rounded-lg border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Ítems del Certificado</h3>
          <Button size="sm" variant="outline" onClick={addItem} className="gap-2">
            <Plus className="h-3.5 w-3.5" /> Agregar ítem
          </Button>
        </div>

        <div className="space-y-3">
          {form.items.map((item, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end p-3 rounded-lg bg-muted/30 border">
              <div className="col-span-5">
                <label className="text-xs text-muted-foreground">Descripción</label>
                <Input className="mt-1 h-8 text-xs" value={item.descripcion} onChange={e => setItem(i, 'descripcion', e.target.value)} placeholder="Descripción del ítem" />
              </div>
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground">UM</label>
                <Input className="mt-1 h-8 text-xs" value={item.um} onChange={e => setItem(i, 'um', e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Cantidad</label>
                <Input className="mt-1 h-8 text-xs" type="number" value={item.cantidad} onChange={e => setItem(i, 'cantidad', +e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">P. Unitario $</label>
                <Input className="mt-1 h-8 text-xs" type="number" value={item.importe_unitario} onChange={e => setItem(i, 'importe_unitario', +e.target.value)} />
              </div>
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground">Total</label>
                <div className="mt-1 h-8 text-xs flex items-center px-2 bg-background rounded-md border font-semibold text-primary truncate">
                  {fmt(item.importe_total)}
                </div>
              </div>
              <div className="col-span-1 flex justify-end">
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeItem(i)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Sección: Deducciones y Total */}
      <section className="bg-card rounded-lg border p-5 space-y-4">
        <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Deducciones y Total</h3>
        <div className="flex flex-col items-end gap-3 max-w-sm ml-auto">
          <div className="flex justify-between w-full text-sm">
            <span className="text-muted-foreground">Subtotal:</span>
            <span className="font-semibold">{fmt(subtotal)}</span>
          </div>
          <div className="flex justify-between w-full text-sm items-center gap-2">
            <span className="text-muted-foreground">Anticipo/Desacopio %:</span>
            <Input type="number" min="0" className="w-20 h-7 text-xs" value={form.anticipo_pct} onChange={e => set('anticipo_pct', +e.target.value)} />
          </div>
          {anticipo > 0 && (
            <div className="flex justify-between w-full text-xs text-muted-foreground">
              <span>Anticipo ({form.anticipo_pct}%):</span>
              <span className="text-destructive">-{fmt(anticipo)}</span>
            </div>
          )}
          <div className="flex justify-between w-full text-sm items-center gap-2">
            <span className="text-muted-foreground">Fondo de Reparo %:</span>
            <Input type="number" min="0" className="w-20 h-7 text-xs" value={form.fondo_reparo_pct} onChange={e => set('fondo_reparo_pct', +e.target.value)} />
          </div>
          {fondoReparo > 0 && (
            <div className="flex justify-between w-full text-xs text-muted-foreground">
              <span>Fondo de Reparo ({form.fondo_reparo_pct}%):</span>
              <span className="text-destructive">-{fmt(fondoReparo)}</span>
            </div>
          )}
          <div className="w-full border-t pt-3 flex justify-between font-bold text-base">
            <span>Total Neto:</span>
            <span className="text-primary">{fmt(totalNeto)}</span>
          </div>
        </div>
      </section>

      {/* Notas */}
      <section className="bg-card rounded-lg border p-5">
        <Field label="Notas / Observaciones">
          <Textarea placeholder="Observaciones adicionales..." value={form.notas} onChange={e => set('notas', e.target.value)} className="h-20 text-sm resize-none mt-1" />
        </Field>
      </section>

      {/* Botón final */}
      <div className="flex justify-end pb-6">
        <Button onClick={handleSave} disabled={saving || !form.contratista} size="lg" className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Guardando...' : 'Guardar Certificado'}
        </Button>
      </div>
    </div>
  );
}