import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { FolderKanban, ClipboardList, Users, DollarSign, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Clock, Wrench, ArrowRight, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Link } from 'react-router-dom';
import RevenueChart from '@/components/dashboard/RevenueChart';
import { format, differenceInDays, isPast, parseISO, startOfMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

function KpiCard({ title, value, subtitle, icon: Icon, trend, trendLabel, color = 'primary' }) {
  const colors = {
    primary: 'bg-primary/10 text-primary',
    amber: 'bg-amber-100 text-amber-600',
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-emerald-100 text-emerald-600',
    red: 'bg-red-100 text-red-600',
    purple: 'bg-purple-100 text-purple-600',
  };
  const trendUp = trend > 0;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between mb-3">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
            <Icon className="h-5 w-5" />
          </div>
          {trend !== undefined && (
            <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${trendUp ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {trendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(trend)}%
            </div>
          )}
        </div>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        <div className="text-sm font-medium mt-0.5">{title}</div>
        {subtitle && <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>}
        {trendLabel && <div className="text-xs text-muted-foreground mt-0.5">{trendLabel}</div>}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list() });
  const { data: orders = [] } = useQuery({ queryKey: ['workorders'], queryFn: () => base44.entities.WorkOrder.list() });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list() });
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: () => base44.entities.Invoice.list() });
  const { data: materials = [] } = useQuery({ queryKey: ['materials'], queryFn: () => base44.entities.Material.list() });
  const { data: assets = [] } = useQuery({ queryKey: ['assets'], queryFn: () => base44.entities.Asset.list() });
  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: () => base44.entities.Employee.list() });

  // KPI calculations
  const activeProjects = projects.filter(p => p.status === 'en_progreso').length;
  const pendingOrders = orders.filter(o => ['pendiente', 'asignada'].includes(o.status)).length;
  const overdueOrders = orders.filter(o => o.scheduled_date && isPast(parseISO(o.scheduled_date)) && !['completada','cancelada'].includes(o.status)).length;
  const activeClients = clients.filter(c => c.status === 'activo').length;
  const activeEmployees = employees.filter(e => e.status === 'activo').length;

  const thisMonth = startOfMonth(new Date());
  const lastMonth = startOfMonth(subMonths(new Date(), 1));
  const revenueThisMonth = invoices.filter(i => i.status === 'pagada' && i.payment_date && parseISO(i.payment_date) >= thisMonth).reduce((s, i) => s + (i.total || 0), 0);
  const revenueLastMonth = invoices.filter(i => i.status === 'pagada' && i.payment_date && parseISO(i.payment_date) >= lastMonth && parseISO(i.payment_date) < thisMonth).reduce((s, i) => s + (i.total || 0), 0);
  const revenueTrend = revenueLastMonth > 0 ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100) : 0;

  const pendingInvoices = invoices.filter(i => i.status === 'pendiente').reduce((s, i) => s + (i.total || 0), 0);
  const lowStockItems = materials.filter(m => m.stock <= m.min_stock && m.min_stock > 0);
  const overdueAssets = assets.filter(a => a.next_maintenance && isPast(parseISO(a.next_maintenance)));
  const completedThisMonth = orders.filter(o => o.completed_date && parseISO(o.completed_date) >= thisMonth && o.status === 'completada').length;
  const efficiency = orders.length > 0 ? Math.round((orders.filter(o => o.status === 'completada').length / orders.length) * 100) : 0;

  // Recent items
  const recentProjects = projects.filter(p => p.status === 'en_progreso').slice(0, 4);
  const urgentOrders = orders.filter(o => ['pendiente', 'asignada', 'en_progreso'].includes(o.status) && ['urgente', 'alta'].includes(o.priority)).slice(0, 5);

  const statusColors = { pendiente: 'bg-amber-400', asignada: 'bg-blue-400', en_progreso: 'bg-indigo-500', completada: 'bg-emerald-500' };
  const priorityBadge = { urgente: 'bg-red-100 text-red-700', alta: 'bg-orange-100 text-orange-700', media: 'bg-blue-100 text-blue-700', baja: 'bg-slate-100 text-slate-600' };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Panel de Control</h1>
          <p className="text-muted-foreground text-sm mt-1 capitalize">{format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })}</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
          <Activity className="h-4 w-4 text-emerald-500" />
          <span>Sistema operativo</span>
        </div>
      </div>

      {/* Alerts row */}
      {(overdueOrders > 0 || lowStockItems.length > 0 || overdueAssets.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {overdueOrders > 0 && (
            <Link to="/ordenes" className="flex items-center gap-2 text-xs font-medium bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-3 py-2 hover:bg-amber-100 transition-colors">
              <AlertTriangle className="h-3.5 w-3.5" /> {overdueOrders} OT vencida{overdueOrders > 1 ? 's' : ''}
            </Link>
          )}
          {lowStockItems.length > 0 && (
            <Link to="/inventario" className="flex items-center gap-2 text-xs font-medium bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 hover:bg-red-100 transition-colors">
              <AlertTriangle className="h-3.5 w-3.5" /> {lowStockItems.length} material{lowStockItems.length > 1 ? 'es' : ''} con stock bajo
            </Link>
          )}
          {overdueAssets.length > 0 && (
            <Link to="/activos" className="flex items-center gap-2 text-xs font-medium bg-purple-50 border border-purple-200 text-purple-700 rounded-lg px-3 py-2 hover:bg-purple-100 transition-colors">
              <Wrench className="h-3.5 w-3.5" /> {overdueAssets.length} mantenimiento{overdueAssets.length > 1 ? 's' : ''} vencido{overdueAssets.length > 1 ? 's' : ''}
            </Link>
          )}
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Proyectos Activos" value={activeProjects} subtitle={`${projects.length} en total`} icon={FolderKanban} color="blue" />
        <KpiCard title="OTs Pendientes" value={pendingOrders} subtitle={`${completedThisMonth} completadas este mes`} icon={ClipboardList} color="amber" />
        <KpiCard title="Ingresos del Mes" value={fmt(revenueThisMonth)} subtitle={fmt(pendingInvoices) + ' por cobrar'} icon={DollarSign} color="green" trend={revenueTrend} />
        <KpiCard title="Eficiencia OTs" value={`${efficiency}%`} subtitle={`${activeEmployees} técnicos activos`} icon={CheckCircle2} color="primary" />
      </div>

      {/* Second KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Clientes Activos" value={activeClients} subtitle={`${clients.length} en total`} icon={Users} color="purple" />
        <KpiCard title="OTs Urgentes" value={urgentOrders.length} subtitle="Alta o urgente prioridad" icon={AlertTriangle} color={urgentOrders.length > 0 ? 'red' : 'green'} />
        <KpiCard title="Activos Registrados" value={assets.length} subtitle={`${overdueAssets.length} con mant. vencido`} icon={Wrench} color="amber" />
        <KpiCard title="Materiales en Stock" value={materials.length} subtitle={`${lowStockItems.length} bajo mínimo`} icon={AlertTriangle} color={lowStockItems.length > 0 ? 'red' : 'green'} />
      </div>

      {/* Charts + Tables row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RevenueChart invoices={invoices} />
        </div>

        {/* Project progress */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Proyectos en Curso</CardTitle>
              <Link to="/proyectos"><Button variant="ghost" size="sm" className="text-xs h-7 gap-1">Ver todos <ArrowRight className="h-3 w-3" /></Button></Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentProjects.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sin proyectos activos</p>}
            {recentProjects.map(p => (
              <div key={p.id} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate max-w-[180px]">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.progress || 0}%</span>
                </div>
                <Progress value={p.progress || 0} className="h-1.5" />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground truncate">{p.client_name}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Urgent orders */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">OTs Urgentes / Alta Prioridad</CardTitle>
              <Link to="/ordenes"><Button variant="ghost" size="sm" className="text-xs h-7 gap-1">Ver todas <ArrowRight className="h-3 w-3" /></Button></Link>
            </div>
          </CardHeader>
          <CardContent>
            {urgentOrders.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-emerald-600 py-3">
                <CheckCircle2 className="h-4 w-4" /> Sin OTs urgentes pendientes
              </div>
            ) : (
              <div className="space-y-2">
                {urgentOrders.map(o => (
                  <div key={o.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/40 hover:bg-muted transition-colors">
                    <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${statusColors[o.status]}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{o.title}</div>
                      <div className="text-xs text-muted-foreground">{o.assigned_name || 'Sin asignar'} · {o.scheduled_date ? format(parseISO(o.scheduled_date), 'd MMM', { locale: es }) : 'Sin fecha'}</div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityBadge[o.priority]}`}>{o.priority}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assets due maintenance */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Mantenimientos Próximos</CardTitle>
              <Link to="/activos"><Button variant="ghost" size="sm" className="text-xs h-7 gap-1">Ver activos <ArrowRight className="h-3 w-3" /></Button></Link>
            </div>
          </CardHeader>
          <CardContent>
            {assets.filter(a => a.next_maintenance).length === 0 ? (
              <p className="text-sm text-muted-foreground py-3 text-center">Sin activos con mantenimiento programado</p>
            ) : (
              <div className="space-y-2">
                {assets
                  .filter(a => a.next_maintenance)
                  .sort((a, b) => a.next_maintenance.localeCompare(b.next_maintenance))
                  .slice(0, 5)
                  .map(a => {
                    const days = differenceInDays(parseISO(a.next_maintenance), new Date());
                    const overdue = days < 0;
                    const urgent = days >= 0 && days <= 14;
                    return (
                      <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/40">
                        <Wrench className={`h-4 w-4 flex-shrink-0 ${overdue ? 'text-red-500' : urgent ? 'text-amber-500' : 'text-muted-foreground'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{a.name}</div>
                          <div className="text-xs text-muted-foreground">{a.location}</div>
                        </div>
                        <span className={`text-xs font-medium flex-shrink-0 ${overdue ? 'text-red-600' : urgent ? 'text-amber-600' : 'text-muted-foreground'}`}>
                          {overdue ? `Vencido ${Math.abs(days)}d` : days === 0 ? 'Hoy' : `En ${days}d`}
                        </span>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}