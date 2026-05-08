import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Pencil, Trash2, Building2, User, DollarSign, Calendar, Hash, ChevronDown, ChevronUp,
  MapPin, UserCheck, Clock, Eye, MessageSquare
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function ObraCertificacionCard({ obra, estadoConfig, prioridadConfig, onEdit, onDelete, onEstadoChange, fmt }) {
  const [expanded, setExpanded] = useState(false);
  const estado = estadoConfig[obra.estado_cobro] || estadoConfig.pendiente;
  const prioridad = prioridadConfig[obra.prioridad] || prioridadConfig.normal;

  const safeDate = (d) => {
    try { return format(new Date(d), 'dd MMM yyyy', { locale: es }); } catch { return d; }
  };

  return (
    <Card className="border-border hover:border-primary/30 transition-colors">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          {/* Info principal */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-wrap items-start gap-2">
              <h3 className="font-semibold text-foreground leading-tight">{obra.titulo}</h3>
              <Badge className={`text-xs border ${estado.color}`}>{estado.label}</Badge>
              {obra.prioridad !== 'normal' && (
                <Badge className={`text-xs ${prioridad.color}`}>{prioridad.label}</Badge>
              )}
              {obra.comuna && (
                <Badge variant="outline" className="text-xs">C. {obra.comuna}</Badge>
              )}
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {obra.establecimiento && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5 shrink-0" />{obra.establecimiento}
                </span>
              )}
              {obra.direccion && obra.direccion !== obra.establecimiento && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />{obra.direccion}
                </span>
              )}
              {obra.jefe_sitio && (
                <span className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5 shrink-0" />{obra.jefe_sitio}
                </span>
              )}
              {obra.inspector && (
                <span className="flex items-center gap-1">
                  <UserCheck className="h-3.5 w-3.5 shrink-0" />{obra.inspector}
                </span>
              )}
              {obra.plazo_dias > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 shrink-0" />{obra.plazo_dias} días
                </span>
              )}
              {obra.periodo && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />{obra.periodo}
                </span>
              )}
            </div>

            {/* N° MTOM / MEIN */}
            {(obra.oc_numero || obra.ada_numero) && (
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {obra.oc_numero && <span className="flex items-center gap-1"><Hash className="h-3 w-3" />MTOM: {obra.oc_numero}</span>}
                {obra.ada_numero && <span className="flex items-center gap-1"><Hash className="h-3 w-3" />MEIN: {obra.ada_numero}</span>}
              </div>
            )}

            {/* Monto y avance */}
            <div className="flex flex-wrap items-center gap-4">
              {obra.monto_contrato > 0 && (
                <span className="flex items-center gap-1 font-semibold text-primary text-sm">
                  <DollarSign className="h-3.5 w-3.5" />
                  {fmt(obra.monto_contrato)}
                </span>
              )}
              {obra.porcentaje_avance > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${Math.min(100, obra.porcentaje_avance)}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{obra.porcentaje_avance}%</span>
                </div>
              )}
            </div>

            {/* Observaciones inline si hay */}
            {obra.notas && (
              <p className="text-xs text-muted-foreground italic border-l-2 border-border pl-2">{obra.notas}</p>
            )}
            {obra.estado_cobro === 'observado' && obra.motivo_observacion && (
              <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-lg bg-slate-500/10 border border-slate-500/20">
                <MessageSquare className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-300"><span className="font-medium">Motivo:</span> {obra.motivo_observacion}</p>
              </div>
            )}
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-2 shrink-0">
            <Select value={obra.estado_cobro} onValueChange={(v) => onEstadoChange(obra.id, v)}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="listo_certificar">✅ Listo para Certificar</SelectItem>
                <SelectItem value="faltan_actas">⚠️ Faltan Cargar Actas</SelectItem>
                <SelectItem value="pendiente">🔴 Pendiente</SelectItem>
                <SelectItem value="observado">⚫ Observado</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(obra)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Detalle expandido */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-muted-foreground">
            {obra.fecha_inicio && <p><span className="font-medium text-foreground">Acta Inicio:</span> {safeDate(obra.fecha_inicio)}</p>}
            {obra.fecha_fin_estimada && <p><span className="font-medium text-foreground">Acta Recepción:</span> {safeDate(obra.fecha_fin_estimada)}</p>}
            {obra.oc_numero && <p><span className="font-medium text-foreground">N° MTOM:</span> {obra.oc_numero}</p>}
            {obra.ada_numero && <p><span className="font-medium text-foreground">N° MEIN:</span> {obra.ada_numero}</p>}
            {obra.jefe_sitio && <p><span className="font-medium text-foreground">Jefe de Sitio:</span> {obra.jefe_sitio}</p>}
            {obra.inspector && <p><span className="font-medium text-foreground">Inspector:</span> {obra.inspector}</p>}
            {obra.plazo_dias > 0 && <p><span className="font-medium text-foreground">Plazo:</span> {obra.plazo_dias} días</p>}
            {obra.monto_a_cobrar > 0 && <p><span className="font-medium text-foreground">A cobrar:</span> {fmt(obra.monto_a_cobrar)}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}