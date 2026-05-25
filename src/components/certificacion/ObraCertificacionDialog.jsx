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
  estado_cobro: 'pendiente', prioridad: 'normal',
  tramo_certificacion: '',
  color_avance: 'auto',
  motivo_observacion: '', notas: ''
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
    if (!obra) { setForm(EMPTY); return; }
    const roundNum = (v, decimals = 2) => {
      const n = parseFloat(v);
      if (isNaN(n)) return '';
      return parseFloat(n.toFixed(decimals));
    };
    setForm({
      ...EMPTY,
      ...obra,
      monto_contrato:    obra.monto_contrato    != null ? roundNum(obra.monto_contrato, 2)    : '',
      monto_a_cobrar:    obra.monto_a_cobrar    != null ? roundNum(obra.monto_a_cobrar, 2)    : '',
      porcentaje_avance: obra.porcentaje_avance != null ? roundNum(obra.porcentaje_avance, 1) : '',
      plazo_dias:        obra.plazo_dias        != null ? roundNum(obra.plazo_dias, 0)        : '',
      color_avance:      obra.color_avance      || 'auto',
      tramo_certificacion: obra.tramo_certificacion || '',
      fecha_inicio:      obra.fecha_inicio       || '',
      fecha_fin_estimada: obra.fecha_fin_estimada || '',
      periodo:           obra.periodo            || '',
      motivo_observacion: obra.motivo_observacion || '',
      notas:             obra.notas              || '',
    });
  }, [obra, open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const parsedForm = {
      ...form,
      monto_contrato:    parseFloat(form.monto_contrato) || 0,
      monto_a_cobrar:    parseFloat(form.monto_a_cobrar) || 0,
      porcentaje_avance: parseFloat(form.porcentaje_avance) || 0,
      plazo_dias:        parseFloat(form.plazo_dias) || 0,
    };

    onSave(parsedForm);
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
              <Input type="text" inputMode="decimal" value={form.monto_contrato} onChange={e => set('monto_contrato', e.target.value)} placeholder="0" />
            </Field>
            <Field label="Monto a Cobrar ($)">
              <Input type="text" inputMode="decimal" value={form.monto_a_cobrar} onChange={e => set('monto_a_cobrar', e.target.value)} placeholder="0" />
            </Field>
            <Field label="% Avance">
              <Input type="text" inputMode="decimal" value={form.porcentaje_avance} onChange={e => set('porcentaje_avance', e.target.value)} placeholder="0–100" />
              {form.porcentaje_avance > 0 && (
                <div className="mt-1.5 text-xs font-semibold">
                  {parseFloat(form.porcentaje_avance) >= 100
                    ? <span className="text-emerald-400">Completado (100%)</span>
                    : parseFloat(form.porcentaje_avance) > 50
                      ? <span className="text-orange-400">Segundo 50%</span>
                      : <span className="text-yellow-400">Primer 50%</span>}
                </div>
              )}
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
              <Input type="text" inputMode="numeric" value={form.plazo_dias} onChange={e => set('plazo_dias', e.target.value)} placeholder="0" />
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
                  <SelectItem value="listo_certificar">✅ Listo para Certificar</SelectItem>
                  <SelectItem value="faltan_actas">⚠️ Faltan Cargar Actas</SelectItem>
                  <SelectItem value="pendiente">🔴 Pendiente</SelectItem>
                  <SelectItem value="observado">⚫ Observado</SelectItem>
                  <SelectItem value="falta_aprobar_mein">🟣 Falta Aprobar Orden MEIN</SelectItem>
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


          {form.estado_cobro === 'observado' && (
            <Field label="Motivo de observación *">
              <textarea
                value={form.motivo_observacion}
                onChange={e => set('motivo_observacion', e.target.value)}
                placeholder="Explicá brevemente por qué está observada esta obra..."
                rows={2}
                className="w-full rounded-md border border-yellow-500/40 bg-yellow-500/5 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-yellow-500/50 resize-none"
              />
            </Field>
          )}

          <Field label="Notas internas">
            <textarea
              value={form.notas}
              onChange={e => set('notas', e.target.value)}
              placeholder="Notas adicionales..."
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