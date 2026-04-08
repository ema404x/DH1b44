import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Plus, Trash2, Download, FileCheck, Loader2, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import RubroSection from '@/components/presupuestos/RubroSection';
import PresupuestoResumen from '@/components/presupuestos/PresupuestoResumen';
import { generatePresupuestoPDF } from '@/components/presupuestos/presupuestoPDF';
import { exportPresupuestoExcel } from '@/utils/exportExcel';
import { base44 } from '@/api/base44Client';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

const estadoOptions = ['borrador','enviado','aprobado','rechazado'];

function generateCode() {
  return `PPTO-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
}

export default function PresupuestoEditor({ presupuesto, precario, onSave, onCancel, saving }) {
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
    preciario_fecha: '2023-02-01',
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

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const updateRubros = (rubros) => {
    const subtotal = rubros.reduce((acc, r) =>
      acc + r.items.reduce((a, i) => a + (i.total || 0), 0), 0
    );
    const gg = subtotal * (form.gastos_generales_pct / 100);
    const ben = (subtotal + gg) * (form.beneficio_pct / 100);
    const baseImponible = subtotal + gg + ben;
    const iva = baseImponible * (form.iva_pct / 100);
    const total = baseImponible + iva;
    setForm(p => ({ ...p, rubros, subtotal, total }));
  };

  const handleAddRubro = () => {
    const newRubros = [...(form.rubros || []), { nombre: `Rubro ${(form.rubros || []).length + 1}`, items: [] }];
    updateRubros(newRubros);
  };

  const handleChangeRubro = (idx, rubro) => {
    const rubros = [...(form.rubros || [])];
    rubros[idx] = rubro;
    updateRubros(rubros);
  };

  const handleDeleteRubro = (idx) => {
    const rubros = (form.rubros || []).filter((_, i) => i !== idx);
    updateRubros(rubros);
  };

  // Recalculate when percentages change
  const handlePctChange = (key, val) => {
    const updated = { ...form, [key]: val };
    const subtotal = (updated.rubros || []).reduce((acc, r) =>
      acc + r.items.reduce((a, i) => a + (i.total || 0), 0), 0
    );
    const gg = subtotal * (updated.gastos_generales_pct / 100);
    const ben = (subtotal + gg) * (updated.beneficio_pct / 100);
    const baseImponible = subtotal + gg + ben;
    const iva = baseImponible * (updated.iva_pct / 100);
    const total = baseImponible + iva;
    setForm({ ...updated, subtotal, total });
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
      // mark presupuesto as facturado
      onSave({ ...form, estado: 'facturado', factura_id: invoice.id });
      toast.success('Factura generada correctamente');
    } catch {
      toast.error('Error al generar la factura');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={onCancel}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-xl font-bold">
              {presupuesto ? `Editar: ${presupuesto.codigo}` : 'Nuevo Presupuesto'}
            </h1>
            <p className="text-sm text-muted-foreground">Presupuesto basado en Precario Ministerial</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => generatePresupuestoPDF(form)}>
            <Download className="h-3.5 w-3.5 mr-1" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportPresupuestoExcel(form)} className="border-emerald-400 text-emerald-700 hover:bg-emerald-50">
            <Download className="h-3.5 w-3.5 mr-1" /> Excel Ministerio
          </Button>
          {form.estado === 'aprobado' && !form.factura_id && (
            <Button variant="outline" size="sm" className="border-emerald-500 text-emerald-700 hover:bg-emerald-50" onClick={handleGenerateInvoice}>
              <FileCheck className="h-3.5 w-3.5 mr-1" /> Generar Factura
            </Button>
          )}
          <Select value={form.estado} onValueChange={v => set('estado', v)}>
            <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{estadoOptions.map(o => <SelectItem key={o} value={o} className="capitalize">{o}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" onClick={() => onSave(form)} disabled={saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Guardar
          </Button>
        </div>
      </div>

      {/* Datos generales */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Datos Generales</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5"><Label className="text-xs">Código</Label><Input value={form.codigo || ''} onChange={e => set('codigo', e.target.value)} className="font-mono" /></div>
            <div className="col-span-2 space-y-1.5"><Label className="text-xs">Título *</Label><Input value={form.titulo || ''} onChange={e => set('titulo', e.target.value)} placeholder="Ej: Remodelación oficinas planta alta" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Cliente / Comitente</Label><Input value={form.cliente_nombre || ''} onChange={e => set('cliente_nombre', e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Proyecto / Escuela</Label><Input value={form.proyecto_nombre || ''} onChange={e => set('proyecto_nombre', e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Responsable / Supervisor</Label><Input value={form.responsable || ''} onChange={e => set('responsable', e.target.value)} /></div>
            <div className="col-span-2 space-y-1.5"><Label className="text-xs">Dirección de Obra</Label><Input value={form.direccion_obra || ''} onChange={e => set('direccion_obra', e.target.value)} /></div>
            <div className="col-span-3 space-y-1.5"><Label className="text-xs">Licitación</Label><Input value={form.licitacion || ''} onChange={e => set('licitacion', e.target.value)} placeholder="Ej: LICIT. PÚBLICA Nº 558-0158-LPU22" /></div>
            <div className="space-y-1.5">
              <Label className="text-xs">Comuna (Preciario)</Label>
              <Select value={form.comuna || '8A'} onValueChange={v => set('comuna', v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="8A">Comuna 8A</SelectItem>
                  <SelectItem value="8B">Comuna 8B</SelectItem>
                  <SelectItem value="10A">Comuna 10A</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Coef. Pase</Label><Input type="number" step="0.0001" value={form.coef_pase || 1.6504} onChange={e => set('coef_pase', parseFloat(e.target.value) || 1.6504)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Coef. Oferta</Label><Input type="number" step="0.01" value={form.coef_oferta || 1.38} onChange={e => set('coef_oferta', parseFloat(e.target.value) || 1.38)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Plazo de Obra</Label><Input value={form.plazo || ''} onChange={e => set('plazo', e.target.value)} placeholder="Ej: 180 días corridos" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Fecha Preciario</Label><Input type="date" value={form.preciario_fecha || ''} onChange={e => set('preciario_fecha', e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Fecha Emisión</Label><Input type="date" value={form.fecha_emision || ''} onChange={e => set('fecha_emision', e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Válido Hasta</Label><Input type="date" value={form.fecha_validez || ''} onChange={e => set('fecha_validez', e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      {/* Rubros / Ítems */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Rubros e Ítems</h2>
          <Button size="sm" variant="outline" onClick={handleAddRubro}><Plus className="h-3.5 w-3.5 mr-1" />Agregar Rubro</Button>
        </div>
        {(form.rubros || []).map((rubro, idx) => (
          <RubroSection
            key={idx}
            rubro={rubro}
            idx={idx}
            precario={precario}
            onChange={(r) => handleChangeRubro(idx, r)}
            onDelete={() => handleDeleteRubro(idx)}
          />
        ))}
      </div>

      {/* Resumen financiero */}
      <PresupuestoResumen form={form} onPctChange={handlePctChange} />

      {/* Notas */}
      <Card>
        <CardContent className="pt-4">
          <Label className="text-xs">Notas / Condiciones</Label>
          <Textarea className="mt-1.5" rows={3} value={form.notas || ''} onChange={e => set('notas', e.target.value)} placeholder="Condiciones de pago, alcance del trabajo, exclusiones..." />
        </CardContent>
      </Card>
    </div>
  );
}