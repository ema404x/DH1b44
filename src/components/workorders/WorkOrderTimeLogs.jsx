import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Plus, Trash2, User } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const typeLabels = { normal: 'Normal', extra: 'Extra', guardia: 'Guardia' };
const typeColors = { normal: 'bg-blue-50 text-blue-700', extra: 'bg-orange-50 text-orange-700', guardia: 'bg-purple-50 text-purple-700' };

const emptyLog = { employee_name: '', date: new Date().toISOString().split('T')[0], hours: 1, description: '', type: 'normal' };

export default function WorkOrderTimeLogs({ workOrderId, workOrderTitle }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyLog);
  const qc = useQueryClient();

  const { data: logs = [] } = useQuery({
    queryKey: ['timelogs', workOrderId],
    queryFn: () => base44.entities.TimeLog.filter({ work_order_id: workOrderId }),
    enabled: !!workOrderId,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.TimeLog.create({ ...data, work_order_id: workOrderId, work_order_title: workOrderTitle }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['timelogs', workOrderId] }); setAdding(false); setForm(emptyLog); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.TimeLog.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timelogs', workOrderId] }),
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const totalHours = logs.reduce((s, l) => s + (l.hours || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Registro de Horas</span>
          {logs.length > 0 && (
            <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              {totalHours}h totales
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5" /> Registrar
        </Button>
      </div>

      {logs.length > 0 && (
        <div className="space-y-1.5">
          {logs.map(log => (
            <div key={log.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/40 group">
              <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium">{log.employee_name}</div>
                {log.description && <div className="text-[10px] text-muted-foreground truncate">{log.description}</div>}
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${typeColors[log.type]}`}>{typeLabels[log.type]}</span>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {log.date ? format(parseISO(log.date), 'd MMM', { locale: es }) : ''}
              </span>
              <span className="text-xs font-bold text-foreground flex-shrink-0 w-10 text-right">{log.hours}h</span>
              <Button
                variant="ghost" size="icon" className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100 flex-shrink-0"
                onClick={() => deleteMutation.mutate(log.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="border border-border rounded-lg p-3 space-y-2 bg-muted/20">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Nuevo registro</p>
          <div>
            <p className="text-[10px] text-muted-foreground mb-1">Técnico</p>
            {employees.length > 0 ? (
              <Select value={form.employee_name} onValueChange={v => set('employee_name', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar técnico..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__manual__" className="text-xs italic text-muted-foreground">— Escribir manualmente —</SelectItem>
                  {employees.map(e => <SelectItem key={e.id} value={e.full_name} className="text-xs">{e.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : null}
            {(employees.length === 0 || form.employee_name === '__manual__' || (form.employee_name && !employees.find(e => e.full_name === form.employee_name))) && (
              <Input
                className="h-8 text-xs mt-1"
                value={form.employee_name === '__manual__' ? '' : form.employee_name}
                onChange={e => set('employee_name', e.target.value)}
                placeholder="Nombre del técnico"
              />
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Fecha</p>
              <Input type="date" className="h-8 text-xs" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Horas</p>
              <Input type="number" step="0.5" className="h-8 text-xs" value={form.hours} onChange={e => set('hours', parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Tipo</p>
              <Select value={form.type} onValueChange={v => set('type', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Input className="h-8 text-xs" placeholder="Descripción del trabajo..." value={form.description} onChange={e => set('description', e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 h-7 text-xs" onClick={() => createMutation.mutate(form)} disabled={!form.employee_name || createMutation.isPending}>
              {createMutation.isPending ? 'Guardando...' : 'Registrar'}
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAdding(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {logs.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground text-center py-2">Sin horas registradas</p>
      )}
    </div>
  );
}