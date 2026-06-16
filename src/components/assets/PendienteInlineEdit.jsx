import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Check, X, ChevronDown, Loader2 } from 'lucide-react';

const ESTADO_OPTS = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'asignado', label: 'Asignado' },
  { value: 'en_progreso', label: 'En progreso' },
  { value: 'resuelto', label: 'Resuelto' },
  { value: 'cancelado', label: 'Cancelado' },
];

const PRIORIDAD_OPTS = [
  { value: 'baja', label: 'Baja' },
  { value: 'media', label: 'Media' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' },
];

/**
 * Inline quick-edit panel that slides below the card.
 * Edits: estado, prioridad, jefe_sitio, observaciones
 */
export default function PendienteInlineEdit({ pendiente, onSave, onClose, isSaving }) {
  const [form, setForm] = useState({
    estado: pendiente.estado || 'pendiente',
    prioridad: pendiente.prioridad || 'media',
    jefe_sitio: pendiente.jefe_sitio || '',
    observaciones: pendiente.observaciones || '',
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-list'],
    queryFn: () => base44.entities.Employee.list(),
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const hasChanges =
    form.estado !== pendiente.estado ||
    form.prioridad !== pendiente.prioridad ||
    form.jefe_sitio !== (pendiente.jefe_sitio || '') ||
    form.observaciones !== (pendiente.observaciones || '');

  const handleSave = () => {
    const emp = employees.find(e => e.full_name === form.jefe_sitio);
    onSave({
      ...form,
      ...(emp?.email ? { jefe_sitio_email: emp.email } : {}),
      // auto-promote to asignado if jefe was set
      ...(form.jefe_sitio && pendiente.estado === 'pendiente' && form.estado === 'pendiente'
        ? { estado: 'asignado' }
        : {}),
    });
  };

  return (
    <div
      className="border-t border-border bg-muted/30 rounded-b-lg px-4 pt-3 pb-3 space-y-3 animate-in slide-in-from-top-2 duration-150"
      onClick={e => e.stopPropagation()}
    >
      <div className="grid grid-cols-2 gap-2">
        {/* Estado */}
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase">Estado</p>
          <Select value={form.estado} onValueChange={v => set('estado', v)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ESTADO_OPTS.map(o => (
                <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Prioridad */}
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase">Prioridad</p>
          <Select value={form.prioridad} onValueChange={v => set('prioridad', v)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORIDAD_OPTS.map(o => (
                <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Jefe de sitio */}
      <div className="space-y-1">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase">Jefe de Sitio</p>
        <Select value={form.jefe_sitio || ''} onValueChange={v => set('jefe_sitio', v)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Sin asignar..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null} className="text-xs text-muted-foreground">Sin asignar</SelectItem>
            {employees.map(e => (
              <SelectItem key={e.id} value={e.full_name} className="text-xs">{e.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Observaciones rápidas */}
      <div className="space-y-1">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase">Observaciones</p>
        <Input
          className="h-8 text-xs"
          value={form.observaciones}
          onChange={e => set('observaciones', e.target.value)}
          placeholder="Nota rápida..."
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          className="flex-1 h-7 text-xs gap-1"
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
        >
          {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          Guardar
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={onClose}>
          <X className="h-3 w-3" /> Cancelar
        </Button>
      </div>
    </div>
  );
}