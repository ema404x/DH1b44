import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

const EMPTY = {
  codigo: '', titulo: '', contratista: '', establecimiento: '', jefe_sitio: '',
  oc_numero: '', ada_numero: '', monto_contrato: '', monto_a_cobrar: '',
  porcentaje_avance: '', periodo: '', fecha_inicio: '', fecha_fin_estimada: '',
  estado_cobro: 'pendiente', prioridad: 'normal', descripcion: '', notas: ''
};

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
      {children}
    </div>
  );
}

export default function ObraCertificacionDialog({ open, onClose, obra, onSave, saving }) {
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (obra) {
      setForm({ ...EMPTY, ...obra });
    } else {
      setForm(EMPTY);
    }
  }, [obra, open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      monto_contrato: parseFloat(form.monto_contrato) || 0,
      monto_a_cobrar: parseFloat(form.monto_a_cobrar) || 0,
      porcentaje_avance: parseFloat(form.porcentaje_avance) || 0,
    };
    onSave(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{obra ? 'Editar Obra' : 'Nueva Obra para Cobrar'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Título *">
              <Input required value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Nombre de la obra" />
            </Field>
            <Field label="Código">
              <Input value={form.codigo} onChange={e => set('codigo', e.target.value)} placeholder="Ej: OBR-001" />
            </Field>
            <Field label="Contratista *">
              <Input required value={form.contratista} onChange={e => set('contratista', e.target.value)} placeholder="Nombre del contratista" />
            </Field>
            <Field label="Establecimiento">
              <Input value={form.establecimiento} onChange={e => set('establecimiento', e.target.value)} placeholder="Nombre del establecimiento" />
            </Field>
            <Field label="Jefe de Sitio">
              <Input value={form.jefe_sitio} onChange={e => set('jefe_sitio', e.target.value)} placeholder="Nombre del jefe de sitio" />
            </Field>
            <Field label="Período">
              <Input value={form.periodo} onChange={e => set('periodo', e.target.value)} placeholder="Ej: Mayo 2025" />
            </Field>
            <Field label="N° OC">
              <Input value={form.oc_numero} onChange={e => set('oc_numero', e.target.value)} placeholder="Número de Orden de Compra" />
            </Field>
            <Field label="N° ADA">
              <Input value={form.ada_numero} onChange={e => set('ada_numero', e.target.value)} placeholder="Número de ADA" />
            </Field>
            <Field label="Monto Contrato ($)">
              <Input type="number" value={form.monto_contrato} onChange={e => set('monto_contrato', e.target.value)} placeholder="0" min="0" />
            </Field>
            <Field label="Monto a Cobrar ($)">
              <Input type="number" value={form.monto_a_cobrar} onChange={e => set('monto_a_cobrar', e.target.value)} placeholder="0" min="0" />
            </Field>
            <Field label="% Avance">
              <Input type="number" value={form.porcentaje_avance} onChange={e => set('porcentaje_avance', e.target.value)} placeholder="0" min="0" max="100" />
            </Field>
            <Field label="Estado de Cobro">
              <Select value={form.estado_cobro} onValueChange={v => set('estado_cobro', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="en_gestion">En Gestión</SelectItem>
                  <SelectItem value="cobrado">Cobrado</SelectItem>
                  <SelectItem value="rechazado">Rechazado</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Prioridad">
              <Select value={form.prioridad} onValueChange={v => set('prioridad', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Fecha Inicio">
              <Input type="date" value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)} />
            </Field>
            <Field label="Fecha Fin Estimada">
              <Input type="date" value={form.fecha_fin_estimada} onChange={e => set('fecha_fin_estimada', e.target.value)} />
            </Field>
          </div>
          <Field label="Descripción">
            <textarea
              value={form.descripcion}
              onChange={e => set('descripcion', e.target.value)}
              placeholder="Descripción del trabajo realizado..."
              rows={3}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
          </Field>
          <Field label="Notas">
            <textarea
              value={form.notas}
              onChange={e => set('notas', e.target.value)}
              placeholder="Observaciones adicionales..."
              rows={2}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {obra ? 'Guardar cambios' : 'Crear obra'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}