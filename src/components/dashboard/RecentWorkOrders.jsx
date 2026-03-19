import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import StatusBadge from '@/components/shared/StatusBadge';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

export default function RecentWorkOrders({ orders }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Órdenes Recientes</CardTitle>
          <Link to="/ordenes" className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
            Ver todas <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {orders.slice(0, 5).map((order) => (
          <div key={order.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{order.title}</p>
              <p className="text-xs text-muted-foreground">
                {order.assigned_name || 'Sin asignar'} · {order.scheduled_date ? format(new Date(order.scheduled_date), 'dd/MM/yyyy') : 'Sin fecha'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge value={order.priority} type="priority" />
              <StatusBadge value={order.status} />
            </div>
          </div>
        ))}
        {orders.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No hay órdenes de trabajo</p>
        )}
      </CardContent>
    </Card>
  );
}