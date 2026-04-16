import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  X, Edit2, Check, ClipboardList, FileText, Wrench,
  User, MapPin, Calendar, AlertTriangle, Clock
} from 'lucide-react';
import { format, parseISO, isPast } from 'date-fns';
import { es } from 'date-fns/locale';

const STATUS_LABELS = {
  pendiente: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  asignada: { label: 'Asignada', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  en_progreso: { label: 'En Progreso', cls: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  completada: { label: 'Completada', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  cancelada: { label: 'Cancelada', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  en_preparacion: { label: 'En Preparación', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  enviado: { label: 'Enviado', cls: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  aprobado: { label: 'Aprobado', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  rechazado: { label: 'Rechazado', cls: 'bg-red-100 text-red-700 border-red-200' },
  vencido: { label: 'Vencido', cls: 'bg-rose-100 text-rose-700 border-rose-200' },
};

const PRIORITY_LABELS = {
  urgente: { label: 'Urgente', cls: 'bg-red-100 text-red-700 border-red-200' },
  alta: { label: 'Alta', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  media: { label: 'Media', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  baja: { label: 'Baja', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const TYPE_CONFIG = {
  ot: { label: 'Orden de Trabajo', Icon: ClipboardList, dateField: 'Fecha Programada', canEditDate: true },
  informe: { label: 'Informe', Icon: FileText, dateField: 'Fecha Límite', canEditDate: true },
  maintenance: { label: 'Mantenimiento', Icon: Wrench, dateField: 'Próximo Mantenimiento', canEditDate: false },
};

export default function EventDetailPanel({ event, onClose, onSaveDate, isSaving }) {
  const [editingDate, setEditingDate] = useState(false);
  const [newDate, setNewDate] = useState(event.date);

  const cfg = TYPE_CONFIG[event.type] || TYPE_CONFIG.ot;
  const Icon = cfg.Icon;

  const statusCfg = STATUS_LABELS[event.status] || { label: event.status, cls: 'bg-gray-100 text-gray-600' };
  const priorityCfg = PRIORITY_LABELS[event.priority];

  const overdue = event.date && isPast(parseISO(event.date)) && !['completada', 'aprobado', 'cancelada'].includes(event.status);

  const handleSave = async () => {
    if (newDate !== event.date) {
      await onSaveDate(event, newDate);
    }
    setEditingDate(false);
  };

  const handleCancel = () => {
    setNewDate(event.date);
    setEditingDate(false);
  };

  return (
    <Card className="border-primary/20 shadow-md">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={`h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 ${event.color}`}>
              <Icon className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{cfg.label}</p>
              <CardTitle className="text-sm leading-tight">{event.title}</CardTitle>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 -mt-1" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-3">
        {/* Badges */}
        <div className="flex flex-wrap gap-1.5">
          {statusCfg && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${statusCfg.cls}`}>
              {statusCfg.label}
            </span>
          )}
          {priorityCfg && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${priorityCfg.cls}`}>
              {priorityCfg.label}
            </span>
          )}
          {overdue && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border bg-rose-100 text-rose-700 border-rose-200 flex items-center gap-1">
              <AlertTriangle className="h-2.5 w-2.5" /> Vencida
            </span>
          )}
        </div>

        {/* Date row */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              <Calendar className="h-3 w-3" />
              {cfg.dateField}
            </div>
            {cfg.canEditDate && !editingDate && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setEditingDate(true)}
              >
                <Edit2 className="h-3 w-3" />
              </Button>
            )}
          </div>

          {editingDate ? (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                className="h-7 text-xs flex-1"
              />
              <Button size="icon" className="h-7 w-7" onClick={handleSave} disabled={isSaving}>
                <Check className="h-3 w-3" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCancel}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <p className={`text-sm font-medium ${overdue ? 'text-rose-600' : 'text-foreground'}`}>
              {event.date ? format(parseISO(event.date), "EEEE d 'de' MMMM yyyy", { locale: es }) : '—'}
            </p>
          )}
        </div>

        {/* Assignee */}
        {event.assignee && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              <User className="h-3 w-3" />
              {event.type === 'ot' ? 'Asignado' : event.type === 'informe' ? 'Responsable' : 'Ubicación'}
            </div>
            <p className="text-sm">{event.assignee}</p>
          </div>
        )}

        {/* Location */}
        {event.location && event.location !== event.assignee && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              <MapPin className="h-3 w-3" />
              {event.type === 'informe' ? 'Proyecto' : 'Ubicación'}
            </div>
            <p className="text-sm">{event.location}</p>
          </div>
        )}

        {/* Description (OT) */}
        {event.raw?.description && (
          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Descripción</div>
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{event.raw.description}</p>
          </div>
        )}

        {/* Notes (Informe) */}
        {event.raw?.descripcion && (
          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Descripción</div>
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{event.raw.descripcion}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}