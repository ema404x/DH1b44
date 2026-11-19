import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PRIORIDADES, TIPOS } from '@/lib/propuestasOT';

// Campos editables de la propuesta. disabled = solo lectura.
export default function PropuestaCampos({ form, onChange, disabled }) {
  const set = (k) => (v) => onChange({ ...form, [k]: v });
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs">Título</Label>
        <Input value={form.titulo} onChange={(e) => set('titulo')(e.target.value)} disabled={disabled} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Descripción</Label>
        <Textarea rows={3} value={form.descripcion} onChange={(e) => set('descripcion')(e.target.value)} disabled={disabled} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Prioridad</Label>
          <Select value={form.prioridad} onValueChange={set('prioridad')} disabled={disabled}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(PRIORIDADES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Tipo</Label>
          <Select value={form.tipo} onValueChange={set('tipo')} disabled={disabled}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(TIPOS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Fecha sugerida</Label>
        <Input type="date" value={form.fecha_sugerida} onChange={(e) => set('fecha_sugerida')(e.target.value)} disabled={disabled} />
      </div>
    </div>
  );
}