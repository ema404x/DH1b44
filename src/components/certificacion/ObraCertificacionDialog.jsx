import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

const EMPTY = {
  titulo: '', direccion: '', establecimiento: '', comuna: '',
  jefe_sitio: '', inspector: '',
  oc_numero: '', ada_numero: '',
  monto_contrato: '', monto_a_cobrar: '',
  porcentaje_avance: '', plazo_dias: '', periodo: '',
  fecha_inicio: '', fecha_fin_estimada: '',
  estado_cobro: 'pendiente', prioridad: 'normal', notas: ''
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
    setForm(obra ? { ...EMPTY, ...obra } : EMPTY);
  }, [obra, open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      monto_contrato:    parseFloat(form.monto_contrato) || 0,
      monto_a_cobrar:    parseFloat(form.monto_a_cobrar) || 0,
      porcentaje_avance: parseFloat(form.porcentaje_avance) || 0,
      plazo_dias:        parseFloat(form.plazo_dias) || 0,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{obra ? 'Editar Obra' : 'Nueva Obra para Cobrar'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Identificación */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Título / Obra SAP *">
              <Input required value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Título de obra en SAP" />
            </Field>
            <Field label="Comuna">
              <Select value={form.comuna || ''} onValueChange={v => set('comuna', v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="8A">COMUNA 8A</SelectItem>
                  <SelectItem value="8B">COMUNA 8B</SelectItem>
                  <SelectItem value="10A">COMUNA 10A</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Establecimiento">
              <Input value={form.establecimiento} onChange={e => set('establecimiento', e.target.value)} placeholder="Nombre del establecimiento" />
            </Field>
            <Field label="Dirección">
              <Input value={form.direccion} onChange={e => set('direccion', e.target.value)} placeholder="Dirección" />
            </Field>
            <Field label="Jefe de Sitio">
              <Input value={form.jefe_sitio} onChange={e => set('jefe_sitio', e.target.value)} placeholder="Ej: DANA, Daniel" />
            </Field>
            <Field label="Inspector">
              <Input value={form.inspector} onChange={e => set('inspector', e.target.value)} placeholder="Ej: CORTEZ, Abel" />
            </Field>
          </div>

          {/* SAP */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="N° MTOM">
              <Input value={form.oc_numero} onChange={e => set('oc_numero', e.target.value)} placeholder="421441336" />
            </Field>
            <Field label="N° MEIN">
              <Input value={form.ada_numero} onChange={e => set('ada_numero', e.target.value)} placeholder="421475354" />
            </Field>
          </div>

          {/* Financiero */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Monto Base ($)">
              <Input type="number" value={form.monto_contrato} onChange={e => set('monto_contrato', e.target.value)} placeholder="0" min="0" />
            </Field>
            <Field label="Monto a Cobrar ($)">
              <Input type="number" value={form.monto_a_cobrar} onChange={e => set('monto_a_cobrar', e.target.value)} placeholder="0" min="0" />
            </Field>
            <Field label="% Avance">
              <Input type="number" value={form.porcentaje_avance} onChange={e => set('porcentaje_avance', e.target.value)} placeholder="0–100" min="0" max="100" />
            </Field>
          </div>

          {/* Fechas y plazo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Acta de Inicio">
              <Input type="date" value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)} />
            </Field>
            <Field label="Acta de Recepción">
              <Input type="date" value={form.fecha_fin_estimada} onChange={e => set('fecha_fin_estimada', e.target.value)} />
            </Field>
            <Field label="Plazo (días)">
              <Input type="number" value={form.plazo_dias} onChange={e => set('plazo_dias', e.target.value)} placeholder="0" min="0" />
            </Field>
          </div>

          {/* Estado */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Período">
              <Input value={form.periodo} onChange={e => set('periodo', e.target.value)} placeholder="Ej: Abril 2026" />
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
          </div>

          <Field label="Observaciones">
            <textarea
              value={form.notas}
              onChange={e => set('notas', e.target.value)}
              placeholder="Observaciones..."
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