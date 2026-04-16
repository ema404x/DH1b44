import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  FolderKanban, ClipboardList, Users, DollarSign, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle2, Wrench, ArrowRight, Activity, Zap,
  Package, BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Link } from 'react-router-dom';
import RevenueChart from '@/components/dashboard/RevenueChart';
import OTsPendientesPanel from '@/components/dashboard/OTsPendientesPanel';
import CertificadosPanel from '@/components/dashboard/CertificadosPanel';
import MetricasOperacion from '@/components/dashboard/MetricasOperacion';
import { format, differenceInDays, isPast, parseISO, startOfMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

const GRADIENT_CONFIGS = {
  blue:    { gradient: 'from-blue-500 to-blue-600',    light: 'bg-blue-50 text-blue-600',    glow: 'shadow-blue-500/20' },
  amber:   { gradient: 'from-amber-400 to-amber-500',  light: 'bg-amber-50 text-amber-600',  glow: 'shadow-amber-500/20' },
  green:   { gradient: 'from-emerald-500 to-teal-500', light: 'bg-emerald-50 text-emerald-600', glow: 'shadow-emerald-500/20' },
  primary: { gradient: 'from-primary to-blue-600',     light: 'bg-primary/10 text-primary',  glow: 'shadow-primary/20' },
  purple:  { gradient: 'from-purple-500 to-violet-600',light: 'bg-purple-50 text-purple-600', glow: 'shadow-purple-500/20' },
  red:     { gradient: 'from-red-500 to-rose-500',     light: 'bg-red-50 text-red-600',      glow: 'shadow-red-500/20' },
};

function KpiCard({ title, value, subtitle, icon: Icon, trend, color = 'primary', href }) {
  const cfg = GRADIENT_CONFIGS[color] || GRADIENT_CONFIGS.primary;
  const trendUp = trend > 0;

  const content = (
    <Card className={`group hover:shadow-lg transition-all duration-200 border-border/60 overflow-hidden ${href ? 'cursor-pointer hover:-translate-y-0.5' : ''}`}>
      {/* Top accent line */}
      <div className={`h-0.5 bg-gradient-to-r ${cfg.gradient}`} />
      <CardContent className="pt-4 pb-4 px-4">
        <div className="flex items-start justify-between mb-3">
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${cfg.light} shadow-sm`}>
            <Icon className="h-[18px] w-[18px]" />
          </div>
          {trend !== undefined && (
            <div className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${trendUp ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
              {trendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(trend)}%
            </div>
          )}
        </div>
        <div className="text-[22px] font-bold tracking-tight leading-none">{value}</div>
        <div className="text-xs font-semibold text-muted-foreground mt-1.5 uppercase tracking-wide">{title}</div>
        {subtitle && <div className="text-[11px] text-muted-foreground/70 mt-0.5">{subtitle}</div>}
      </CardContent>
    </Card>
  );

  return href ? <Link to={href}>{content}</Link> : content;
}

const statusColors = {
  pendiente: 'bg-amber-400',
  asignada: 'bg-blue-400',
  en_progreso: 'bg-indigo-500',
  completada: 'bg-emerald-500'
};
const priorityBadge = {
  urgente: 'bg-red-100 text-red-700 border-red-200',
  alta: 'bg-orange-100 text-orange-700 border-orange-200',
  media: 'bg-blue-100 text-blue-700 border-blue-200',
  baja: 'bg-slate-100 text-slate-600 border-slate-200'
};

export default function Dashboard() {
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list() });
  const { data: orders = [] } = useQuery({ queryKey: ['workorders'], queryFn: () => base44.entities.WorkOrder.list() });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list() });
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: () => base44.entities.Invoice.list() });
  const { data: materials = [] } = useQuery({ queryKey: ['materials'], queryFn: () => base44.entities.Material.list() });
  const { data: assets = [] } = useQuery({ queryKey: ['assets'], queryFn: () => base44.entities.Asset.list() });
  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: () => base44.entities.Employee.list() });

  const activeProjects = projects.filter(p => p.status === 'en_progreso').length;
  const pendingOrders = orders.filter(o => ['pendiente', 'asignada'].includes(o.status)).length;
  const overdueOrders = orders.filter(o => o.scheduled_date && isPast(parseISO(o.scheduled_date)) && !['completada', 'cancelada'].includes(o.status)).length;
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

  const recentProjects = projects.filter(p => p.status === 'en_progreso').slice(0, 5);
  const urgentOrders = orders.filter(o => ['pendiente', 'asignada', 'en_progreso'].includes(o.status) && ['urgente', 'alta'].includes(o.priority)).slice(0, 5);

  const hasAlerts = overdueOrders > 0 || lowStockItems.length > 0 || overdueAssets.length > 0;

  return (
    <div className="space-y-5 max-w-[1600px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight">Panel de Control</h1>
          <p className="text-muted-foreground text-sm mt-0.5 capitalize">
            {format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-emerald-700 font-medium">Sistema operativo</span>
        </div>
      </div>

      {/* Alerts */}
      {hasAlerts && (
        <div className="flex flex-wrap gap-2">
          {overdueOrders > 0 && (
            <Link to="/ordenes" className="flex items-center gap-1.5 text-xs font-semibold bg-amber-50 border border-amber-200 text-amber-700 rounded-full px-3 py-1.5 hover:bg-amber-100 transition-colors">
              <AlertTriangle className="h-3 w-3" /> {overdueOrders} OT vencida{overdueOrders > 1 ? 's' : ''}
            </Link>
          )}
          {lowStockItems.length > 0 && (
            <Link to="/inventario" className="flex items-center gap-1.5 text-xs font-semibold bg-red-50 border border-red-200 text-red-700 rounded-full px-3 py-1.5 hover:bg-red-100 transition-colors">
              <Package className="h-3 w-3" /> {lowStockItems.length} material{lowStockItems.length > 1 ? 'es' : ''} con stock bajo
            </Link>
          )}
          {overdueAssets.length > 0 && (
            <Link to="/activos" className="flex items-center gap-1.5 text-xs font-semibold bg-purple-50 border border-purple-200 text-purple-700 rounded-full px-3 py-1.5 hover:bg-purple-100 transition-colors">
              <Wrench className="h-3 w-3" /> {overdueAssets.length} mantenimiento{overdueAssets.length > 1 ? 's' : ''} vencido{overdueAssets.length > 1 ? 's' : ''}
            </Link>
          )}
        </div>
      )}

      {/* KPI Grid - Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <KpiCard href="/proyectos"   title="Proyectos Activos" value={activeProjects}       subtitle={`${projects.length} en total`}                     icon={FolderKanban}  color="blue" />
        <KpiCard href="/ordenes"     title="OTs Pendientes"    value={pendingOrders}         subtitle={`${completedThisMonth} completadas este mes`}        icon={ClipboardList} color="amber" />
        <KpiCard href="/facturacion" title="Ingresos del Mes"  value={fmt(revenueThisMonth)} subtitle={`${fmt(pendingInvoices)} por cobrar`}                icon={DollarSign}    color="green" trend={revenueTrend} />
        <KpiCard href="/ordenes"     title="Eficiencia OTs"    value={`${efficiency}%`}      subtitle={`${activeEmployees} técnicos activos`}               icon={BarChart3}     color="primary" />
      </div>

      {/* KPI Grid - Row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <KpiCard href="/clientes"   title="Clientes Activos"   value={activeClients}          subtitle={`${clients.length} en total`}                        icon={Users}         color="purple" />
        <KpiCard href="/ordenes"    title="OTs Urgentes"       value={urgentOrders.length}     subtitle="Alta o urgente prioridad"                            icon={AlertTriangle} color={urgentOrders.length > 0 ? 'red' : 'green'} />
        <KpiCard href="/activos"    title="Activos Registrados" value={assets.length}          subtitle={`${overdueAssets.length} con mant. vencido`}         icon={Wrench}        color="amber" />
        <KpiCard href="/inventario" title="Materiales en Stock" value={materials.length}       subtitle={`${lowStockItems.length} bajo mínimo`}               icon={Package}       color={lowStockItems.length > 0 ? 'red' : 'green'} />
      </div>

      {/* Chart + Projects */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RevenueChart invoices={invoices} />
        </div>

        <Card className="border-border/60">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Proyectos en Curso</CardTitle>
              <Link to="/proyectos">
                <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground">
                  Ver todos <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3.5 px-4 pb-4">
            {recentProjects.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Sin proyectos activos</p>
            )}
            {recentProjects.map(p => (
              <div key={p.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{p.name}</span>
                  <span className="text-xs font-bold text-primary flex-shrink-0">{p.progress || 0}%</span>
                </div>
                <Progress value={p.progress || 0} className="h-1.5" />
                <p className="text-[11px] text-muted-foreground">{p.client_name}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* OTs + Certificados */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <OTsPendientesPanel orders={orders} />
        <CertificadosPanel />
      </div>

      {/* Métricas de operación */}
      <MetricasOperacion
        orders={orders}
        projects={projects}
        materials={materials}
        assets={assets}
        employees={employees}
      />

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Urgent orders */}
        <Card className="border-border/60">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold">OTs Urgentes</CardTitle>
                {urgentOrders.length > 0 && (
                  <span className="h-5 w-5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold flex items-center justify-center">{urgentOrders.length}</span>
                )}
              </div>
              <Link to="/ordenes">
                <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground">
                  Ver todas <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {urgentOrders.length === 0 ? (
              <div className="flex items-center gap-2.5 text-sm text-emerald-600 py-4 bg-emerald-50 rounded-lg px-3">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <span className="font-medium">Sin OTs urgentes pendientes</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                {urgentOrders.map(o => (
                  <div key={o.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors">
                    <div className={`h-2 w-2 rounded-full flex-shrink-0 ${statusColors[o.status]}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{o.title}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {o.assigned_name || 'Sin asignar'} · {o.scheduled_date ? format(parseISO(o.scheduled_date), 'd MMM', { locale: es }) : 'Sin fecha'}
                      </div>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold border ${priorityBadge[o.priority]}`}>
                      {o.priority}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assets due maintenance */}
        <Card className="border-border/60">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Mantenimientos Próximos</CardTitle>
              <Link to="/activos">
                <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground">
                  Ver activos <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {assets.filter(a => a.next_maintenance).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Sin activos con mantenimiento programado</p>
            ) : (
              <div className="space-y-1.5">
                {assets
                  .filter(a => a.next_maintenance)
                  .sort((a, b) => a.next_maintenance.localeCompare(b.next_maintenance))
                  .slice(0, 5)
                  .map(a => {
                    const days = differenceInDays(parseISO(a.next_maintenance), new Date());
                    const overdue = days < 0;
                    const urgent = days >= 0 && days <= 14;
                    return (
                      <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors">
                        <div className={`h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 ${overdue ? 'bg-red-100' : urgent ? 'bg-amber-100' : 'bg-muted'}`}>
                          <Wrench className={`h-3.5 w-3.5 ${overdue ? 'text-red-500' : urgent ? 'text-amber-500' : 'text-muted-foreground'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{a.name}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">{a.location}</div>
                        </div>
                        <span className={`text-xs font-bold flex-shrink-0 ${overdue ? 'text-red-600' : urgent ? 'text-amber-600' : 'text-muted-foreground'}`}>
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