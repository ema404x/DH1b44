import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Zap, Bell, Wrench, Package, ClipboardList, CheckCircle2, Play, RefreshCw, Clock, AlertTriangle, Send } from 'lucide-react';
import { differenceInDays, isPast, parseISO, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import PageHeader from '@/components/shared/PageHeader';
import AlertContactsManager from '@/components/automatizaciones/AlertContactsManager';

const RULES = [
  {
    id: 'ot_vencida',
    title: 'OT Vencida sin Completar',
    description: 'Genera notificación cuando una OT supera su fecha programada sin ser completada',
    icon: ClipboardList,
    color: 'text-red-500',
    bg: 'bg-red-50',
    category: 'Órdenes de Trabajo',
    defaultEnabled: true,
  },
  {
    id: 'stock_bajo',
    title: 'Stock Bajo en Inventario',
    description: 'Alerta cuando un material cae por debajo del stock mínimo definido',
    icon: Package,
    color: 'text-amber-500',
    bg: 'bg-amber-50',
    category: 'Inventario',
    defaultEnabled: true,
  },
  {
    id: 'mantenimiento_vencido',
    title: 'Mantenimiento Preventivo Vencido',
    description: 'Notifica cuando un activo supera su fecha de próximo mantenimiento',
    icon: Wrench,
    color: 'text-red-600',
    bg: 'bg-red-50',
    category: 'Activos',
    defaultEnabled: true,
  },
  {
    id: 'mantenimiento_proximo',
    title: 'Recordatorio Mantenimiento Próximo',
    description: 'Avisa 14 días antes del próximo mantenimiento programado de un activo',
    icon: Clock,
    color: 'text-blue-500',
    bg: 'bg-blue-50',
    category: 'Activos',
    defaultEnabled: true,
  },
  {
    id: 'ot_urgente',
    title: 'Nueva OT Urgente',
    description: 'Notificación inmediata cuando se crea una orden de trabajo con prioridad urgente',
    icon: AlertTriangle,
    color: 'text-orange-500',
    bg: 'bg-orange-50',
    category: 'Órdenes de Trabajo',
    defaultEnabled: true,
  },
];

const fmtDate = (d) => {
  try { return d ? format(new Date(d), 'dd/MM/yy HH:mm', { locale: es }) : '-'; } catch { return '-'; }
};

export default function Automatizaciones() {
  const [enabled, setEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem('mejores_automation_rules');
      return saved ? JSON.parse(saved) : Object.fromEntries(RULES.map(r => [r.id, r.defaultEnabled]));
    } catch {
      return Object.fromEntries(RULES.map(r => [r.id, r.defaultEnabled]));
    }
  });
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState(null);
  const qc = useQueryClient();

  const { data: orders = [] } = useQuery({ queryKey: ['workorders'], queryFn: () => base44.entities.WorkOrder.list() });
  const { data: materials = [] } = useQuery({ queryKey: ['materials'], queryFn: () => base44.entities.Material.list() });
  const { data: assets = [] } = useQuery({ queryKey: ['assets'], queryFn: () => base44.entities.Asset.list() });
  const { data: notifications = [] } = useQuery({ queryKey: ['notifications'], queryFn: () => base44.entities.Notification.list('-created_date', 50) });
  const { data: alertContacts = [] } = useQuery({ queryKey: ['alert_contacts'], queryFn: () => base44.entities.AlertContact.list() });
  const [sendingAlerts, setSendingAlerts] = useState(false);

  const createNotif = useMutation({
    mutationFn: (n) => base44.entities.Notification.create(n),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const toggleRule = (id, val) => {
    const next = { ...enabled, [id]: val };
    setEnabled(next);
    localStorage.setItem('mejores_automation_rules', JSON.stringify(next));
  };

  // Verifica si ya existe una notif reciente (hoy) con ese titulo
  const alreadyNotified = (title) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return notifications.some(n => n.title === title && n.created_date?.startsWith(today));
  };

  const runAutomations = async () => {
    setRunning(true);
    let created = 0;

    // 1. OTs vencidas
    if (enabled.ot_vencida) {
      const vencidas = orders.filter(o =>
        o.scheduled_date && isPast(parseISO(o.scheduled_date)) && !['completada','cancelada'].includes(o.status)
      );
      if (vencidas.length > 0) {
        const title = `${vencidas.length} OT${vencidas.length > 1 ? 's' : ''} vencida${vencidas.length > 1 ? 's' : ''}`;
        if (!alreadyNotified(title)) {
          await createNotif.mutateAsync({ title, message: `Órdenes: ${vencidas.map(o => o.title).slice(0,3).join(', ')}${vencidas.length > 3 ? '...' : ''}`, type: 'warning', category: 'ot', read: false });
          created++;
        }
      }
    }

    // 2. Stock bajo
    if (enabled.stock_bajo) {
      const low = materials.filter(m => m.min_stock > 0 && m.stock <= m.min_stock);
      if (low.length > 0) {
        const title = `Stock bajo: ${low.length} material${low.length > 1 ? 'es' : ''}`;
        if (!alreadyNotified(title)) {
          await createNotif.mutateAsync({ title, message: low.map(m => `${m.name} (${m.stock}/${m.min_stock})`).slice(0,4).join(', '), type: 'warning', category: 'stock', read: false });
          created++;
        }
      }
    }

    // 3. Mantenimiento vencido
    if (enabled.mantenimiento_vencido) {
      const vencidos = assets.filter(a => a.next_maintenance && isPast(new Date(a.next_maintenance)));
      if (vencidos.length > 0) {
        const title = `${vencidos.length} mantenimiento${vencidos.length > 1 ? 's' : ''} vencido${vencidos.length > 1 ? 's' : ''}`;
        if (!alreadyNotified(title)) {
          await createNotif.mutateAsync({ title, message: vencidos.map(a => a.name).slice(0,4).join(', '), type: 'error', category: 'mantenimiento', read: false });
          created++;
        }
      }
    }

    // 4. Mantenimiento próximo (14 días)
    if (enabled.mantenimiento_proximo) {
      const proximos = assets.filter(a => {
        if (!a.next_maintenance) return false;
        const days = differenceInDays(new Date(a.next_maintenance), new Date());
        return days >= 0 && days <= 14;
      });
      if (proximos.length > 0) {
        const title = `${proximos.length} mantenimiento${proximos.length > 1 ? 's' : ''} próximo${proximos.length > 1 ? 's' : ''} (14 días)`;
        if (!alreadyNotified(title)) {
          await createNotif.mutateAsync({ title, message: proximos.map(a => `${a.name} — ${a.next_maintenance}`).slice(0,3).join(', '), type: 'info', category: 'mantenimiento', read: false });
          created++;
        }
      }
    }

    // 5. OTs urgentes (creadas en las últimas 24h)
    if (enabled.ot_urgente) {
      const urgentes = orders.filter(o => {
        if (o.priority !== 'urgente' || ['completada','cancelada'].includes(o.status)) return false;
        if (!o.created_date) return false;
        const h = differenceInDays(new Date(), new Date(o.created_date));
        return h === 0;
      });
      if (urgentes.length > 0) {
        const title = `${urgentes.length} OT urgente${urgentes.length > 1 ? 's' : ''} activa${urgentes.length > 1 ? 's' : ''}`;
        if (!alreadyNotified(title)) {
          await createNotif.mutateAsync({ title, message: urgentes.map(o => o.title).slice(0,3).join(', '), type: 'error', category: 'ot', read: false });
          created++;
        }
      }
    }

    setLastRun(new Date());
    setRunning(false);
    toast.success(created > 0 ? `${created} notificación${created > 1 ? 'es' : ''} generada${created > 1 ? 's' : ''}` : 'Todo al día — sin alertas nuevas');

    // Enviar alertas a contactos si hay novedades
    if (created > 0) {
      const activeContacts = alertContacts.filter(c => c.active);
      if (activeContacts.length > 0) {
        sendAlertsToContacts(activeContacts);
      }
    }
  };

  const sendAlertsToContacts = async (contacts) => {
    setSendingAlerts(true);
    const alerts = [];

    if (enabled.ot_vencida) {
      const vencidas = orders.filter(o => o.scheduled_date && isPast(parseISO(o.scheduled_date)) && !['completada','cancelada'].includes(o.status));
      if (vencidas.length > 0) alerts.push({ ruleId: 'ot_vencida', title: `OTs vencidas (${vencidas.length})`, message: vencidas.map(o => o.title).slice(0,3).join(', ') });
    }
    if (enabled.stock_bajo) {
      const low = materials.filter(m => m.min_stock > 0 && m.stock <= m.min_stock);
      if (low.length > 0) alerts.push({ ruleId: 'stock_bajo', title: `Stock bajo (${low.length} materiales)`, message: low.map(m => m.name).slice(0,3).join(', ') });
    }
    if (enabled.mantenimiento_vencido) {
      const venc = assets.filter(a => a.next_maintenance && isPast(new Date(a.next_maintenance)));
      if (venc.length > 0) alerts.push({ ruleId: 'mantenimiento_vencido', title: `Mantenimientos vencidos (${venc.length})`, message: venc.map(a => a.name).slice(0,3).join(', ') });
    }
    if (enabled.ot_urgente) {
      const urg = orders.filter(o => o.priority === 'urgente' && !['completada','cancelada'].includes(o.status));
      if (urg.length > 0) alerts.push({ ruleId: 'ot_urgente', title: `OTs urgentes activas (${urg.length})`, message: urg.map(o => o.title).slice(0,3).join(', ') });
    }

    if (alerts.length > 0) {
      const res = await base44.functions.invoke('sendAlertNotifications', { contacts, alerts });
      if (res.data?.sent > 0) toast.success(`📧 ${res.data.sent} alerta${res.data.sent > 1 ? 's' : ''} enviada${res.data.sent > 1 ? 's' : ''} por email`);
    }
    setSendingAlerts(false);
  };

  const handleManualSendAlerts = async () => {
    const activeContacts = alertContacts.filter(c => c.active);
    if (!activeContacts.length) { toast.error('No hay contactos activos configurados'); return; }
    await sendAlertsToContacts(activeContacts);
  };

  // Ejecutar automáticamente al cargar si hay datos
  useEffect(() => {
    if (orders.length || materials.length || assets.length) {
      runAutomations();
    }
  }, []);  // eslint-disable-line

  const recentNotifs = notifications.slice(0, 15);

  const categoryColors = {
    'Órdenes de Trabajo': 'bg-red-100 text-red-700',
    'Inventario': 'bg-amber-100 text-amber-700',
    'Activos': 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automatizaciones"
        subtitle="Motor de notificaciones y recordatorios automáticos"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Rules panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Contacts Manager */}
          <AlertContactsManager />

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  Reglas de Automatización
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-8 text-xs"
                    onClick={handleManualSendAlerts}
                    disabled={sendingAlerts || !alertContacts.filter(c => c.active).length}
                    title={!alertContacts.filter(c => c.active).length ? 'Agregá contactos primero' : 'Enviar alertas ahora'}
                  >
                    {sendingAlerts ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    {sendingAlerts ? 'Enviando...' : 'Enviar Alertas'}
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5 h-8 text-xs"
                    onClick={runAutomations}
                    disabled={running}
                  >
                    {running ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                    {running ? 'Ejecutando...' : 'Ejecutar Ahora'}
                  </Button>
                </div>
              </div>
              {lastRun && (
                <p className="text-xs text-muted-foreground">
                  Última ejecución: {fmtDate(lastRun.toISOString())}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {RULES.map(rule => (
                <div
                  key={rule.id}
                  className="flex items-start gap-3 p-3 rounded-xl border border-border hover:bg-muted/20 transition-colors"
                >
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${rule.bg}`}>
                    <rule.icon className={`h-4.5 w-4.5 ${rule.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{rule.title}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${categoryColors[rule.category] || 'bg-muted text-muted-foreground'}`}>
                        {rule.category}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{rule.description}</p>
                  </div>
                  <Switch
                    checked={enabled[rule.id] ?? rule.defaultEnabled}
                    onCheckedChange={(v) => toggleRule(rule.id, v)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'OTs vencidas', value: orders.filter(o => o.scheduled_date && isPast(parseISO(o.scheduled_date)) && !['completada','cancelada'].includes(o.status)).length, color: 'text-red-600', bg: 'bg-red-50' },
              { label: 'Stock bajo', value: materials.filter(m => m.min_stock > 0 && m.stock <= m.min_stock).length, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Mant. vencidos', value: assets.filter(a => a.next_maintenance && isPast(new Date(a.next_maintenance))).length, color: 'text-blue-600', bg: 'bg-blue-50' },
            ].map(s => (
              <Card key={s.label} className={s.bg + ' border-0'}>
                <CardContent className="pt-4 pb-3 text-center">
                  <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Notification log */}
        <div>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                Historial de Notificaciones
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentNotifs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Sin notificaciones</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {recentNotifs.map(n => {
                    const typeColor = { info: 'border-l-blue-400', warning: 'border-l-amber-400', error: 'border-l-red-400', success: 'border-l-emerald-400' };
                    return (
                      <div key={n.id} className={`border-l-4 pl-3 py-2 ${typeColor[n.type] || 'border-l-slate-300'} ${n.read ? 'opacity-50' : ''}`}>
                        <div className="text-xs font-semibold leading-tight">{n.title}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{n.message}</div>
                        <div className="text-[10px] text-muted-foreground/60 mt-0.5">{fmtDate(n.created_date)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}