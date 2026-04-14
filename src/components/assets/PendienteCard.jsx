import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Pencil, Trash2, User, MapPin, Calendar, AlertCircle } from 'lucide-react';
import { differenceInDays, isPast, format } from 'date-fns';
import { es } from 'date-fns/locale';

const tipoIcons = {
  mantenimiento: '🔧',
  obra: '🏗️',
  inspeccion: '🔍',
  emergencia: '🚨',
};

const estadoLabels = {
  pendiente: 'Pendiente',
  asignado: 'Asignado',
  en_progreso: 'En progreso',
  resuelto: 'Resuelto',
  cancelado: 'Cancelado',
};

export default function PendienteCard({ pendiente: p, estadoColors, prioridadColors, onEdit, onDelete }) {
  const isVencido = p.fecha_limite && isPast(new Date(p.fecha_limite)) && p.estado !== 'resuelto' && p.estado !== 'cancelado';
  const diasRestantes = p.fecha_limite ? differenceInDays(new Date(p.fecha_limite), new Date()) : null;

  return (
    <Card className={`group hover:shadow-md transition-shadow cursor-pointer ${isVencido ? 'border-red-300 bg-red-50/30' : ''}`} onClick={() => onEdit(p)}>
      <CardContent className="pt-4 pb-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <span className="text-xl flex-shrink-0 mt-0.5">{tipoIcons[p.tipo] || '📋'}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-tight line-clamp-2">{p.descripcion}</p>
              {p.numero_sap && (
                <p className="text-xs text-muted-foreground font-mono mt-0.5">SAP: {p.numero_sap}</p>
              )}
            </div>
          </div>
          <Badge variant="outline" className={`text-xs border flex-shrink-0 ${estadoColors[p.estado]}`}>
            {estadoLabels[p.estado]}
          </Badge>
        </div>

        {/* Info */}
        <div className="space-y-1.5 text-xs">
          {p.sitio && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{p.sitio}</span>
            </div>
          )}
          {p.jefe_sitio && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <User className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">Jefe: <span className="font-medium text-foreground">{p.jefe_sitio}</span></span>
            </div>
          )}
          {!p.jefe_sitio && (
            <div className="flex items-center gap-1.5 text-yellow-600">
              <AlertCircle className="h-3 w-3 flex-shrink-0" />
              <span>Sin jefe asignado</span>
            </div>
          )}
          {p.fecha_limite && (
            <div className={`flex items-center gap-1.5 ${isVencido ? 'text-red-600 font-medium' : diasRestantes !== null && diasRestantes <= 7 ? 'text-amber-600' : 'text-muted-foreground'}`}>
              <Calendar className="h-3 w-3 flex-shrink-0" />
              <span>
                {isVencido
                  ? `Vencido hace ${Math.abs(diasRestantes)}d`
                  : diasRestantes === 0
                  ? 'Vence hoy'
                  : diasRestantes !== null && diasRestantes > 0
                  ? `Vence en ${diasRestantes}d`
                  : format(new Date(p.fecha_limite), 'dd/MM/yyyy')}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t">
          <Badge className={`text-xs ${prioridadColors[p.prioridad]}`}>
            {p.prioridad}
          </Badge>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(p)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar pendiente?</AlertDialogTitle>
                  <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(p.id)}>Eliminar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}