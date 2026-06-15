import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Building2, User, DollarSign, TrendingUp, Paperclip, Clock, CheckCircle2, XCircle, Eye, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useResolveNames } from '@/hooks/useResolveNames';

const estadoConfig = {
  borrador:    { label: 'Borrador',     color: 'bg-slate-100 text-slate-600 border-slate-300' },
  enviada:     { label: 'Enviada',      color: 'bg-blue-100 text-blue-700 border-blue-300' },
  en_revision: { label: 'En revisión',  color: 'bg-amber-100 text-amber-700 border-amber-300' },
  aprobada:    { label: 'Aprobada',     color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  rechazada:   { label: 'Rechazada',    color: 'bg-red-100 text-red-700 border-red-300' },
};

const prioridadConfig = {
  normal:  { label: 'Normal',  color: 'bg-slate-100 text-slate-500' },
  alta:    { label: 'Alta',    color: 'bg-orange-100 text-orange-600' },
  urgente: { label: 'Urgente', color: 'bg-red-100 text-red-700 font-bold' },
};

export default function SolicitudCard({ solicitud, onView, onEdit, onDelete, isAdmin }) {
  const { resolve } = useResolveNames();
  const estado = estadoConfig[solicitud.estado] || estadoConfig.borrador;
  const prioridad = prioridadConfig[solicitud.prioridad] || prioridadConfig.normal;
  const canEdit = !isAdmin && (solicitud.estado === 'borrador' || solicitud.estado === 'rechazada');

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {solicitud.numero && <span className="text-xs font-mono text-muted-foreground">{solicitud.numero}</span>}
              <Badge variant="outline" className={`text-[10px] border ${estado.color}`}>{estado.label}</Badge>
              <Badge variant="outline" className={`text-[10px] ${prioridad.color}`}>{prioridad.label}</Badge>
            </div>
            <h3 className="font-semibold text-sm leading-tight truncate">{solicitud.titulo}</h3>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 truncate">
            <Building2 className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{solicitud.establecimiento || '—'}</span>
          </span>
          <span className="flex items-center gap-1.5 truncate">
            <User className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{resolve(solicitud.jefe_sitio) || '—'}</span>
          </span>
          {solicitud.monto_solicitado > 0 && (
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <DollarSign className="h-3 w-3 flex-shrink-0" />
              {solicitud.monto_solicitado.toLocaleString('es-AR')}
            </span>
          )}
          {solicitud.porcentaje_avance > 0 && (
            <span className="flex items-center gap-1.5">
              <TrendingUp className="h-3 w-3 flex-shrink-0" />
              {solicitud.porcentaje_avance}% avance
            </span>
          )}
          {solicitud.periodo && (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3 flex-shrink-0" />
              {solicitud.periodo}
            </span>
          )}
          {solicitud.adjuntos?.length > 0 && (
            <span className="flex items-center gap-1.5">
              <Paperclip className="h-3 w-3 flex-shrink-0" />
              {solicitud.adjuntos.length} adjunto(s)
            </span>
          )}
        </div>

        {solicitud.estado === 'aprobada' && solicitud.aprobado_por && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
            Aprobado por {resolve(solicitud.aprobado_por)}
            {solicitud.fecha_aprobacion && <span className="text-muted-foreground ml-1">· {format(new Date(solicitud.fecha_aprobacion), 'dd MMM yy', { locale: es })}</span>}
          </div>
        )}

        {solicitud.estado === 'rechazada' && solicitud.motivo_rechazo && (
          <div className="flex items-start gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-2.5 py-1.5">
            <XCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            <span>{solicitud.motivo_rechazo}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {format(new Date(solicitud.created_date), 'dd/MM/yy HH:mm')}
          </span>
          <div className="flex gap-2">
            {canEdit && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => onEdit(solicitud)}>
                Editar
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => onView(solicitud)}>
              <Eye className="h-3.5 w-3.5" /> Ver detalle
            </Button>
            {isAdmin && onDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => {
                  if (window.confirm(`¿Eliminar la solicitud "${solicitud.titulo}"? Esta acción no se puede deshacer.`)) {
                    onDelete(solicitud.id);
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}