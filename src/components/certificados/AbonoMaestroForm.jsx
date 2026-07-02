import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  CheckCircle2, Loader2, AlertTriangle, Upload, Sparkles, Plus, X, Info
} from 'lucide-react';
import { toast } from 'sonner';
import { parseMonto, fmt, calcularFechas, mesPeriodoLabel, EMPTY_FORM } from './abonoUtils';

function Section({ title, children }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{title}</p>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground block mb-1">{label}</label>
      {children}
    </div>
  );
}

export default function AbonoMaestroForm({ form, setForm, onSave, onCancel, isSaving, editingId }) {
  const [extractingOC, setExtractingOC] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const montoPreview = parseMonto(form.monto_total_contrato);
  const mesesPreview = parseInt(form.duracion_meses) || 0;
  const { fechaInicio, fechaFin } = calcularFechas(form.fecha_oc_emision, mesesPreview);
  const montoMensualCalc = montoPreview && mesesPreview ? montoPreview / mesesPreview : 0;

  const sumaItems = form.items.reduce((acc, it) => acc + parseMonto(it.importe_total), 0);
  const itemsOk = sumaItems === 0 || Math.abs(sumaItems - montoMensualCalc) < 1;

  const setItem = (i, k, v) => {
    const items = [...form.items];
    items[i] = { ...items[i], [k]: v };
    if (k === 'cantidad' || k === 'importe_unitario') {
      const cant = parseMonto(items[i].cantidad) || 0;
      const pu = parseMonto(items[i].importe_unitario) || 0;
      items[i].importe_total = cant * pu;
    }
    if (k === 'importe_total') {
      items[i].importe_total = parseMonto(v);
    }
    setForm(f => ({ ...f, items }));
  };

  const addItem = () => setForm(f => ({
    ...f,
    items: [...f.items, { descripcion: '', um: 'MES', cantidad: 1, importe_unitario: '', importe_total: 0 }]
  }));
  const removeItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  const autoFillItems = () => {
    if (!montoMensualCalc) return toast.error('Ingresá primero el monto total y la duración');
    setForm(f => ({
      ...f,
      items: [{
        descripcion: form.obra_servicio || 'Abono mensual de mantenimiento',
        um: 'MES',
        cantidad: 1,
        importe_unitario: montoMensualCalc,
        importe_total: montoMensualCalc,
      }]
    }));
    toast.success('Ítem generado automáticamente');
  };

  const extractFromOC = async (file) => {
    if (!file || file.type !== 'application/pdf') return toast.error('Solo se aceptan archivos PDF');
    setExtractingOC(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const res = await base44.functions.invoke('extractADA', { file_url, tipo_override: 'abono_mensual' });
      const data = res.data?.data;
      if (!data) throw new Error('No se pudo extraer datos del PDF');
      setForm(f => ({
        ...f,
        contratista: data.contratista || f.contratista,
        oc_numero: data.oc_numero || f.oc_numero,
        ada_numero: data.ada_numero || f.ada_numero,
        obra_servicio: data.obra_servicio || f.obra_servicio,
        emprendimiento: data.emprendimiento || f.emprendimiento,
        monto_total_contrato: data.subtotal ? String(Math.round(data.subtotal)) : f.monto_total_contrato,
        fecha_oc_emision: data.fecha_inicio || f.fecha_oc_emision,
        plazo_obra: data.plazo_obra || f.plazo_obra,
        condiciones_pago: data.condiciones_pago || f.condiciones_pago,
        items: data.items?.length ? data.items.map(it => ({
          ...it,
          importe_unitario: parseMonto(it.importe_unitario),
          importe_total: parseMonto(it.importe_total) || (parseMonto(it.cantidad) * parseMonto(it.importe_unitario)),
        })) : f.items,
      }));
      toast.success('Datos extraídos del PDF');
    } catch (e) {
      toast.error('Error al extraer: ' + e.message);
    } finally {
      setExtractingOC(false);
    }
  };

  const canSave = form.contratista && parseMonto(form.monto_total_contrato) > 0 && form.fecha_oc_emision && mesesPreview > 0;

  return (
    <div className="space-y-5 max-h-[78vh] overflow-y-auto pr-1 pb-2">

      {/* Upload PDF */}
      <label className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer transition-all ${extractingOC ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'}`}>
        <input type="file" accept="application/pdf" className="hidden" onChange={e => extractFromOC(e.target.files[0])} disabled={extractingOC} />
        {extractingOC ? (
          <><Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" /><p className="text-sm font-semibold text-primary">Extrayendo datos del PDF...</p></>
        ) : (
          <>
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Subir OC / ADA (PDF)</p>
              <p className="text-xs text-muted-foreground">La IA completa los campos automáticamente</p>
            </div>
            <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
          </>
        )}
      </label>

      {/* Datos del Contrato */}
      <Section title="Contrato">
        <div className="col-span-2">
          <Field label="Contratista *">
            <Input placeholder="Nombre del contratista" value={form.contratista} onChange={e => set('contratista', e.target.value)} />
          </Field>
        </div>
        <Field label="N° ADA *">
          <Input placeholder="Ej: 4500012345" value={form.ada_numero} onChange={e => set('ada_numero', e.target.value)} className={!form.ada_numero ? 'border-amber-500/60' : ''} />
        </Field>
        <Field label="N° OC">
          <Input placeholder="Ej: OC-1234" value={form.oc_numero} onChange={e => set('oc_numero', e.target.value)} />
        </Field>
        <div className="col-span-2">
          <Field label="Obra / Servicio">
            <Input placeholder="Descripción del servicio contratado" value={form.obra_servicio} onChange={e => set('obra_servicio', e.target.value)} />
          </Field>
        </div>
        <Field label="Emprendimiento">
          <Input placeholder="Ej: EDUCACION COMUNA 8A" value={form.emprendimiento} onChange={e => set('emprendimiento', e.target.value)} />
        </Field>
        <Field label="Estado">
          <Select value={form.estado} onValueChange={v => set('estado', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="activo">Activo</SelectItem>
              <SelectItem value="pausado">Pausado</SelectItem>
              <SelectItem value="completado">Completado</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </Section>

      {/* Montos y Vigencia */}
      <Section title="Montos y Vigencia">
        <Field label="Monto Total *">
          <Input
            type="text" inputMode="numeric"
            placeholder="Ej: 3060000"
            value={form.monto_total_contrato}
            onChange={e => set('monto_total_contrato', e.target.value)}
            className={parseMonto(form.monto_total_contrato) === 0 ? 'border-amber-500/60' : ''}
          />
          {parseMonto(form.monto_total_contrato) > 0 && (
            <p className="text-xs text-muted-foreground mt-1 font-medium">{fmt(parseMonto(form.monto_total_contrato))}</p>
          )}
        </Field>
        <Field label="Duración (meses) *">
          <Input
            type="number" min="1"
            placeholder="Ej: 12"
            value={form.duracion_meses}
            onChange={e => set('duracion_meses', e.target.value)}
            className={!mesesPreview ? 'border-amber-500/60' : ''}
          />
        </Field>
        <div className="col-span-2">
          <Field label="Fecha de emisión OC *">
            <Input type="date" value={form.fecha_oc_emision} onChange={e => set('fecha_oc_emision', e.target.value)} />
            {form.fecha_oc_emision && (
              <p className="text-xs text-muted-foreground mt-1">El contrato comienza en: <strong>{mesPeriodoLabel(fechaInicio)}</strong></p>
            )}
          </Field>
        </div>
        <Field label="Anticipo / Desacopio %">
          <Input type="number" min="0" max="100" placeholder="0" value={form.anticipo_pct} onChange={e => set('anticipo_pct', +e.target.value)} />
        </Field>
        <Field label="Fondo de Reparo %">
          <Input type="number" min="0" max="100" placeholder="0" value={form.fondo_reparo_pct} onChange={e => set('fondo_reparo_pct', +e.target.value)} />
        </Field>
      </Section>

      {/* Preview calculado */}
      {fechaInicio && montoMensualCalc > 0 && (
        <div className="bg-primary/8 border border-primary/25 rounded-lg p-3 space-y-2">
          <p className="text-xs font-bold text-primary uppercase tracking-wide">Resumen del contrato</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-background/60 rounded p-2">
              <p className="text-muted-foreground text-[10px]">Inicio</p>
              <p className="font-semibold">{mesPeriodoLabel(fechaInicio)}</p>
            </div>
            <div className="bg-background/60 rounded p-2">
              <p className="text-muted-foreground text-[10px]">Fin</p>
              <p className="font-semibold">{mesPeriodoLabel(fechaFin)}</p>
            </div>
            <div className="col-span-2 bg-emerald-500/10 rounded p-2 flex justify-between items-center">
              <p className="text-muted-foreground text-[10px]">Monto mensual calculado</p>
              <p className="font-bold text-emerald-400 text-base">{fmt(montoMensualCalc)}</p>
            </div>
          </div>
          {(form.anticipo_pct > 0 || form.fondo_reparo_pct > 0) && (
            <div className="text-[11px] text-muted-foreground space-y-0.5 pt-1 border-t border-border">
              {form.anticipo_pct > 0 && <p>- Anticipo ({form.anticipo_pct}%): -{fmt(montoMensualCalc * form.anticipo_pct / 100)}</p>}
              {form.fondo_reparo_pct > 0 && <p>- Fondo de Reparo ({form.fondo_reparo_pct}%): -{fmt(montoMensualCalc * form.fondo_reparo_pct / 100)}</p>}
              <p className="font-bold text-foreground">= Neto: {fmt(montoMensualCalc - (montoMensualCalc * (form.anticipo_pct + form.fondo_reparo_pct) / 100))}</p>
            </div>
          )}
        </div>
      )}

      {/* Plazos */}
      <Section title="Plazos y Condiciones">
        <Field label="Plazo de Obra">
          <Input placeholder="Ej: Mensual / 12 meses" value={form.plazo_obra} onChange={e => set('plazo_obra', e.target.value)} />
        </Field>
        <div className="col-span-2">
          <Field label="Condiciones de Pago">
            <Textarea
              placeholder="Ej: 30 días hábiles desde presentación de factura..."
              value={form.condiciones_pago}
              onChange={e => set('condiciones_pago', e.target.value)}
              className="h-14 text-sm resize-none"
            />
          </Field>
        </div>
      </Section>

      {/* Ítems */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Ítems del Certificado</p>
          <div className="flex gap-1.5">
            {montoMensualCalc > 0 && (
              <Button size="sm" variant="ghost" onClick={autoFillItems} className="gap-1 h-7 text-[11px] text-primary hover:text-primary">
                <Sparkles className="h-3 w-3" /> Auto-fill
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={addItem} className="gap-1.5 h-7 text-xs">
              <Plus className="h-3 w-3" /> Agregar
            </Button>
          </div>
        </div>

        {sumaItems > 0 && !itemsOk && (
          <div className="flex items-center gap-1.5 text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-2.5 py-1.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            La suma de ítems ({fmt(sumaItems)}) no coincide con el monto mensual ({fmt(montoMensualCalc)})
          </div>
        )}
        {sumaItems > 0 && itemsOk && montoMensualCalc > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded px-2.5 py-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            Ítems coinciden con monto mensual ✓
          </div>
        )}

        <div className="space-y-2">
          {form.items.map((item, i) => (
            <div key={i} className="grid grid-cols-12 gap-1.5 items-end p-2.5 rounded-lg bg-muted/30 border">
              <div className="col-span-5">
                <label className="text-[10px] text-muted-foreground">Descripción</label>
                <Input className="mt-0.5 h-7 text-xs" value={item.descripcion} onChange={e => setItem(i, 'descripcion', e.target.value)} placeholder="Descripción del ítem" />
              </div>
              <div className="col-span-1">
                <label className="text-[10px] text-muted-foreground">UM</label>
                <Input className="mt-0.5 h-7 text-xs" value={item.um} onChange={e => setItem(i, 'um', e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] text-muted-foreground">Cant.</label>
                <Input className="mt-0.5 h-7 text-xs" type="number" step="any" value={item.cantidad} onChange={e => setItem(i, 'cantidad', parseFloat(e.target.value) || 0)} />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] text-muted-foreground">P. Unit.</label>
                <Input className="mt-0.5 h-7 text-xs" type="number" step="any" value={item.importe_unitario} onChange={e => setItem(i, 'importe_unitario', e.target.value)} />
              </div>
              <div className="col-span-1">
                <label className="text-[10px] text-muted-foreground">Total</label>
                <div className="mt-0.5 h-7 text-[11px] flex items-center px-1.5 bg-background rounded-md border font-semibold text-primary truncate">
                  {fmt(item.importe_total)}
                </div>
              </div>
              <div className="col-span-1 flex justify-end">
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => removeItem(i)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notas */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground block mb-1">Notas internas</label>
        <Textarea placeholder="Observaciones..." value={form.notas} onChange={e => set('notas', e.target.value)} className="h-14 text-sm resize-none" />
      </div>

      {/* Info post-creación */}
      {!editingId && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border border-blue-500/30 bg-blue-500/5 text-[11px] text-blue-300">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <p>Al crear el abono, podrás generar todos los certificados del contrato en un solo click desde la tarjeta.</p>
        </div>
      )}

      {/* Botones */}
      <div className="flex justify-end gap-2 pt-1 sticky bottom-0 bg-background py-3 border-t border-border">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={onSave} disabled={isSaving || !canSave}>
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingId ? 'Actualizar' : 'Crear Abono')}
        </Button>
      </div>
    </div>
  );
}