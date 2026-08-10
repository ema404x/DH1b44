import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Plus, ArrowLeft, Save, Eye, AlertTriangle, CheckCircle2, Wand2, Layers, Send, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import HistorialAcumulados from './HistorialAcumulados';
import ItemAcumulacionRow from './ItemAcumulacionRow';
import { recalcItem, aplicarCantidadPu, aplicarPresenteUnidad, aplicarPresenteImporte, aplicarAnteriorUnidad, aplicarAnteriorImporte, matchAnteriorDesdeCert, calcularTotales } from './acumulacionUtils';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Math.round(n || 0));
const parseMonto = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const s = String(v).trim();
  const dots = (s.match(/\./g) || []).length;
  const commas = (s.match(/,/g) || []).length;
  let norm = s;
  if (dots > 1) { norm = s.replace(/\./g, '').replace(',', '.'); }
  else if (dots === 1 && commas === 0) { if ((s.split('.')[1] || '').length > 2) norm = s.replace('.', ''); }
  else if (commas >= 1) { norm = dots === 0 && commas === 1 ? s.replace(',', '.') : s.replace(/\./g, '').replace(',', '.'); }
  const n = parseFloat(norm);
  return isNaN(n) ? 0 : n;
};
const r0 = (n) => Math.round(parseMonto(n));

// recalcItem y la coherencia unidad↔importe viven en ./acumulacionUtils
// (compartidas por editor, vista previa y PDF).

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">{label}</label>
      {children}
    </div>
  );
}

export default function CertificadoEditor({ initialData, onDraft, onEmitir, onCancel, onPreview, saving, emitting }) {
  const [masivoPct, setMasivoPct] = useState('');

  const [form, setForm] = useState(() => {
    const items = (initialData?.items || []).map((item, i) => {
      const importe_total = r0(item.importe_total) || Math.round(r0(item.cantidad) * r0(item.importe_unitario));
      const medEditado = !!item._med_editado
        || (item.med_presente_importe != null && r0(item.med_presente_importe) !== importe_total)
        || (item.saldo_pendiente_importe != null && r0(item.saldo_pendiente_importe) > 0);
      const cantTotal = r0(item.cantidad) || 1;
      const cantAnterior = r0(item.med_acum_anterior_unidad);
      const medPresente = medEditado ? r0(item.med_presente_importe ?? importe_total) : importe_total;
      const cantPresente = medEditado
        ? (item.med_presente_unidad != null ? r0(item.med_presente_unidad) : cantTotal)
        : cantTotal;
      const raw = {
        numero: i + 1,
        descripcion: item.descripcion || '',
        um: item.um || 'GL',
        cantidad: cantTotal,
        importe_unitario: r0(item.importe_unitario),
        importe_total,
        med_acum_anterior_unidad: cantAnterior,
        med_acum_anterior_importe: r0(item.med_acum_anterior_importe),
        med_presente_unidad: cantPresente,
        med_presente_importe: medPresente,
        med_acum_presente_unidad: item.med_acum_presente_unidad ?? (cantAnterior + cantPresente),
        med_acum_presente_importe: item.med_acum_presente_importe ?? (r0(item.med_acum_anterior_importe) + medPresente),
        saldo_pendiente_unidad: 0,
        saldo_pendiente_importe: 0,
        _med_editado: medEditado,
      };
      return recalcItem(raw);
    });
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
      monto_contratado: (() => {
        const raw = initialData?.monto_contratado;
        if (!raw && raw !== 0) return '';
        return String(Math.round(raw));
      })(),
      porcentaje_pagado_anteriormente: initialData?.porcentaje_pagado_anteriormente ?? 0,
      porcentaje_avance: initialData?.porcentaje_avance || 0,
      condiciones_pago: initialData?.condiciones_pago || '',
      plazo_entrega: initialData?.plazo_entrega || '',
      base: initialData?.base || '',
      fecha_certificado: new Date().toISOString().split('T')[0],
      numero_recepcion: '',
      anticipo_pct: initialData?.anticipo_pct ?? 0,
      anticipo_monto_manual: initialData?.anticipo_monto_manual ?? null,
      fondo_reparo_pct: initialData?.fondo_reparo_pct ?? 0,
      fondo_reparo_monto_manual: initialData?.fondo_reparo_monto_manual ?? null,
      fondo_reparo_label: initialData?.fondo_reparo_label || '',
      fondo_reparo_aplicar: initialData?.fondo_reparo_aplicar ?? false,
      subtotal: initialData?.subtotal || 0,
      _validation: initialData?._validation || null,
      ada_pdf_url: initialData?.ada_pdf_url || '',
      items,
    };
  });

  const set = (k, v) => {
    setForm(f => {
      const updated = { ...f, [k]: v };
      // Auto-rellenar fecha_inicio y plazo_obra al cambiar mes_periodo en abono mensual
      if (k === 'mes_periodo' && f.tipo === 'abono_mensual') {
        const parsed = parseMesPeriodo(v);
        if (parsed) {
          updated.fecha_inicio = parsed;
          updated.plazo_obra = 'Mensual';
        }
      }
      return updated;
    });
  };

  // Parsea "Abril 2026", "abril 2026", "04/2026", "04-2026" → "2026-04-01"
  const parseMesPeriodo = (str) => {
    if (!str) return null;
    const meses = { enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,octubre:10,noviembre:11,diciembre:12 };
    const lower = str.toLowerCase().trim();
    // "abril 2026" o "abril de 2026"
    const nombreMatch = lower.match(/([a-záéíóú]+)\s+(?:de\s+)?(\d{4})/);
    if (nombreMatch) {
      const mes = meses[nombreMatch[1]];
      if (mes) return `${nombreMatch[2]}-${String(mes).padStart(2,'0')}-01`;
    }
    // "04/2026" o "04-2026"
    const numMatch = lower.match(/(\d{1,2})[\/\-](\d{4})/);
    if (numMatch) return `${numMatch[2]}-${String(numMatch[1]).padStart(2,'0')}-01`;
    return null;
  };

  const setItem = (i, k, v) => {
    const items = [...form.items];
    let it = { ...items[i], [k]: v };
    // Coherencia unidad↔importe en cada tramo: editar uno recalcula el otro
    // (importe = unidad × precio unitario). Así acumulado, presente y saldo
    // nunca se descalabran al tocar un solo campo.
    if (k === 'cantidad' || k === 'importe_unitario') {
      it = aplicarCantidadPu(it);
    } else if (k === 'med_presente_unidad') {
      it = aplicarPresenteUnidad(it, v);
    } else if (k === 'med_presente_importe') {
      it = aplicarPresenteImporte(it, v);
    } else if (k === 'med_acum_anterior_unidad') {
      it = aplicarAnteriorUnidad(it, v);
    } else if (k === 'med_acum_anterior_importe') {
      it = aplicarAnteriorImporte(it, v);
    }
    items[i] = recalcItem(it);
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

  // Cálculo centralizado en acumulacionUtils → editor, vista previa y PDF
  // producen números idénticos (una sola fuente de verdad para totales,
  // deducciones y progresión). Ver calcularTotales() para la semántica.
  const {
    subtotalContrato: subtotal,
    hasMedicion, totalPresente, totalAcumAnterior,
    acumuladoAnterior, acumuladoTotal, totalSaldo, baseCalculo,
    anticipo, fondoReparoMonto, fondoReparo, pagadoAnteriormente,
    totalNeto, pctAnterior, pctActual, pctFinal, pctRestante, overCertContrato,
    pctCertificado, anteriorPorB,
  } = calcularTotales(form);
  // montoContratado: campo del encabezado si está cargado, sino suma de ítems
  const montoContratado = parseMonto(form.monto_contratado) > 0
    ? parseMonto(form.monto_contratado)
    : subtotal;


  const aplicarCantidadMasiva = (cant) => {
    if (cant === '' || cant === null || cant === undefined) return;
    const nuevaCantidad = r0(cant);
    const newItems = form.items.map(item => {
      const nuevoTotal = Math.round(nuevaCantidad * r0(item.importe_unitario));
      return recalcItem({
        ...item,
        cantidad: nuevaCantidad,
        importe_total: nuevoTotal,
        med_presente_unidad: nuevaCantidad,
        med_presente_importe: nuevoTotal,
        _med_editado: true,
      });
    });
    setForm(f => ({ ...f, items: newItems }));
  };

  // % Avance de Certificación = % ACUMULADO sobre el contrato (final).
  // Calcula el presente de cada ítem como lo que falta para llegar a ese
  // % acumulado, descontando lo ya certificado anteriormente y sin superar
  // el saldo pendiente. Así: anterior + actual = % de avance ingresado.
  const aplicarAvance = () => {
    const pctFinal = form.porcentaje_avance || 0;
    if (!pctFinal || pctFinal <= 0) {
      alert('Ingresá un % de avance de certificación mayor a 0.');
      return;
    }
    const totalContrato = form.items.reduce((acc, it) => acc + (it.importe_total || 0), 0);
    if (!totalContrato) {
      alert('Los ítems no tienen importes calculados. Revisá cantidad y precio unitario.');
      return;
    }
    const fraccion = Math.min(1, pctFinal / 100);
    const newItems = form.items.map(item => {
      const importe_total = item.importe_total || 0;
      const acumAnteriorImporte = item.med_acum_anterior_importe || 0;
      const pu = item.importe_unitario || 0;
      const saldoImporte = Math.max(0, importe_total - acumAnteriorImporte);
      // Objetivo acumulado de este ítem al % ingresado; el presente es lo que
      // falta para llegar ahí desde lo ya certificado, topeado por el saldo.
      const objetivoAcumulado = Math.round(importe_total * fraccion);
      const presenteImporte = Math.max(0, Math.min(saldoImporte, objetivoAcumulado - acumAnteriorImporte));
      const presenteUnidad = pu > 0 ? Math.round((presenteImporte / pu) * 100) / 100 : 0;
      return recalcItem({
        ...item,
        med_presente_unidad: presenteUnidad,
        med_presente_importe: presenteImporte,
        _med_editado: true,
      });
    });
    setForm(f => ({ ...f, items: newItems }));
  };

  // Traer el acumulado anterior del certificado previo de la misma ADA.
  // Empareja ítems por número (fallback descripción) y respeta los que el
  // usuario ya sobreescribió (_anterior_override). Es la base "auto" del
  // acumulado; el override manual del usuario queda por encima.
  const traerAnterior = async () => {
    if (!form.ada_numero) {
      toast.error('Cargá el N° de ADA antes de traer el acumulado anterior');
      return;
    }
    try {
      const todos = await base44.entities.Certificado.filter(
        { ada_numero: form.ada_numero }, '-created_date', 50
      );
      const previos = todos
        .filter(c => c.estado !== 'borrador' && c.id !== initialData?.id && Array.isArray(c.items) && c.items.length)
        .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      const previo = previos[0];
      if (!previo) {
        toast.info('No hay certificados previos con ítems para esta ADA');
        return;
      }
      const nuevos = matchAnteriorDesdeCert(form.items, previo).map(recalcItem);
      setForm(f => ({ ...f, items: nuevos }));
      toast.success(`Acumulado anterior traído del Cert. N° ${previo.numero}`);
    } catch (e) {
      toast.error('No se pudo traer el acumulado anterior');
    }
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
          <Button variant="outline" className="gap-2" onClick={() => onPreview({ ...form, monto_contratado: parseMonto(form.monto_contratado), subtotal: baseCalculo, _subtotal_contrato: subtotal, _hasMedicion: hasMedicion, _anticipo_monto: anticipo, _fondo_reparo_monto: fondoReparo, _pagado_anteriormente_monto: pagadoAnteriormente })}>
            <Eye className="h-4 w-4" />Vista previa
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => onDraft({ ...form, monto_contratado: parseMonto(form.monto_contratado), subtotal: baseCalculo, _subtotal_contrato: subtotal, _hasMedicion: hasMedicion, _anticipo_monto: anticipo, _fondo_reparo_monto: fondoReparo, _pagado_anteriormente_monto: pagadoAnteriormente })} disabled={saving || emitting}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Guardando...' : 'Guardar borrador'}
          </Button>
          <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => onEmitir({ ...form, monto_contratado: parseMonto(form.monto_contratado), subtotal: baseCalculo, _subtotal_contrato: subtotal, _hasMedicion: hasMedicion, _anticipo_monto: anticipo, _fondo_reparo_monto: fondoReparo, _pagado_anteriormente_monto: pagadoAnteriormente })} disabled={saving || emitting}>
            {emitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {emitting ? 'Emitiendo...' : 'Emitir certificado'}
          </Button>
        </div>
      </div>

      {/* Historial de acumulados */}
      <HistorialAcumulados 
        adaNumero={form.ada_numero} 
        ocNumero={form.oc_numero} 
        contratista={form.contratista}
        montoContratado={parseMonto(form.monto_contratado) > 0 ? parseMonto(form.monto_contratado) : subtotal}
      />

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
          <Field label="Monto Contratado $">
            <Input
              type="text"
              inputMode="numeric"
              placeholder="Ej: 1.098.000"
              value={form.monto_contratado}
              onChange={e => set('monto_contratado', e.target.value)}
            />
            {parseMonto(form.monto_contratado) > 0 && (
              <p className="text-xs text-muted-foreground mt-1">{fmt(parseMonto(form.monto_contratado))}</p>
            )}
          </Field>
          <Field label="% Pagado Anteriormente">
            <Input
              type="number"
              min="0"
              max="100"
              placeholder="0"
              value={form.porcentaje_pagado_anteriormente || ''}
              onChange={e => set('porcentaje_pagado_anteriormente', +e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">Se calcula sobre el total contratado, no sobre el parcial</p>
          </Field>
          <Field label="% Avance de Certificación">
            <div className="flex gap-2">
              <Input type="number" min="0" max="100" value={form.porcentaje_avance} onChange={e => set('porcentaje_avance', +e.target.value)} />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 gap-1.5 text-xs px-3"
                onClick={aplicarAvance}
                title="Calcular el presente a partir del % acumulado, descontando lo ya certificado"
              >
                <Wand2 className="h-3.5 w-3.5" />
                Aplicar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">% acumulado sobre el contrato; descuenta lo certificado anteriormente</p>
          </Field>
          <Field label="Fecha del Certificado"><Input type="date" value={form.fecha_certificado} onChange={e => set('fecha_certificado', e.target.value)} /></Field>
          <Field label="N° de Recepción"><Input value={form.numero_recepcion} onChange={e => set('numero_recepcion', e.target.value)} /></Field>
        </div>
        <Field label="Condiciones de Pago">
          <Textarea value={form.condiciones_pago} onChange={e => set('condiciones_pago', e.target.value)} className="h-16 text-sm resize-none" placeholder="Ej: 30 días hábiles desde presentación de factura..." />
        </Field>
      </div>

      {/* Resumen de certificación en tiempo real */}
      {hasMedicion && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-blue-800">Progresión de certificación</span>
            <span className={`text-2xl font-bold ${overCertContrato ? 'text-red-600' : 'text-blue-700'}`}>{pctFinal.toFixed(1)}%</span>
          </div>
          {/* Barra apilada: % anterior (verde) + % actual (azul) sobre el contrato */}
          <div className="w-full bg-blue-100 rounded-full h-3 overflow-hidden flex">
            <div className="h-3 bg-emerald-500 transition-all duration-300" style={{ width: `${Math.min(100, pctAnterior)}%` }} title={`Pagado anteriormente: ${pctAnterior.toFixed(1)}%`} />
            <div className="h-3 bg-blue-600 transition-all duration-300" style={{ width: `${Math.min(100, pctActual)}%` }} title={`Este certificado: ${pctActual.toFixed(1)}%`} />
          </div>
          {/* Desglose: anterior + actual = final · restante */}
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="bg-white rounded-md p-2 border border-emerald-200 text-center">
              <div className="text-muted-foreground mb-0.5">% Anterior</div>
              <div className="font-bold text-emerald-600 tabular-nums">{pctAnterior.toFixed(1)}%</div>
            </div>
            <div className="bg-blue-600 rounded-md p-2 text-center">
              <div className="text-blue-100 mb-0.5">% Actual</div>
              <div className="font-bold text-white tabular-nums">{pctActual.toFixed(1)}%</div>
            </div>
            <div className="bg-white rounded-md p-2 border border-blue-300 text-center">
              <div className="text-muted-foreground mb-0.5">% Final</div>
              <div className={`font-bold tabular-nums ${overCertContrato ? 'text-red-600' : 'text-blue-700'}`}>{pctFinal.toFixed(1)}%</div>
            </div>
            <div className="bg-white rounded-md p-2 border border-orange-200 text-center">
              <div className="text-muted-foreground mb-0.5">% Restante</div>
              <div className="font-bold text-orange-600 tabular-nums">{pctRestante.toFixed(1)}%</div>
            </div>
          </div>
          {overCertContrato && (
            <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              El acumulado ({pctFinal.toFixed(1)}%) supera el 100% del contrato. Revisá el % pagado anteriormente o lo certificado ahora.
            </div>
          )}
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="bg-white rounded-md p-2 border border-blue-100 text-center">
              <div className="text-muted-foreground mb-0.5">Total contrato</div>
              <div className="font-bold text-foreground">{fmt(subtotal)}</div>
            </div>
            <div className="bg-blue-600 rounded-md p-2 text-center">
              <div className="text-blue-100 mb-0.5">Certificado (presente)</div>
              <div className="font-bold text-white">{fmt(totalPresente)}</div>
            </div>
            <div className="bg-white rounded-md p-2 border border-orange-200 text-center">
              <div className="text-muted-foreground mb-0.5">Saldo pendiente</div>
              <div className="font-bold text-orange-600">{fmt(totalSaldo)}</div>
            </div>
          </div>
          <div className="flex justify-between text-xs text-blue-700 font-medium pt-1 border-t border-blue-200">
            <span>Total Neto a cobrar:</span>
            <span className="font-bold">{fmt(totalNeto)}</span>
          </div>
        </div>
      )}

      {/* Ítems */}
      <div className="bg-card rounded-lg border p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-semibold text-sm text-foreground uppercase tracking-wide">Ítems</h3>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Edición masiva de cantidad */}
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
              <Layers className="h-4 w-4 text-amber-500 shrink-0" />
              <div className="flex flex-col leading-none">
                <span className="text-[10px] font-semibold text-amber-500 uppercase tracking-wide">Cantidad masiva</span>
                <span className="text-[10px] text-muted-foreground">Aplica a todos los ítems</span>
              </div>
              <Input
                type="number"
                min="0"
                placeholder="ej: 1"
                value={masivoPct}
                onChange={e => setMasivoPct(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && masivoPct !== '') { aplicarCantidadMasiva(masivoPct); setMasivoPct(''); }}}
                className="w-20 h-7 text-xs border-amber-500/40 focus:ring-amber-400"
              />
              <Button
                size="sm"
                className="h-7 text-xs px-3 gap-1.5 bg-amber-500 hover:bg-amber-600 text-white"
                onClick={() => { aplicarCantidadMasiva(masivoPct); setMasivoPct(''); }}
                disabled={masivoPct === ''}
              >
                <Wand2 className="h-3 w-3" /> Aplicar
              </Button>
            </div>
            <Button size="sm" variant="outline" className="gap-2" onClick={traerAnterior} title="Traer el acumulado anterior del certificado previo de la misma ADA">
              <RefreshCw className="h-3.5 w-3.5" />Traer acum. anterior
            </Button>
            <Button size="sm" variant="outline" className="gap-2" onClick={addItem}><Plus className="h-3.5 w-3.5" />Agregar ítem</Button>
          </div>
        </div>
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-xs border-collapse min-w-[1080px]">
            <thead>
              <tr className="bg-muted/60 text-muted-foreground">
                <th className="px-1 py-2 text-left font-semibold w-10">N°</th>
                <th className="px-1 py-2 text-left font-semibold min-w-[160px]">Descripción</th>
                <th className="px-1 py-2 text-left font-semibold w-14">UM</th>
                <th className="px-1 py-2 text-right font-semibold w-20">Cant.</th>
                <th className="px-1 py-2 text-right font-semibold w-24">P. Unit.</th>
                <th className="px-1 py-2 text-right font-semibold w-28">Total cto.</th>
                <th className="px-1 py-2 text-right font-semibold w-20" title="Acumulado anterior — unidades">A.Ant U</th>
                <th className="px-1 py-2 text-right font-semibold w-28" title="Acumulado anterior — importe">A.Ant $</th>
                <th className="px-1 py-2 text-right font-semibold w-20 text-blue-700" title="Presente — unidades">Pres U</th>
                <th className="px-1 py-2 text-right font-semibold w-28 text-blue-700" title="A certificar — importe">Pres $</th>
                <th className="px-1 py-2 text-right font-semibold w-20" title="Acumulado presente — unidades">Ac.Pres U</th>
                <th className="px-1 py-2 text-right font-semibold w-28" title="Acumulado presente — importe">Ac.Pres $</th>
                <th className="px-1 py-2 text-right font-semibold w-28">Saldo $</th>
                <th className="px-1 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {form.items.map((item, i) => (
                <ItemAcumulacionRow key={i} item={item} index={i} onChange={setItem} onRemove={removeItem} />
              ))}
            </tbody>
          </table>
        </div>
        {form.items.some(it => it._sobrecertificado) && (
          <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Hay ítems que superan la cantidad contratada (sobrecertificación). Revisá el acumulado anterior o el presente.
          </div>
        )}
      </div>

      {/* Totales */}
      <div className="bg-card rounded-lg border p-5 space-y-4">
        <h3 className="font-semibold text-sm text-foreground uppercase tracking-wide">Totales y Deducciones</h3>
        <div className="flex flex-col items-end gap-2 max-w-sm ml-auto">
          {hasMedicion && (
            <div className="flex justify-between w-full text-xs text-muted-foreground">
              <span>Total contrato:</span><span>{fmt(subtotal)}</span>
            </div>
          )}
          <div className="flex justify-between w-full text-sm">
            <span className="text-muted-foreground">{hasMedicion ? 'Importe certificado:' : 'Subtotal:'}</span>
            <span className="font-semibold text-blue-700">{fmt(baseCalculo)}</span>
          </div>
          {hasMedicion && totalSaldo > 0 && (
            <div className="flex justify-between w-full text-xs">
              <span className="text-muted-foreground">Saldo pendiente:</span>
              <span className="text-orange-600 font-semibold">{fmt(totalSaldo)}</span>
            </div>
          )}
          {/* Anticipo / Desacopio */}
          <div className="flex justify-between w-full text-sm items-center gap-2">
            <span className="text-muted-foreground shrink-0">Anticipo/Desacopio:</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className={`text-[10px] px-2 py-0.5 rounded font-semibold transition-colors ${form.anticipo_monto_manual == null ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                onClick={() => set('anticipo_monto_manual', null)}
              >%</button>
              <button
                type="button"
                className={`text-[10px] px-2 py-0.5 rounded font-semibold transition-colors ${form.anticipo_monto_manual != null ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                onClick={() => set('anticipo_monto_manual', anticipo || 0)}
              >$</button>
              {form.anticipo_monto_manual == null ? (
                <Input type="number" min="0" className="w-20 h-7 text-xs" placeholder="0" value={form.anticipo_pct || ''} onChange={e => set('anticipo_pct', +e.target.value)} />
              ) : (
                <Input type="number" min="0" className="w-28 h-7 text-xs border-amber-500/60 focus:ring-amber-400" value={form.anticipo_monto_manual} onChange={e => set('anticipo_monto_manual', +e.target.value)} />
              )}
            </div>
          </div>
          {anticipo > 0 && (
            <div className="flex justify-between w-full text-xs text-muted-foreground">
              <span>Anticipo {form.anticipo_monto_manual == null ? `(${form.anticipo_pct}%)` : '(monto fijo)'}:</span>
              <span className="text-destructive">-{fmt(anticipo)}</span>
            </div>
          )}

          {/* Fondo de Reparo */}
          <div className="flex justify-between w-full text-sm items-center gap-2">
            <Input
              className="h-7 text-xs w-36 shrink-0"
              placeholder="Fondo de Reparo"
              value={form.fondo_reparo_label}
              onChange={e => set('fondo_reparo_label', e.target.value)}
            />
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className={`text-[10px] px-2 py-0.5 rounded font-semibold transition-colors ${form.fondo_reparo_monto_manual == null ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                onClick={() => set('fondo_reparo_monto_manual', null)}
              >%</button>
              <button
                type="button"
                className={`text-[10px] px-2 py-0.5 rounded font-semibold transition-colors ${form.fondo_reparo_monto_manual != null ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                onClick={() => set('fondo_reparo_monto_manual', fondoReparoMonto || 0)}
              >$</button>
              {form.fondo_reparo_monto_manual == null ? (
                <Input type="number" min="0" className="w-20 h-7 text-xs" placeholder="0" value={form.fondo_reparo_pct || ''} onChange={e => set('fondo_reparo_pct', +e.target.value)} />
              ) : (
                <Input type="number" min="0" className="w-28 h-7 text-xs border-amber-500/60 focus:ring-amber-400" value={form.fondo_reparo_monto_manual} onChange={e => set('fondo_reparo_monto_manual', +e.target.value)} />
              )}
            </div>
          </div>
          {fondoReparoMonto > 0 && (
            <div className="flex justify-between w-full text-xs items-center">
              <span className="text-muted-foreground">
                {form.fondo_reparo_label || 'Fondo de Reparo'} {form.fondo_reparo_monto_manual == null ? `(${form.fondo_reparo_pct}%)` : '(monto fijo)'}: <span className="font-semibold">{fmt(fondoReparoMonto)}</span>
              </span>
              <button
                type="button"
                onClick={() => set('fondo_reparo_aplicar', !form.fondo_reparo_aplicar)}
                className={`text-[10px] px-2.5 py-1 rounded font-semibold transition-colors border ${form.fondo_reparo_aplicar ? 'bg-destructive/10 text-destructive border-destructive/30' : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'}`}
              >
                {form.fondo_reparo_aplicar ? `✓ Descontando -${fmt(fondoReparoMonto)}` : 'Aplicar descuento'}
              </button>
            </div>
          )}
          {pagadoAnteriormente > 0 && (
            <div className="flex justify-between w-full text-xs text-muted-foreground">
              <span>Ya pagado anteriormente ({form.porcentaje_pagado_anteriormente}%):</span>
              <span className="text-destructive">-{fmt(pagadoAnteriormente)}</span>
            </div>
          )}
          <div className="w-full border-t pt-2 flex justify-between font-bold">
            <span>Total Neto:</span><span className="text-primary">{fmt(totalNeto)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}