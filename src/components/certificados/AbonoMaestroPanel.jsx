import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, Pencil, Trash2, Calendar, Clock, CheckCircle2, Loader2, AlertCircle,
  Upload, Sparkles, RefreshCw, AlertTriangle, ChevronDown, ChevronUp,
  FileText, DollarSign, Info, X, Zap, ChevronRight
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

// ─── Helpers de montos ────────────────────────────────────────────────────────
const parseMonto = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  const clean = String(v).replace(/\./g, '').replace(',', '.');
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
};

const fmt = (v) => {
  const n = parseMonto(v);
  if (!n) return '$ 0';
  const parts = Math.round(Math.abs(n)).toString().split('');
  const result = [];
  parts.reverse().forEach((d, i) => {
    if (i > 0 && i % 3 === 0) result.push('.');
    result.push(d);
  });
  return (n < 0 ? '-' : '') + '$ ' + result.reverse().join('');
};

const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function calcularFechas(fechaOC, duracionMeses) {
  if (!fechaOC || !duracionMeses) return {};
  const [y, m] = fechaOC.split('-').map(Number);
  let inicioMes = m + 1, inicioYear = y;
  if (inicioMes > 12) { inicioMes = 1; inicioYear++; }
  const fechaInicio = `${inicioYear}-${String(inicioMes).padStart(2, '0')}-01`;
  let finMes = inicioMes + duracionMeses - 1, finYear = inicioYear;
  while (finMes > 12) { finMes -= 12; finYear++; }
  const ultimoDia = new Date(finYear, finMes, 0).getDate();
  const fechaFin = `${finYear}-${String(finMes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
  return { fechaInicio, fechaFin };
}

function mesPeriodoLabel(dateStr) {
  if (!dateStr) return '—';
  const [y, m] = dateStr.split('-').map(Number);
  return `${MESES_ES[m - 1]} ${y}`;
}

function getCertActualNum(abono) {
  if (!abono.fecha_inicio_validez) return null;
  const now = new Date();
  const inicio = new Date(abono.fecha_inicio_validez + 'T00:00:00');
  const diffMeses = Math.floor((now - inicio) / (1000 * 60 * 60 * 24 * 30.44));
  const certNum = diffMeses + 1;
  if (certNum < 1 || certNum > abono.duracion_meses) return null;
  return certNum;
}

// Detecta problemas en un abono
function detectarProblemas(abono) {
  const problemas = [];
  if (!abono.ada_numero) problemas.push('Sin N° ADA');
  if (!abono.oc_numero) problemas.push('Sin N° OC');
  if (!abono.monto_total_contrato || parseMonto(abono.monto_total_contrato) === 0) problemas.push('Monto total en $0');
  if (!abono.duracion_meses || abono.duracion_meses < 1) problemas.push('Duración inválida');
  if (!abono.fecha_inicio_validez) problemas.push('Sin fecha de inicio');
  // Si tiene ítems, verificar que la suma coincida con el monto mensual
  if (abono.items?.length > 0 && abono.monto_mensual > 0) {
    const sumaItems = abono.items.reduce((acc, it) => acc + parseMonto(it.importe_total), 0);
    if (sumaItems > 0 && Math.abs(sumaItems - parseMonto(abono.monto_mensual)) > 10) {
      problemas.push(`Ítems (${fmt(sumaItems)}) ≠ Monto mensual (${fmt(abono.monto_mensual)})`);
    }
  }
  return problemas;
}

const EMPTY_FORM = {
  contratista: '', oc_numero: '', ada_numero: '', obra_servicio: '',
  emprendimiento: '', monto_total_contrato: '', fecha_oc_emision: '',
  duracion_meses: '', plazo_obra: '', plazo_entrega: '', condiciones_pago: '',
  anticipo_pct: 0, fondo_reparo_pct: 0,
  items: [{ descripcion: '', um: 'MES', cantidad: 1, importe_unitario: '', importe_total: 0 }],
  estado: 'activo', notas: '',
};

// ─── Tarjeta de Abono ─────────────────────────────────────────────────────────
function AbonoCard({ abono, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const problemas = detectarProblemas(abono);
  const certActual = getCertActualNum(abono);
  const emitidos = abono.certificados_emitidos || 0;
  const total = abono.duracion_meses || 1;
  const progreso = Math.min(100, (emitidos / total) * 100);
  const pendientes = total - emitidos;

  const estadoStyle = {
    activo: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    completado: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    pausado: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  };

  return (
    <Card className={`p-0 overflow-hidden ${problemas.length > 0 ? 'border-amber-500/40' : ''}`}>
      {/* Cabecera */}
      <div className="p-4 pb-3 space-y-3">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm leading-tight">{abono.contratista || '—'}</h3>
            {abono.obra_servicio && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{abono.obra_servicio}</p>
            )}
          </div>
          <Badge className={`text-[10px] border shrink-0 ${estadoStyle[abono.estado] || ''}`}>
            {abono.estado}
          </Badge>
        </div>

        {/* Alertas de problemas */}
        {problemas.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-md px-2.5 py-1.5 space-y-0.5">
            {problemas.map((p, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px] text-amber-400">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {p}
              </div>
            ))}
          </div>
        )}

        {/* IDs rápidos */}
        <div className="flex gap-1.5 flex-wrap">
          {abono.ada_numero && (
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono font-semibold">
              ADA {abono.ada_numero}
            </span>
          )}
          {abono.oc_numero && (
            <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-mono">
              OC {abono.oc_numero}
            </span>
          )}
          {abono.emprendimiento && (
            <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
              {abono.emprendimiento}
            </span>
          )}
        </div>

        {/* Montos principales */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-muted/40 rounded-lg p-2.5">
            <p className="text-[10px] text-muted-foreground">Mensual</p>
            <p className="text-sm font-bold text-emerald-400 mt-0.5">{fmt(abono.monto_mensual)}</p>
          </div>
          <div className="bg-muted/40 rounded-lg p-2.5">
            <p className="text-[10px] text-muted-foreground">Total contrato</p>
            <p className="text-sm font-bold text-primary mt-0.5">{fmt(abono.monto_total_contrato)}</p>
          </div>
        </div>

        {/* Progreso */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px]">
            <span className="text-muted-foreground">
              {emitidos} de {total} certificados emitidos
            </span>
            <span className={pendientes > 0 ? 'text-amber-400 font-medium' : 'text-emerald-400 font-medium'}>
              {pendientes > 0 ? `${pendientes} pendiente${pendientes > 1 ? 's' : ''}` : '✓ Completo'}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all ${progreso >= 100 ? 'bg-emerald-500' : 'bg-primary'}`}
              style={{ width: `${progreso}%` }}
            />
          </div>
          {certActual && (
            <p className="text-[11px] text-primary font-semibold">
              ▶ Este mes: certificado N° {certActual} de {total}
            </p>
          )}
        </div>

        {/* Fechas compactas */}
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {mesPeriodoLabel(abono.fecha_inicio_validez)}
          </span>
          <span>→</span>
          <span className="flex items-center gap-1">
            {mesPeriodoLabel(abono.fecha_fin_validez)}
            <Clock className="h-3 w-3" />
          </span>
        </div>
      </div>

      {/* Expandible: ítems */}
      {abono.items?.length > 0 && (
        <div className="border-t border-border">
          <button
            className="w-full flex items-center justify-between px-4 py-2 text-[11px] text-muted-foreground hover:bg-muted/30 transition-colors"
            onClick={() => setExpanded(e => !e)}
          >
            <span className="flex items-center gap-1.5">
              <FileText className="h-3 w-3" />
              {abono.items.length} ítem{abono.items.length > 1 ? 's' : ''} de certificado
            </span>
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {expanded && (
            <div className="px-4 pb-3 space-y-1">
              {abono.items.map((it, i) => (
                <div key={i} className="flex justify-between items-start text-[11px] py-1 border-b border-border/50 last:border-0">
                  <span className="text-foreground flex-1 pr-2">{it.descripcion || `Ítem ${i + 1}`}</span>
                  <span className="text-primary font-semibold shrink-0">{fmt(it.importe_total)}</span>
                </div>
              ))}
              <div className="flex justify-between text-[11px] pt-1 font-bold">
                <span className="text-muted-foreground">Total ítems:</span>
                <span className="text-emerald-400">
                  {fmt(abono.items.reduce((a, it) => a + parseMonto(it.importe_total), 0))}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Acciones */}
      <div className="flex gap-2 px-4 py-3 border-t border-border bg-muted/20">
        <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-xs h-7" onClick={() => onEdit(abono)}>
          <Pencil className="h-3 w-3" /> Editar
        </Button>
        <Button
          size="sm" variant="ghost"
          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => { if (window.confirm(`¿Eliminar el abono de ${abono.contratista}?`)) onDelete(abono.id); }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Card>
  );
}

// ─── Formulario ───────────────────────────────────────────────────────────────
function AbonoForm({ form, setForm, onSave, onCancel, isSaving, editingId }) {
  const [extractingOC, setExtractingOC] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const parseEntero = (v) => { const n = parseInt(String(v).replace(/\D/g, ''), 10); return isNaN(n) ? '' : n; };

  const montoPreview = parseMonto(form.monto_total_contrato);
  const mesesPreview = parseInt(form.duracion_meses) || 0;
  const { fechaInicio, fechaFin } = calcularFechas(form.fecha_oc_emision, mesesPreview);
  const montoMensualCalc = montoPreview && mesesPreview ? montoPreview / mesesPreview : 0;

  // Suma de ítems
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

  // Auto-fill items desde monto mensual si no hay ítems con descripción
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
        plazo_entrega: data.plazo_entrega || f.plazo_entrega,
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
        <Field label="Monto Total Contrato *">
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
          {form.anticipo_pct > 0 || form.fondo_reparo_pct > 0 ? (
            <div className="text-[11px] text-muted-foreground space-y-0.5 pt-1 border-t border-border">
              {form.anticipo_pct > 0 && <p>- Anticipo ({form.anticipo_pct}%): -{fmt(montoMensualCalc * form.anticipo_pct / 100)}</p>}
              {form.fondo_reparo_pct > 0 && <p>- Fondo de Reparo ({form.fondo_reparo_pct}%): -{fmt(montoMensualCalc * form.fondo_reparo_pct / 100)}</p>}
              <p className="font-bold text-foreground">= Neto: {fmt(montoMensualCalc - (montoMensualCalc * (form.anticipo_pct + form.fondo_reparo_pct) / 100))}</p>
            </div>
          ) : null}
        </div>
      )}

      {/* Plazos y Condiciones */}
      <Section title="Plazos y Condiciones">
        <Field label="Plazo de Obra">
          <Input placeholder="Ej: Mensual / 12 meses" value={form.plazo_obra} onChange={e => set('plazo_obra', e.target.value)} />
        </Field>
        <Field label="Plazo de Entrega">
          <Input placeholder="Ej: 30 días hábiles" value={form.plazo_entrega} onChange={e => set('plazo_entrega', e.target.value)} />
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

        {/* Aviso de desajuste */}
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
                <label className="text-[10px] text-muted-foreground">P. Unitario</label>
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

// Mini helpers de UI
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

// ─── Panel Principal ──────────────────────────────────────────────────────────
export default function AbonoMaestroPanel() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const queryClient = useQueryClient();

  const { data: abonos = [], isLoading } = useQuery({
    queryKey: ['abonos-maestro'],
    queryFn: () => base44.entities.AbonoMaestro.list('-created_date'),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Stats rápidas
  const stats = useMemo(() => {
    const activos = abonos.filter(a => a.estado === 'activo').length;
    const conProblemas = abonos.filter(a => detectarProblemas(a).length > 0).length;
    const totalMensual = abonos.filter(a => a.estado === 'activo').reduce((acc, a) => acc + parseMonto(a.monto_mensual), 0);
    return { activos, conProblemas, totalMensual };
  }, [abonos]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const monto = parseMonto(data.monto_total_contrato);
      const meses = parseInt(data.duracion_meses) || 1;
      const { fechaInicio, fechaFin } = calcularFechas(data.fecha_oc_emision, meses);
      const itemsConTotal = (data.items || []).map(it => ({
        ...it,
        importe_unitario: parseMonto(it.importe_unitario),
        importe_total: parseMonto(it.importe_total) || (parseMonto(it.cantidad) * parseMonto(it.importe_unitario)),
      }));
      const payload = {
        ...data,
        monto_total_contrato: monto,
        duracion_meses: meses,
        monto_mensual: meses > 0 ? monto / meses : 0,
        fecha_inicio_validez: fechaInicio,
        fecha_fin_validez: fechaFin,
        items: itemsConTotal,
        ...(editingId ? {} : { certificados_emitidos: 0 }),
      };
      if (editingId) return base44.entities.AbonoMaestro.update(editingId, payload);
      return base44.entities.AbonoMaestro.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['abonos-maestro'] });
      toast.success(editingId ? 'Abono actualizado' : 'Abono creado correctamente');
      setShowForm(false); setEditingId(null); setForm(EMPTY_FORM);
    },
    onError: (e) => toast.error('Error: ' + e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.AbonoMaestro.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['abonos-maestro'] }); toast.success('Abono eliminado'); },
  });

  const [importandoCerts, setImportandoCerts] = useState(false);
  const [forzandoGen, setForzandoGen] = useState(false);
  const [resultadoGen, setResultadoGen] = useState(null);

  const forzarGeneracion = async () => {
    if (!window.confirm('¿Forzar la generación de certificados mensuales ahora? Esto creará los certificados del próximo mes para todos los Abonos Maestros activos.')) return;
    setForzandoGen(true);
    setResultadoGen(null);
    try {
      const res = await base44.functions.invoke('generateMonthlyCertificates', { forceRun: true });
      const data = res.data;
      setResultadoGen(data);
      if (data.success) {
        toast.success(`${data.generatedCertificates?.length || 0} certificados generados para ${data.mesPeriodo}`);
        queryClient.invalidateQueries({ queryKey: ['abonos-maestro'] });
        queryClient.invalidateQueries({ queryKey: ['certificados'] });
      } else {
        toast.error(data.message || 'Error en la generación');
      }
    } catch (e) {
      toast.error('Error: ' + e.message);
    } finally {
      setForzandoGen(false);
    }
  };

  const importarDesdeCertificados = async () => {
    setImportandoCerts(true);
    try {
      const [certs, abonosExistentes] = await Promise.all([
        base44.entities.Certificado.list('-created_date', 500),
        base44.entities.AbonoMaestro.list('-created_date', 500),
      ]);
      const grupos = {};
      certs.filter(c => c.tipo === 'abono_mensual' && c.contratista && c.ada_numero).forEach(c => {
        const key = `${c.contratista}__${c.ada_numero}`;
        if (!grupos[key]) grupos[key] = { contratista: c.contratista, ada_numero: c.ada_numero, certs: [] };
        grupos[key].certs.push(c);
      });
      const keys = new Set(abonosExistentes.map(a => `${a.contratista}__${a.ada_numero}`));
      const nuevos = Object.values(grupos).filter(g => !keys.has(`${g.contratista}__${g.ada_numero}`));
      if (nuevos.length === 0) { toast.info('Todos los abonos ya están creados'); return; }

      let creados = 0;
      for (const grupo of nuevos) {
        const certRef = [...grupo.certs].sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
        const certMasAntiguo = [...grupo.certs].sort((a, b) => new Date(a.created_date) - new Date(b.created_date))[0];
        const fechaOC = certMasAntiguo.fecha_inicio || certMasAntiguo.created_date?.substring(0, 10) || '';
        const montoMensual = parseMonto(certRef.subtotal) || parseMonto(certRef.monto_contratado) || 0;
        await base44.entities.AbonoMaestro.create({
          contratista: grupo.contratista,
          ada_numero: grupo.ada_numero,
          oc_numero: certRef.oc_numero || '',
          obra_servicio: certRef.obra_servicio || '',
          emprendimiento: certRef.emprendimiento || '',
          monto_total_contrato: montoMensual,
          duracion_meses: Math.max(grupo.certs.length, 1),
          monto_mensual: montoMensual,
          fecha_oc_emision: fechaOC,
          fecha_inicio_validez: fechaOC,
          fecha_fin_validez: '',
          plazo_obra: certRef.plazo_obra || '',
          condiciones_pago: certRef.condiciones_pago || '',
          anticipo_pct: certRef.anticipo_pct || 0,
          fondo_reparo_pct: certRef.fondo_reparo_pct || 0,
          items: (certRef.items || []).map(it => ({
            ...it,
            importe_unitario: parseMonto(it.importe_unitario),
            importe_total: parseMonto(it.importe_total),
          })),
          certificados_emitidos: grupo.certs.length,
          estado: 'activo',
        });
        creados++;
      }
      queryClient.invalidateQueries({ queryKey: ['abonos-maestro'] });
      toast.success(`${creados} Abono${creados > 1 ? 's' : ''} Maestro${creados > 1 ? 's' : ''} creado${creados > 1 ? 's' : ''}`);
    } catch (e) {
      toast.error('Error al importar: ' + e.message);
    } finally {
      setImportandoCerts(false);
    }
  };

  const handleEdit = (abono) => {
    setEditingId(abono.id);
    setForm({
      contratista: abono.contratista || '',
      oc_numero: abono.oc_numero || '',
      ada_numero: abono.ada_numero || '',
      obra_servicio: abono.obra_servicio || '',
      emprendimiento: abono.emprendimiento || '',
      monto_total_contrato: abono.monto_total_contrato ? String(abono.monto_total_contrato) : '',
      fecha_oc_emision: abono.fecha_oc_emision || '',
      duracion_meses: abono.duracion_meses || '',
      plazo_obra: abono.plazo_obra || '',
      plazo_entrega: abono.plazo_entrega || '',
      condiciones_pago: abono.condiciones_pago || '',
      anticipo_pct: abono.anticipo_pct ?? 0,
      fondo_reparo_pct: abono.fondo_reparo_pct ?? 0,
      items: abono.items?.length
        ? abono.items.map(it => ({ ...it, importe_unitario: parseMonto(it.importe_unitario), importe_total: parseMonto(it.importe_total) }))
        : [{ descripcion: '', um: 'MES', cantidad: 1, importe_unitario: '', importe_total: 0 }],
      estado: abono.estado || 'activo',
      notas: abono.notas || '',
    });
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      {/* Header con stats */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex gap-3 flex-wrap">
          <div className="text-center bg-muted/40 rounded-lg px-4 py-2">
            <p className="text-[10px] text-muted-foreground">Activos</p>
            <p className="text-lg font-bold text-emerald-400">{stats.activos}</p>
          </div>
          <div className="text-center bg-muted/40 rounded-lg px-4 py-2">
            <p className="text-[10px] text-muted-foreground">Total mensual</p>
            <p className="text-lg font-bold text-primary">{fmt(stats.totalMensual)}</p>
          </div>
          {stats.conProblemas > 0 && (
            <div className="text-center bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2">
              <p className="text-[10px] text-amber-400">Con alertas</p>
              <p className="text-lg font-bold text-amber-400">{stats.conProblemas}</p>
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={importarDesdeCertificados} disabled={importandoCerts} className="gap-2 text-xs h-8">
            {importandoCerts ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Importar desde Certs.
          </Button>
          <Button
            variant="outline"
            onClick={forzarGeneracion}
            disabled={forzandoGen || stats.activos === 0}
            className="gap-2 text-xs h-8 border-amber-500/50 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
          >
            {forzandoGen ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            Forzar Generación
          </Button>
          <Button onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setShowForm(true); }} className="gap-2 h-8 text-xs">
            <Plus className="h-3.5 w-3.5" /> Nuevo Abono
          </Button>
        </div>
      </div>

      {/* Resultado de generación forzada */}
      {resultadoGen && (
        <div className={`rounded-lg border p-4 space-y-3 ${resultadoGen.success ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-destructive/10 border-destructive/30'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {resultadoGen.success ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <AlertCircle className="h-4 w-4 text-destructive" />}
              <p className="text-sm font-semibold">{resultadoGen.message}</p>
            </div>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setResultadoGen(null)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          {resultadoGen.generatedCertificates?.length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] text-muted-foreground font-semibold uppercase">Certificados generados:</p>
              {resultadoGen.generatedCertificates.map((c, i) => (
                <div key={i} className="flex items-center justify-between text-xs bg-background/60 rounded px-3 py-1.5">
                  <span className="font-medium">{c.contratista}</span>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>Cert N° {c.numero_en_contrato}</span>
                    <span className="text-emerald-400 font-semibold">{fmt(c.monto)}</span>
                    {c.pdf_url && <a href={c.pdf_url} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1"><FileText className="h-3 w-3" />PDF</a>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {resultadoGen.skipped?.length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] text-muted-foreground font-semibold uppercase">Omitidos ({resultadoGen.skipped.length}):</p>
              {resultadoGen.skipped.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <ChevronRight className="h-3 w-3 shrink-0" />
                  <span className="font-medium">{s.contratista}</span>
                  <span>— {s.reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : abonos.length === 0 ? (
        <Card className="p-12 text-center">
          <DollarSign className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No hay contratos de abono configurados</p>
          <p className="text-xs text-muted-foreground mt-1">Creá uno para que el sistema genere los certificados automáticamente</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {abonos.map(abono => (
            <AbonoCard
              key={abono.id}
              abono={abono}
              onEdit={handleEdit}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </div>
      )}

      {/* Modal formulario */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              {editingId ? 'Editar Abono Maestro' : 'Nuevo Abono Maestro'}
            </DialogTitle>
          </DialogHeader>
          <AbonoForm
            form={form}
            setForm={setForm}
            editingId={editingId}
            onSave={() => saveMutation.mutate(form)}
            onCancel={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); }}
            isSaving={saveMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}