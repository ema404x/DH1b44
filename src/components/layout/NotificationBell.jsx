import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, AlertTriangle, Info, CheckCircle2, X, AlertCircle, Package, Wrench, Receipt, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isPast, parseISO, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

const TYPE_CONFIG = {
  info:    { icon: Info,          bg: 'bg-blue-500/15',    icon_color: 'text-blue-400',    border: 'border-blue-500/30',    dot: 'bg-blue-400'    },
  warning: { icon: AlertTriangle, bg: 'bg-amber-500/15',   icon_color: 'text-amber-400',   border: 'border-amber-500/30',   dot: 'bg-amber-400'   },
  success: { icon: CheckCircle2,  bg: 'bg-emerald-500/15', icon_color: 'text-emerald-400', border: 'border-emerald-500/30', dot: 'bg-emerald-400' },
  error:   { icon: AlertCircle,   bg: 'bg-red-500/15',     icon_color: 'text-red-400',     border: 'border-red-500/30',     dot: 'bg-red-400'     },
};

const SYSTEM_ICONS = {
  'ot-overdue':      ClipboardList,
  'stock-low':       Package,
  'maint-overdue':   Wrench,
  'invoice-overdue': Receipt,
};

const systemAlertPaths = {
  'ot-overdue':      '/ordenes',
  'stock-low':       '/inventario',
  'maint-overdue':   '/activos',
  'invoice-overdue': '/facturacion',
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => base44.entities.Notification.list('-created_date', 30),
    staleTime: 1000 * 60 * 2,
  });

  // Reutiliza el cache global — staleTime alto para no re-fetchear solo por abrir el panel
  const STALE = 1000 * 60 * 10;
  const { data: orders    = [] } = useQuery({ queryKey: ['workorders'], queryFn: () => base44.entities.WorkOrder.list('-updated_date', 80),  staleTime: STALE, refetchOnWindowFocus: false });
  const { data: materials = [] } = useQuery({ queryKey: ['materials'],  queryFn: () => base44.entities.Material.list('-updated_date', 50),  staleTime: STALE, refetchOnWindowFocus: false });
  const { data: assets    = [] } = useQuery({ queryKey: ['assets'],     queryFn: () => base44.entities.Asset.list('-updated_date', 50),     staleTime: STALE, refetchOnWindowFocus: false });
  const { data: invoices  = [] } = useQuery({ queryKey: ['invoices'],   queryFn: () => base44.entities.Invoice.list('-updated_date', 50),   staleTime: STALE, refetchOnWindowFocus: false });

  const markReadMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.update(id, { read: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const deleteNotifMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const clearAllReadMutation = useMutation({
    mutationFn: async () => {
      const read = notifications.filter(n => n.read);
      await Promise.all(read.map(n => base44.entities.Notification.delete(n.id)));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const systemAlerts = useMemo(() => {
    const alerts = [];
    const overdueOrders = orders.filter(o => o.scheduled_date && isPast(parseISO(o.scheduled_date)) && !['completada','cancelada'].includes(o.status));
    if (overdueOrders.length > 0) alerts.push({ id: 'ot-overdue', title: `${overdueOrders.length} OT${overdueOrders.length > 1 ? 's' : ''} vencida${overdueOrders.length > 1 ? 's' : ''}`, message: 'Órdenes con fecha pasada sin completar', type: 'warning', read: false });
    const lowStock = materials.filter(m => m.stock <= m.min_stock && m.min_stock > 0);
    if (lowStock.length > 0) alerts.push({ id: 'stock-low', title: 'Stock bajo detectado', message: `${lowStock.length} material${lowStock.length > 1 ? 'es' : ''} por debajo del mínimo`, type: 'warning', read: false });
    const overdueAssets = assets.filter(a => a.next_maintenance && isPast(parseISO(a.next_maintenance)));
    if (overdueAssets.length > 0) alerts.push({ id: 'maint-overdue', title: `${overdueAssets.length} mantenimiento${overdueAssets.length > 1 ? 's' : ''} vencido${overdueAssets.length > 1 ? 's' : ''}`, message: 'Activos con mantenimiento programado vencido', type: 'error', read: false });
    const overdueInvoices = invoices.filter(i => i.status === 'vencida' || (i.due_date && isPast(parseISO(i.due_date)) && i.status === 'pendiente'));
    if (overdueInvoices.length > 0) alerts.push({ id: 'invoice-overdue', title: 'Facturas vencidas', message: `${overdueInvoices.length} factura${overdueInvoices.length > 1 ? 's' : ''} pendiente${overdueInvoices.length > 1 ? 's' : ''} de cobro`, type: 'error', read: false });
    return alerts;
  }, [orders, materials, assets, invoices]);

  const allNotifs = [...systemAlerts, ...notifications];
  const unread = allNotifs.filter(n => !n.read).length;

  const handleOpen = () => {
    const newOpen = !open;
    setOpen(newOpen);
    // Solo refrescar notificaciones (las demás queries usan cache global con staleTime alto)
    if (newOpen) qc.invalidateQueries({ queryKey: ['notifications'] });
  };

  const handleClick = (n) => {
    const isSystem = typeof n.id === 'string' && systemAlertPaths[n.id];
    if (isSystem) { navigate(systemAlertPaths[n.id]); setOpen(false); }
    else if (n.id && !n.read) markReadMutation.mutate(n.id);
  };

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className={cn(
          'relative h-9 w-9 rounded-lg flex items-center justify-center transition-all duration-200',
          open ? 'bg-primary/15 text-primary' : 'text-slate-400 hover:bg-white/8 hover:text-slate-200'
        )}
      >
        <Bell className={cn('h-4.5 w-4.5 transition-transform duration-200', open && 'scale-110')} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-[18px] min-w-[18px] px-0.5 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center shadow-md shadow-red-500/40 animate-pulse">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div className="fixed right-2 top-14 z-[70] w-[calc(100vw-16px)] sm:w-[340px] sm:absolute sm:right-0 sm:top-11 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl shadow-black/30">

            {/* Header */}
            <div className="px-4 py-3.5 border-b border-border/50 bg-muted/20 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <Bell className="h-4 w-4 text-foreground/70" />
                  {unread > 0 && <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500" />}
                </div>
                <div>
                  <span className="text-sm font-semibold text-foreground">Notificaciones</span>
                  {unread > 0 && (
                    <span className="ml-2 text-xs bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-medium">{unread} nuevas</span>
                  )}
                </div>
              </div>
              <button onClick={() => setOpen(false)}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Body */}
            <div className="max-h-[420px] overflow-y-auto">
              {allNotifs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <div className="h-12 w-12 rounded-full bg-muted/40 flex items-center justify-center mb-3">
                    <CheckCheck className="h-5 w-5 opacity-50" />
                  </div>
                  <p className="text-sm font-medium">Todo al día</p>
                  <p className="text-xs mt-1 opacity-60">Sin notificaciones pendientes</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {/* Alertas del sistema agrupadas arriba */}
                  {systemAlerts.length > 0 && (
                    <>
                      <div className="px-2 pt-1 pb-0.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Sistema</span>
                      </div>
                      {systemAlerts.map(n => {
                        const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.info;
                        const Icon = SYSTEM_ICONS[n.id] || cfg.icon;
                        return (
                          <button key={n.id} onClick={() => handleClick(n)}
                            className={cn('w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-all hover:scale-[1.01] active:scale-[0.99]', cfg.bg, 'border', cfg.border)}>
                            <div className={cn('mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center shrink-0', cfg.bg)}>
                              <Icon className={cn('h-3.5 w-3.5', cfg.icon_color)} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-foreground leading-tight">{n.title}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{n.message}</p>
                            </div>
                            <div className={cn('mt-1.5 h-2 w-2 rounded-full shrink-0', cfg.dot)} />
                          </button>
                        );
                      })}
                    </>
                  )}

                  {/* Notificaciones de usuario */}
                  {notifications.length > 0 && (
                    <>
                      <div className="px-2 pt-2 pb-0.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Actividad</span>
                      </div>
                      {notifications.map(n => {
                        const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.info;
                        const Icon = cfg.icon;
                        const timeAgo = n.created_date
                          ? formatDistanceToNow(new Date(n.created_date), { addSuffix: true, locale: es })
                          : null;
                        return (
                          <div key={n.id}
                            className={cn(
                              'group flex items-start gap-3 px-3 py-2.5 rounded-xl transition-all hover:bg-muted/40',
                              !n.read && 'bg-primary/5 border border-primary/10'
                            )}>
                            <button className="flex items-start gap-3 flex-1 min-w-0 text-left" onClick={() => handleClick(n)}>
                              <div className="mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center shrink-0 bg-muted/50">
                                <Icon className={cn('h-3.5 w-3.5', cfg.icon_color)} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-foreground leading-tight">{n.title}</p>
                                {n.message && <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{n.message}</p>}
                                {timeAgo && <p className="text-[10px] text-muted-foreground/50 mt-1">{timeAgo}</p>}
                              </div>
                            </button>
                            <button
                              onClick={() => deleteNotifMutation.mutate(n.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-500/10 shrink-0">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-2.5 border-t border-border/40 bg-muted/10 flex items-center justify-between gap-2">
                {notifications.some(n => n.read) ? (
                  <button
                    onClick={() => clearAllReadMutation.mutate()}
                    disabled={clearAllReadMutation.isPending}
                    className="text-xs text-muted-foreground hover:text-red-400 font-medium transition-colors flex items-center gap-1">
                    <X className="h-3 w-3" /> Limpiar leídas
                  </button>
                ) : <span />}
                {notifications.some(n => !n.read) && (
                  <button
                    onClick={() => notifications.filter(n => !n.read).forEach(n => markReadMutation.mutate(n.id))}
                    className="text-xs text-primary hover:text-primary/80 font-medium transition-colors flex items-center gap-1">
                    <CheckCheck className="h-3 w-3" /> Marcar todo leído
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}