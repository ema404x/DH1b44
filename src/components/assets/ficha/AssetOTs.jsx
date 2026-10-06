import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, MapPin, CheckCircle2, Wrench, Calendar, Clock, DollarSign } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const statusColors = {
  pendiente: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  asignada: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  en_progreso: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  obra: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  pendiente_validacion: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  completada: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  cancelada: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

export default function AssetOTs({ assetId, assetName }) {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['asset-ots', assetId],
    queryFn: async () => {
      const res = await base44.entities.WorkOrder.filter(
        { $or: [{ asset_id: assetId }, { asset_name: assetName }] },
        { sort: '-created_date', limit: 200 }
      );
      return res.items || [];
    },
    enabled: !!assetId,
  });

  const completed = orders.filter(o => o.status === 'completada').length;
  const totalCost = orders.reduce((s, o) => {
    return s + (o.materials_used || []).reduce((ms, m) => ms + (m.quantity * m.unit_cost || 0), 0);
  }, 0);

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm flex items-center gap-2">
          <ClipboardList className="h-4 w-4" /> Órdenes de Trabajo
        </CardTitle>
        <div className="flex gap-4 text-right">
          <div>
            <div className="text-[10px] text-muted-foreground uppercase">Total</div>
            <div className="text-sm font-bold tabular-nums">{orders.length}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase">Compl.</div>
            <div className="text-sm font-bold tabular-nums text-emerald-400">{completed}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase">Costo</div>
            <div className="text-sm font-bold tabular-nums">{fmt(totalCost)}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-14" />)}</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm">Sin órdenes de trabajo registradas para este activo</p>
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map(order => {
              const matCost = (order.materials_used || []).reduce((s, m) => s + (m.quantity * m.unit_cost || 0), 0);
              return (
                <div key={order.id} className="border border-border/50 rounded-lg p-3 hover:bg-accent/20 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {order.code && <span className="text-[10px] font-mono text-muted-foreground">{order.code}</span>}
                        <Badge variant="outline" className={`text-[10px] ${statusColors[order.status] || statusColors.pendiente}`}>
                          {(order.status || '').replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <p className="text-sm font-semibold mt-0.5 leading-tight">{order.title}</p>
                      {order.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{order.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground flex-wrap">
                    {order.location_qr_name && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {order.location_qr_name}
                      </span>
                    )}
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
                    {order.actual_hours != null && <span>{order.actual_hours}h</span>}
                    {matCost > 0 && (
                      <span className="flex items-center gap-1 font-medium text-primary">
                        <DollarSign className="h-3 w-3" /> {fmt(matCost)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}