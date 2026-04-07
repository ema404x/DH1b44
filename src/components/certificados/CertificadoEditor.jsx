import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Plus, ArrowLeft, Save, Eye, AlertTriangle, CheckCircle2, Wand2 } from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">{label}</label>
      {children}
    </div>
  );
}

export default function CertificadoEditor({ initialData, onSave, onCancel, onPreview, saving }) {
  const [form, setForm] = useState(() => {
    const items = (initialData?.items || []).map((item, i) => ({
      numero: i + 1,
      descripcion: item.descripcion || '',
      um: item.um || 'GL',
      cantidad: item.cantidad || 1,
      importe_unitario: item.importe_unitario || 0,
      importe_total: item.importe_total || (item.cantidad * item.importe_unitario) || 0,
      med_acum_anterior_unidad: 0,
      med_acum_anterior_importe: 0,
      med_presente_unidad: item.cantidad || 1,
      med_presente_importe: item.importe_total || 0,
      med_acum_presente_unidad: item.cantidad || 1,
      med_acum_presente_importe: item.importe_total || 0,
      saldo_pendiente_unidad: 0,
      saldo_pendiente_importe: 0,
    }));
    return {
      tipo: initialData?.tipo || 'abono_mensual',
      numero: initialData?.numero || 1,
      estado: 'borrador',
      emprendimiento: initialData?.emprendimiento || '',
      obra_servicio: initialData?.obra_servicio || '',
      contratista: initialData?.contratista || '',
      ada_numero: initialData?.ada_numero || '',
      oc_numero: initialData?.oc_numero || '',
      mes_periodo: initialData?.mes_periodo || '',
      fecha_inicio: initialData?.fecha_inicio || '',
      plazo_obra: initialData?.plazo_obra || '',
      fecha_finalizacion: initialData?.fecha_finalizacion || '',
      monto_contratado: initialData?.monto_contratado || initialData?.subtotal || 0,
      monto_obra_contratada: initialData?.monto_obra_contratada || 0,
      porcentaje_avance: initialData?.porcentaje_avance || 0,
      condiciones_pago: initialData?.condiciones_pago || '',
      plazo_entrega: initialData?.plazo_entrega || '',
      base: initialData?.base || '',
      fecha_certificado: new Date().toISOString().split('T')[0],
      numero_recepcion: '',
      anticipo_pct: 0,
      fondo_reparo_pct: 5,
      subtotal: initialData?.subtotal || 0,
      _validation: initialData?._validation || null,
      ada_pdf_url: initialData?.ada_pdf_url || '',
      items,
    };
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const setItem = (i, k, v) => {
    const items = [...form.items];
    items[i] = { ...items[i], [k]: v };
    if (k === 'cantidad' || k === 'importe_unitario') {
      items[i].importe_total = items[i].cantidad * items[i].importe_unitario;
      items[i].med_presente_importe = items[i].importe_total;
      items[i].med_acum_presente_importe = items[i].importe_total;
    }
    setForm(f => ({ ...f, items }));
  };

  const addItem = () => {
    setForm(f => ({
      ...f,
      items: [...f.items, {
        numero: f.items.length + 1, descripcion: '', um: 'GL',
        cantidad: 1, importe_unitario: 0, importe_total: 0,
        med_acum_anterior_unidad: 0, med_acum_anterior_importe: 0,
        med_presente_unidad: 1, med_presente_importe: 0,
        med_acum_presente_unidad: 1, med_acum_presente_importe: 0,
        saldo_pendiente_unidad: 0, saldo_pendiente_importe: 0,
      }]
    }));
  };

  const removeItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  const subtotal = form.items.reduce((acc, it) => acc + (it.importe_total || 0), 0);
  const anticipo = subtotal * (form.anticipo_pct / 100);
  const fondoReparo = subtotal * (form.fondo_reparo_pct / 100);
  const totalNeto = subtotal - anticipo - fondoReparo;

  const aplicarAvance = () => {
    const pct = (form.porcentaje_avance || 0) / 100;
    if (!pct) {
      alert('Ingresá un % de avance mayor a 0 antes de aplicar.');
      return;
    }

    // Usar subtotal real de los ítems como base del 100%
    const totalContrato = form.items.reduce((acc, it) => acc + (it.importe_total || 0), 0);
    if (!totalContrato) {
      alert('Los ítems no tienen importes calculados. Revisá cantidad y precio unitario.');
      return;
    }

    const targetTotal = totalContrato * pct;
    let acumulado = 0;

    const newItems = form.items.map(item => {
      const itemFull = item.importe_total || 0;

      if (itemFull === 0) {
        return {
          ...item,
          med_presente_unidad: 0,
          med_presente_importe: 0,
          med_acum_presente_unidad: item.med_acum_anterior_unidad || 0,
          med_acum_presente_importe: item.med_acum_anterior_importe || 0,
          saldo_pendiente_unidad: item.cantidad || 0,
          saldo_pendiente_importe: 0,
        };
      }

      if (acumulado >= targetTotal) {
        // Ya llegamos al target, este ítem queda pendiente
        return {
          ...item,
          med_presente_unidad: 0,
          med_presente_importe: 0,
          med_acum_presente_unidad: item.med_acum_anterior_unidad || 0,
          med_acum_presente_importe: item.med_acum_anterior_importe || 0,
          saldo_pendiente_unidad: item.cantidad || 0,
          saldo_pendiente_importe: itemFull,
        };
      }

      const resta = targetTotal - acumulado;
      const fraccion = Math.min(1, resta / itemFull);
      const cantPres = Math.round((item.cantidad || 0) * fraccion * 100) / 100;
      const importePres = Math.round(itemFull * fraccion);
      acumulado += importePres;

      const acumPresUnidad = (item.med_acum_anterior_unidad || 0) + cantPres;
      const acumPresImporte = (item.med_acum_anterior_importe || 0) + importePres;
      const saldoUnidad = Math.max(0, (item.cantidad || 0) - acumPresUnidad);
      const saldoImporte = Math.max(0, itemFull - acumPresImporte);

      return {
        ...item,
        med_presente_unidad: cantPres,
        med_presente_importe: importePres,
        med_acum_presente_unidad: acumPresUnidad,
        med_acum_presente_importe: acumPresImporte,
        saldo_pendiente_unidad: saldoUnidad,
        saldo_pendiente_importe: saldoImporte,
      };
    });

    setForm(f => ({ ...f, items: newItems }));
  };

  const validacion = useMemo(() => {
    const v = form._validation;
    if (!v?.subtotal_documento) return null;
    const diff = Math.abs(subtotal - v.subtotal_documento);
    const pct = diff / v.subtotal_documento;
    return { docTotal: v.subtotal_documento, diff, coincide: pct <= 0.005 };
  }, [subtotal, form._validation]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b">
        <Button variant="ghost" size="icon" onClick={onCancel}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">Editar Certificado</h2>
          <p className="text-xs text-muted-foreground mt-1">Revisá y ajustá los datos extraídos por la IA</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={
            form.tipo === 'abono_mensual' ? 'bg-blue-100 text-blue-700 border-blue-200' :
            form.tipo === 'informe' ? 'bg-purple-100 text-purple-700 border-purple-200' :
            'bg-green-100 text-green-700 border-green-200'
          }>
            {form.tipo === 'abono_mensual' ? 'Abono Mensual' : form.tipo === 'informe' ? 'Informe' : 'Obra'}
          </Badge>
          <Button variant="outline" className="gap-2" onClick={() => onPreview(form)}><Eye className="h-4 w-4" />Vista previa</Button>
          <Button className="gap-2" onClick={() => onSave(form)} disabled={saving}><Save className="h-4 w-4" />{saving ? 'Guardando...' : 'Guardar'}</Button>
        </div>
      </div>

      {/* Banner de validación de subtotal */}
      {validacion && (
        <div className={`flex items-start gap-3 rounded-lg p-4 border text-sm ${validacion.coincide ? 'bg-green-50 border-green-200 text-green-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
          {validacion.coincide
            ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            : <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />}
          <div>
            {validacion.coincide
              ? <span>Subtotal validado: la suma de ítems coincide con el total del documento ({fmt(validacion.docTotal)}).</span>
              : <span>⚠️ Discrepancia detectada: suma de ítems <strong>{fmt(subtotal)}</strong> vs total del documento <strong>{fmt(validacion.docTotal)}</strong> (diferencia: {fmt(validacion.diff)}). Revisá si hay ítems de más o faltantes.</span>}
          </div>
        </div>
      )}

      {/* Encabezado */}
      <div className="bg-card rounded-lg border p-5 space-y-4">
        <h3 className="font-semibold text-sm text-foreground uppercase tracking-wide">Datos del Encabezado</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Tipo">
            <Select value={form.tipo} onValueChange={v => set('tipo', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="abono_mensual">Abono Mensual</SelectItem>
                <SelectItem value="obra">Obra</SelectItem>
                <SelectItem value="informe">Informe / Certificado</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Certificado N°"><Input type="number" value={form.numero} onChange={e => set('numero', +e.target.value)} /></Field>
          <Field label="Emprendimiento"><Input value={form.emprendimiento} onChange={e => set('emprendimiento', e.target.value)} /></Field>
          <Field label="Obra / Servicio"><Input value={form.obra_servicio} onChange={e => set('obra_servicio', e.target.value)} /></Field>
          <Field label="Contratista"><Input value={form.contratista} onChange={e => set('contratista', e.target.value)} /></Field>
          <Field label="ADA N°"><Input value={form.ada_numero} onChange={e => set('ada_numero', e.target.value)} /></Field>
          <Field label="OC N°"><Input value={form.oc_numero} onChange={e => set('oc_numero', e.target.value)} /></Field>
          <Field label="Mes / Período"><Input value={form.mes_periodo} onChange={e => set('mes_periodo', e.target.value)} /></Field>
          <Field label="Fecha de Inicio"><Input type="date" value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)} /></Field>
          <Field label="Plazo de Obra"><Input value={form.plazo_obra} onChange={e => set('plazo_obra', e.target.value)} /></Field>
          <Field label="Plazo de Entrega"><Input value={form.plazo_entrega} onChange={e => set('plazo_entrega', e.target.value)} /></Field>
          <Field label="Fecha de Finalización"><Input type="date" value={form.fecha_finalizacion} onChange={e => set('fecha_finalizacion', e.target.value)} /></Field>
          <Field label="Monto Contratado $"><Input type="number" value={form.monto_contratado} onChange={e => set('monto_contratado', +e.target.value)} /></Field>
          <Field label="Monto Obra Contratada $"><Input type="number" value={form.monto_obra_contratada} onChange={e => set('monto_obra_contratada', +e.target.value)} /></Field>
          <Field label="% Avance de Obra">
            <div className="flex gap-2">
              <Input type="number" min="0" max="100" value={form.porcentaje_avance} onChange={e => set('porcentaje_avance', +e.target.value)} />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 gap-1.5 text-xs px-3"
                onClick={aplicarAvance}
                title="Distribuir el % de avance sobre los ítems"
              >
                <Wand2 className="h-3.5 w-3.5" />
                Aplicar
              </Button>
            </div>
          </Field>
          <Field label="Fecha del Certificado"><Input type="date" value={form.fecha_certificado} onChange={e => set('fecha_certificado', e.target.value)} /></Field>
          <Field label="N° de Recepción"><Input value={form.numero_recepcion} onChange={e => set('numero_recepcion', e.target.value)} /></Field>
        </div>
        <Field label="Condiciones de Pago">
          <Textarea value={form.condiciones_pago} onChange={e => set('condiciones_pago', e.target.value)} className="h-16 text-sm resize-none" placeholder="Ej: 30 días hábiles desde presentación de factura..." />
        </Field>
      </div>

      {/* Ítems */}
      <div className="bg-card rounded-lg border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-foreground uppercase tracking-wide">Ítems</h3>
          <Button size="sm" variant="outline" className="gap-2" onClick={addItem}><Plus className="h-3.5 w-3.5" />Agregar ítem</Button>
        </div>
        <div className="space-y-3">
          {form.items.map((item, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-start p-3 rounded-lg bg-muted/30 border">
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground">N°</label>
                <Input className="mt-1 h-8 text-xs" value={item.numero} onChange={e => setItem(i, 'numero', +e.target.value)} />
              </div>
              <div className="col-span-4">
                <label className="text-xs text-muted-foreground">Descripción</label>
                <Input className="mt-1 h-8 text-xs" value={item.descripcion} onChange={e => setItem(i, 'descripcion', e.target.value)} />
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
                <label className="text-xs text-muted-foreground">P. Unitario</label>
                <Input className="mt-1 h-8 text-xs" type="number" value={item.importe_unitario} onChange={e => setItem(i, 'importe_unitario', +e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Total</label>
                <div className="mt-1 h-8 text-xs flex items-center px-3 bg-background rounded-md border font-medium">{fmt(item.importe_total)}</div>
              </div>
              <div className="col-span-12 flex justify-end">
                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => removeItem(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Totales */}
      <div className="bg-card rounded-lg border p-5 space-y-4">
        <h3 className="font-semibold text-sm text-foreground uppercase tracking-wide">Totales y Deducciones</h3>
        <div className="flex flex-col items-end gap-2 max-w-sm ml-auto">
          <div className="flex justify-between w-full text-sm"><span className="text-muted-foreground">Subtotal:</span><span className="font-semibold">{fmt(subtotal)}</span></div>
          <div className="flex justify-between w-full text-sm items-center gap-2">
            <span className="text-muted-foreground">Anticipo/Desacopio %:</span>
            <Input type="number" className="w-20 h-7 text-xs" value={form.anticipo_pct} onChange={e => set('anticipo_pct', +e.target.value)} />
          </div>
          <div className="flex justify-between w-full text-sm items-center gap-2">
            <span className="text-muted-foreground">Fondo de Reparo %:</span>
            <Input type="number" className="w-20 h-7 text-xs" value={form.fondo_reparo_pct} onChange={e => set('fondo_reparo_pct', +e.target.value)} />
          </div>
          <div className="w-full border-t pt-2 flex justify-between font-bold">
            <span>Total Neto:</span><span className="text-primary">{fmt(totalNeto)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}