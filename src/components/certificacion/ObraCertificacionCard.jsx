import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Pencil, Trash2, Building2, User, DollarSign, Calendar, Hash, ChevronDown, ChevronUp
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function ObraCertificacionCard({ obra, estadoConfig, prioridadConfig, onEdit, onDelete, onEstadoChange, fmt }) {
  const [expanded, setExpanded] = useState(false);
  const estado = estadoConfig[obra.estado_cobro] || estadoConfig.pendiente;
  const prioridad = prioridadConfig[obra.prioridad] || prioridadConfig.normal;

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
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {obra.contratista && (
                <span className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />{obra.contratista}
                </span>
              )}
              {obra.establecimiento && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />{obra.establecimiento}
                </span>
              )}
              {obra.periodo && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />{obra.periodo}
                </span>
              )}
              {obra.codigo && (
                <span className="flex items-center gap-1">
                  <Hash className="h-3.5 w-3.5" />{obra.codigo}
                </span>
              )}
            </div>

            {/* Monto y avance */}
            <div className="flex flex-wrap items-center gap-4">
              {obra.monto_a_cobrar > 0 && (
                <span className="flex items-center gap-1 font-semibold text-primary text-sm">
                  <DollarSign className="h-3.5 w-3.5" />
                  {fmt(obra.monto_a_cobrar)}
                </span>
              )}
              {obra.monto_contrato > 0 && obra.monto_a_cobrar !== obra.monto_contrato && (
                <span className="text-xs text-muted-foreground">
                  Contrato: {fmt(obra.monto_contrato)}
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
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-2 shrink-0">
            <Select value={obra.estado_cobro} onValueChange={(v) => onEstadoChange(obra.id, v)}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="en_gestion">En Gestión</SelectItem>
                <SelectItem value="cobrado">Cobrado</SelectItem>
                <SelectItem value="rechazado">Rechazado</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
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
          <div className="mt-3 pt-3 border-t border-border space-y-2 text-sm text-muted-foreground">
            {obra.oc_numero && <p><span className="font-medium text-foreground">OC:</span> {obra.oc_numero}</p>}
            {obra.ada_numero && <p><span className="font-medium text-foreground">ADA:</span> {obra.ada_numero}</p>}
            {obra.jefe_sitio && <p><span className="font-medium text-foreground">Jefe de Sitio:</span> {obra.jefe_sitio}</p>}
            {obra.fecha_inicio && <p><span className="font-medium text-foreground">Inicio:</span> {format(new Date(obra.fecha_inicio), 'dd MMM yyyy', { locale: es })}</p>}
            {obra.fecha_fin_estimada && <p><span className="font-medium text-foreground">Fin estimado:</span> {format(new Date(obra.fecha_fin_estimada), 'dd MMM yyyy', { locale: es })}</p>}
            {obra.descripcion && <p><span className="font-medium text-foreground">Descripción:</span> {obra.descripcion}</p>}
            {obra.notas && <p><span className="font-medium text-foreground">Notas:</span> {obra.notas}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}