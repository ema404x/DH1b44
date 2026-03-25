import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, Clock, Bell } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

export default function InformesAlertas({ informes }) {
  const today = new Date();

  const vencidos = informes.filter(i =>
    i.fecha_limite && new Date(i.fecha_limite) < today && !['enviado', 'aprobado'].includes(i.estado)
  );

  const proximosAVencer = informes.filter(i => {
    if (!i.fecha_limite || ['enviado', 'aprobado'].includes(i.estado)) return false;
    const days = differenceInDays(new Date(i.fecha_limite), today);
    return days >= 0 && days <= 5;
  });

  const urgentes = informes.filter(i => i.prioridad === 'urgente' && !['enviado', 'aprobado'].includes(i.estado));

  if (vencidos.length === 0 && proximosAVencer.length === 0 && urgentes.length === 0) return null;

  return (
    <div className="space-y-3">
      {vencidos.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-red-800 text-sm">
                  {vencidos.length} informe{vencidos.length > 1 ? 's' : ''} vencido{vencidos.length > 1 ? 's' : ''} sin entregar
                </p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {vencidos.map(i => (
                    <span key={i.id} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                      {i.titulo} · venció {format(new Date(i.fecha_limite), 'dd/MM/yy')}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {proximosAVencer.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-amber-800 text-sm">
                  {proximosAVencer.length} informe{proximosAVencer.length > 1 ? 's' : ''} vence{proximosAVencer.length > 1 ? 'n' : ''} en los próximos 5 días
                </p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {proximosAVencer.map(i => {
                    const days = differenceInDays(new Date(i.fecha_limite), today);
                    return (
                      <span key={i.id} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                        {i.titulo} · {days === 0 ? 'hoy' : `en ${days}d`}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {urgentes.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Bell className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-orange-800 text-sm">
                  {urgentes.length} informe{urgentes.length > 1 ? 's' : ''} marcado{urgentes.length > 1 ? 's' : ''} como urgente
                </p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {urgentes.map(i => (
                    <span key={i.id} className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                      {i.titulo}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}