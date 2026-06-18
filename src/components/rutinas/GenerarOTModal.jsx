import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  X, Wrench, Loader2, AlertTriangle, FileText, User,
  Calendar, MapPin, CheckCircle2, ClipboardList, Info
} from 'lucide-react';
import { format, addDays } from 'date-fns';

const PRIORIDADES = [
  { value: 'baja',    label: 'Baja',    cls: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  { value: 'media',   label: 'Media',   cls: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { value: 'alta',    label: 'Alta',    cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  { value: 'urgente', label: 'Urgente', cls: 'bg-red-500/20 text-red-300 border-red-500/30' },
];

const TIPOS = [
  { value: 'mantenimiento_preventivo', label: 'Mantenimiento Preventivo' },
  { value: 'mantenimiento_correctivo', label: 'Mantenimiento Correctivo' },
  { value: 'inspeccion',               label: 'Inspección' },
  { value: 'instalacion',              label: 'Instalación' },
];

function calcPrioridad(orden) {
  if (orden.estado === 'vencida') return 'urgente';
  if (orden.ciclo === 'Semanal' || orden.ciclo === 'Quincenal') return 'alta';
  if (orden.ciclo === 'Mensual') return 'media';
  return 'baja';
}

function buildDescription(orden) {
  return [
    `Rutina de mantenimiento preventivo — Anexo 3 PETP DGMESC.`,
    ``,
    `Edificio: ${orden.edificio_nombre || '—'}`,
    `Rubro: ${orden.rubro_nombre || '—'}`,
    `Ciclo: ${orden.ciclo || '—'}`,
    `Plazo SLA: ${orden.plazo_dias || '—'} días`,
    `Fecha límite: ${orden.fecha_limite || '—'}`,
    orden.acciones ? `\nACCIONES A REALIZAR:\n${orden.acciones}` : '',
    orden.observaciones_tom ? `\nOBSERVACIONES TOM/APH:\n${orden.observaciones_tom}` : '',
    orden.requiere_informe_matriculado ? `\n⚠ Requiere informe firmado por profesional matriculado.` : '',
    orden.carga_sismesc ? `⚠ Requiere carga de comprobante en SISMESC.` : '',
  ].filter(Boolean).join('\n');
}

export default function GenerarOTModal({ orden, onClose, onCreated }) {
  const qc = useQueryClient();

  // Estado del formulario pre-cargado con datos de la rutina
  const [form, setForm] = useState({
    title: `[Rutina] ${orden.rutina_objeto} — ${orden.edificio_nombre || ''}`.trim(),
    type: 'mantenimiento_preventivo',
    priority: calcPrioridad(orden),
    location: orden.edificio_nombre || '',
    scheduled_date: orden.fecha_limite || format(addDays(new Date(), orden.plazo_dias || 15), 'yyyy-MM-dd'),
    assigned_name: '',
    assigned_to: '',
    description: buildDescription(orden),
    notes: '',
  });

  // Empleados disponibles para asignar
  const { data: empleados = [] } = useQuery({
    queryKey: ['empleados-activos'],
    queryFn: () => base44.entities.Employee.filter({ status: 'activo' }),
    staleTime: 300_000,
  });

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const crearOTMutation = useMutation({
    mutationFn: async () => {
      const empleado = empleados.find(e => e.id === form.assigned_to);

      const ot = await base44.entities.WorkOrder.create({
        title: form.title,
        type: form.type,
        status: 'pendiente',
        priority: form.priority,
        location: form.location,
        scheduled_date: form.scheduled_date,
        assigned_to: form.assigned_to || undefined,
        assigned_name: empleado?.full_name || form.assigned_name || undefined,
        description: form.description,
        notes: form.notes ? `${form.notes}\n\nOrdenRutina ID: ${orden.id}` : `OrdenRutina ID: ${orden.id}`,
      });

      // Vincular la OrdenRutina a esta OT
      await base44.entities.OrdenRutina.update(orden.id, {
        work_order_id: ot.id,
        estado: 'en_proceso',
        responsable_nombre: empleado?.full_name || form.assigned_name || undefined,
      });

      return ot;
    },
    onSuccess: (ot) => {
      toast.success('Orden de trabajo creada correctamente');
      qc.invalidateQueries({ queryKey: ['ordenes-rutina'] });
      onCreated(ot);
    },
    onError: (err) => toast.error(err.message || 'Error al crear la OT'),
  });

  const prioridadCfg = PRIORIDADES.find(p => p.value === form.priority) || PRIORIDADES[1];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-2xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl flex flex-col max-h-[92dvh]"
        style={{ background: 'linear-gradient(135deg, #0A2540 0%, #0d2e4a 100%)' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-white/10"
          style={{ background: 'rgba(212,175,55,0.10)' }}>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.3)' }}>
              <Wrench className="h-5 w-5" style={{ color: '#D4AF37' }} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">Nueva Orden de Trabajo</h2>
              <p className="text-xs mt-0.5" style={{ color: '#D4AF37' }}>
                Generada desde Rutina Anexo 3 · {orden.rubro_nombre}
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/60 transition-colors flex-shrink-0 ml-4">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Alerta rutina */}
        <div className="px-6 pt-4">
          <div className="rounded-xl border border-white/8 bg-white/5 px-4 py-3 flex gap-3">
            <Info className="h-4 w-4 text-blue-300 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-white/70 space-y-0.5">
              <p className="font-semibold text-white">{orden.rutina_objeto}</p>
              <p>{orden.edificio_nombre} · Ciclo {orden.ciclo} · SLA {orden.plazo_dias}d · Límite: <span className="tabular-nums font-semibold">{orden.fecha_limite || '—'}</span></p>
              <div className="flex gap-2 mt-1 flex-wrap">
                {orden.requiere_informe_matriculado && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    <FileText className="h-3 w-3" /> Matriculado requerido
                  </span>
                )}
                {orden.carga_sismesc && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                    <ClipboardList className="h-3 w-3" /> SISMESC
                  </span>
                )}
                {orden.estado === 'vencida' && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-500/20 text-red-300 border border-red-500/30 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Vencida
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Body formulario */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Título */}
          <div>
            <label className="text-[10px] uppercase tracking-wider font-semibold text-white/50 block mb-1.5">
              Título de la OT
            </label>
            <Input
              value={form.title}
              onChange={e => set('title', e.target.value)}
              className="bg-white/5 border-white/15 text-white placeholder:text-white/30"
            />
          </div>

          {/* Tipo + Prioridad */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider font-semibold text-white/50 block mb-1.5">
                Tipo
              </label>
              <Select value={form.type} onValueChange={v => set('type', v)}>
                <SelectTrigger className="bg-white/5 border-white/15 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider font-semibold text-white/50 block mb-1.5">
                Prioridad
              </label>
              <Select value={form.priority} onValueChange={v => set('priority', v)}>
                <SelectTrigger className="bg-white/5 border-white/15 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORIDADES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Ubicación + Fecha programada */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider font-semibold text-white/50 flex items-center gap-1.5 mb-1.5">
                <MapPin className="h-3 w-3" /> Ubicación
              </label>
              <Input
                value={form.location}
                onChange={e => set('location', e.target.value)}
                className="bg-white/5 border-white/15 text-white placeholder:text-white/30"
                placeholder="Edificio / dirección"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider font-semibold text-white/50 flex items-center gap-1.5 mb-1.5">
                <Calendar className="h-3 w-3" /> Fecha programada
              </label>
              <Input
                type="date"
                value={form.scheduled_date}
                onChange={e => set('scheduled_date', e.target.value)}
                className="bg-white/5 border-white/15 text-white"
              />
            </div>
          </div>

          {/* Asignar a empleado */}
          <div>
            <label className="text-[10px] uppercase tracking-wider font-semibold text-white/50 flex items-center gap-1.5 mb-1.5">
              <User className="h-3 w-3" /> Asignar a
            </label>
            {empleados.length > 0 ? (
              <Select value={form.assigned_to} onValueChange={v => set('assigned_to', v)}>
                <SelectTrigger className="bg-white/5 border-white/15 text-white">
                  <SelectValue placeholder="Seleccionar técnico / responsable…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sin asignar</SelectItem>
                  {empleados.map(e => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.full_name}{e.specialty ? ` — ${e.specialty}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={form.assigned_name}
                onChange={e => set('assigned_name', e.target.value)}
                className="bg-white/5 border-white/15 text-white placeholder:text-white/30"
                placeholder="Nombre del responsable…"
              />
            )}
          </div>

          {/* Descripción */}
          <div>
            <label className="text-[10px] uppercase tracking-wider font-semibold text-white/50 block mb-1.5">
              Descripción (pre-cargada desde la rutina)
            </label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={7}
              className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-xs text-white/80 placeholder:text-white/30 resize-none outline-none focus:border-yellow-500/40 font-mono leading-relaxed"
            />
          </div>

          {/* Notas adicionales */}
          <div>
            <label className="text-[10px] uppercase tracking-wider font-semibold text-white/50 block mb-1.5">
              Notas adicionales
            </label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={2}
              placeholder="Instrucciones especiales, materiales necesarios, etc."
              className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 resize-none outline-none focus:border-yellow-500/40"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-white/10 bg-black/20">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-[10px] border ${prioridadCfg.cls}`}>
              {prioridadCfg.label}
            </Badge>
            <span className="text-xs text-white/40">
              → {TIPOS.find(t => t.value === form.type)?.label}
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} className="text-white/50 hover:text-white">
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => crearOTMutation.mutate()}
              disabled={crearOTMutation.isPending || !form.title.trim()}
              className="gap-2 font-bold"
              style={{ background: '#D4AF37', color: '#0A2540' }}
            >
              {crearOTMutation.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <CheckCircle2 className="h-4 w-4" />
              }
              Crear Orden de Trabajo
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}