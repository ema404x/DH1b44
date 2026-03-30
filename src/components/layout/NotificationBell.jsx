import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, AlertTriangle, Info, CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { differenceInDays, isPast, parseISO } from 'date-fns';

const typeIcons = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle2,
  error: AlertTriangle,
};
const typeColors = {
  info: 'text-blue-500',
  warning: 'text-amber-500',
  success: 'text-emerald-500',
  error: 'text-red-500',
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => base44.entities.Notification.list('-created_date', 30),
  });

  const { data: orders = [] } = useQuery({ queryKey: ['workorders'], queryFn: () => base44.entities.WorkOrder.list() });
  const { data: materials = [] } = useQuery({ queryKey: ['materials'], queryFn: () => base44.entities.Material.list() });
  const { data: assets = [] } = useQuery({ queryKey: ['assets'], queryFn: () => base44.entities.Asset.list() });
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: () => base44.entities.Invoice.list() });

  const markReadMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.update(id, { read: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  // Auto-generate system alerts
  const systemAlerts = useMemo(() => {
    const alerts = [];

    // Overdue work orders
    const overdueOrders = orders.filter(o => o.scheduled_date && isPast(parseISO(o.scheduled_date)) && !['completada','cancelada'].includes(o.status));
    if (overdueOrders.length > 0) alerts.push({ id: 'ot-overdue', title: `${overdueOrders.length} OT${overdueOrders.length > 1 ? 's' : ''} vencida${overdueOrders.length > 1 ? 's' : ''}`, message: 'Órdenes de trabajo con fecha pasada sin completar', type: 'warning', read: false });

    // Low stock
    const lowStock = materials.filter(m => m.stock <= m.min_stock && m.min_stock > 0);
    if (lowStock.length > 0) alerts.push({ id: 'stock-low', title: 'Stock bajo detectado', message: `${lowStock.length} material${lowStock.length > 1 ? 'es' : ''} por debajo del mínimo`, type: 'warning', read: false });

    // Overdue maintenance
    const overdueAssets = assets.filter(a => a.next_maintenance && isPast(parseISO(a.next_maintenance)));
    if (overdueAssets.length > 0) alerts.push({ id: 'maint-overdue', title: `${overdueAssets.length} mantenimiento${overdueAssets.length > 1 ? 's' : ''} vencido${overdueAssets.length > 1 ? 's' : ''}`, message: 'Activos con mantenimiento programado vencido', type: 'error', read: false });

    // Overdue invoices
    const overdueInvoices = invoices.filter(i => i.status === 'vencida' || (i.due_date && isPast(parseISO(i.due_date)) && i.status === 'pendiente'));
    if (overdueInvoices.length > 0) alerts.push({ id: 'invoice-overdue', title: 'Facturas vencidas', message: `${overdueInvoices.length} factura${overdueInvoices.length > 1 ? 's' : ''} pendiente${overdueInvoices.length > 1 ? 's' : ''} de cobro`, type: 'error', read: false });

    return alerts;
  }, [orders, materials, assets, invoices]);

  const allNotifs = [...systemAlerts, ...notifications];
  const unread = allNotifs.filter(n => !n.read).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative h-9 w-9 rounded-lg flex items-center justify-center hover:bg-accent transition-colors"
      >
        <Bell className="h-4.5 w-4.5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4.5 w-4.5 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-50 w-80 bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div>
                <h3 className="font-semibold text-sm">Notificaciones</h3>
                {unread > 0 && <p className="text-[11px] text-muted-foreground">{unread} sin leer</p>}
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-border">
              {allNotifs.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  <CheckCheck className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  Todo al día
                </div>
              )}
              {allNotifs.map((n) => {
                const Icon = typeIcons[n.type] || Info;
                return (
                  <div
                    key={n.id}
                    className={cn('flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors', !n.read && 'bg-primary/3')}
                    onClick={() => n.id && !n.id.includes('-') && markReadMutation.mutate(n.id)}
                  >
                    <div className={`mt-0.5 flex-shrink-0 ${typeColors[n.type]}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold">{n.title}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{n.message}</div>
                    </div>
                    {!n.read && <div className="h-2 w-2 rounded-full bg-primary mt-1 flex-shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}