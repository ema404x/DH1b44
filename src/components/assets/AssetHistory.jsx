import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Clock, CheckCircle2, AlertTriangle, Wrench, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const statusColors = {
  pendiente: 'bg-slate-100 text-slate-600', asignada: 'bg-blue-100 text-blue-700',
  en_progreso: 'bg-indigo-100 text-indigo-700', completada: 'bg-emerald-100 text-emerald-700',
  cancelada: 'bg-red-100 text-red-600',
};
const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

export default function AssetHistory({ assetName }) {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['workorders_asset', assetName],
    queryFn: () => base44.entities.WorkOrder.filter({ asset_name: assetName }),
    enabled: !!assetName,
  });

  const totalCost = orders.reduce((s, o) => {
    const matCost = (o.materials_used || []).reduce((ms, m) => ms + (m.quantity * m.unit_cost || 0), 0);
    return s + matCost;
  }, 0);

  const completed = orders.filter(o => o.status === 'completada').length;

  if (isLoading) return <div className="text-xs text-muted-foreground text-center py-4">Cargando historial...</div>;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-blue-700">{orders.length}</div>
          <div className="text-[10px] text-muted-foreground uppercase font-semibold">OTs Totales</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-emerald-700">{completed}</div>
          <div className="text-[10px] text-muted-foreground uppercase font-semibold">Completadas</div>
        </div>
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-center">
          <div className="text-sm font-bold text-primary">{fmt(totalCost)}</div>
          <div className="text-[10px] text-muted-foreground uppercase font-semibold">Costo Total</div>
        </div>
      </div>

      {/* Timeline */}
      {orders.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-20" />
          <p className="text-sm">Sin órdenes de trabajo registradas</p>
        </div>
      ) : (
        <div className="relative space-y-3">
          <div className="absolute left-3.5 top-0 bottom-0 w-px bg-border" />
          {orders.map(order => {
            const matCost = (order.materials_used || []).reduce((s, m) => s + (m.quantity * m.unit_cost || 0), 0);
            return (
              <div key={order.id} className="flex gap-4 relative">
                <div className={`flex-shrink-0 h-7 w-7 rounded-full border-2 flex items-center justify-center z-10 ${order.status === 'completada' ? 'bg-emerald-500 border-emerald-500' : 'bg-card border-border'}`}>
                  {order.status === 'completada'
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                    : <Wrench className="h-3 w-3 text-muted-foreground" />
                  }
                </div>
                <div className="flex-1 pb-3">
                  <div className="bg-card border border-border rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {order.code && <span className="text-[10px] font-mono text-muted-foreground">{order.code}</span>}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${statusColors[order.status]}`}>
                            {order.status?.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-sm font-semibold mt-0.5 leading-tight">{order.title}</p>
                        {order.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{order.description}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground flex-wrap">
                      {order.scheduled_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(parseISO(order.scheduled_date), 'd MMM yyyy', { locale: es })}
                        </span>
                      )}
                      {order.assigned_name && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {order.assigned_name}
                        </span>
                      )}
                      {order.actual_hours && <span>{order.actual_hours}h trabajadas</span>}
                      {matCost > 0 && <span className="font-medium text-primary">{fmt(matCost)} en materiales</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}