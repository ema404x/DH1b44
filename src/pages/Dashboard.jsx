import React, { useMemo, useCallback, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  FolderKanban, ClipboardList, Users, DollarSign, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle2, Wrench, ArrowRight, Zap, Package, BarChart3,
  Activity, FileCheck, Calendar, MapPin, User, Clock, Sparkles, ChevronRight,
  Shield, Target
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import RevenueChart from '@/components/dashboard/RevenueChart';
import OTsPendientesPanel from '@/components/dashboard/OTsPendientesPanel';
import CertificadosPanel from '@/components/dashboard/CertificadosPanel';
import MetricasOperacion from '@/components/dashboard/MetricasOperacion';
import AlertasBanner from '@/components/dashboard/AlertasBanner';
import EmergenciasWidget from '@/components/dashboard/EmergenciasWidget';
import KpisJefeSitio from '@/components/dashboard/KpisJefeSitio';
import AuroraEffect from '@/components/dashboard/AuroraEffect';
import DashboardFilters from '@/components/dashboard/DashboardFilters';
import SectionHeader from '@/components/dashboard/SectionHeader';
import { format, isPast, parseISO, startOfMonth, subMonths, formatDistanceToNow, subDays } from 'date-fns';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { es } from 'date-fns/locale';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

const panel = "rounded-2xl border border-border bg-card shadow-sm p-4";

const STATUS_COLORS = {
  pendiente:   { dot: 'bg-yellow-400', text: 'text-yellow-400' },
  asignada:    { dot: 'bg-blue-400',   text: 'text-blue-400' },
  en_progreso: { dot: 'bg-purple-400', text: 'text-purple-400' },
  completada:  { dot: 'bg-emerald-400',text: 'text-emerald-400' },
  cancelada:   { dot: 'bg-red-400',    text: 'text-red-400' },
};

const PRIORITY_COLORS = {
  urgente: 'bg-red-500/20 text-red-300 border-red-500/30',
  alta:    'bg-orange-500/20 text-orange-300 border-orange-500/30',
  media:   'bg-blue-500/20 text-blue-300 border-blue-500/30',
  baja:    'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const KPI_COLORS = {
  blue:    { icon: 'bg-blue-500/15 text-blue-300' },
  amber:   { icon: 'bg-amber-500/15 text-amber-300' },
  green:   { icon: 'bg-emerald-500/15 text-emerald-300' },
  purple:  { icon: 'bg-purple-500/15 text-purple-300' },
  red:     { icon: 'bg-red-500/15 text-red-300' },
  primary: { icon: 'bg-primary/15 text-primary' },
};

function KpiCard({ title, value, subtitle, icon: Icon, color = 'blue', trend, href, alert }) {
  const cfg = KPI_COLORS[color] || KPI_COLORS.blue;
  const inner = (
    <div className="h-full group">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm p-5 h-full transition-all hover:shadow-md hover:-translate-y-0.5 duration-200">
        <div className="flex items-start justify-between mb-4">
          <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", cfg.icon)}>
            <Icon className="h-5 w-5" />
          </div>
          {trend !== undefined && (
            <span className={cn("flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border tabular-nums",
              trend >= 0 ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' : 'bg-red-500/15 text-red-300 border-red-500/25')}>
              {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(trend)}%
            </span>
          )}
          {alert && (
            <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/30 tabular-nums">
              <AlertTriangle className="h-3 w-3" /> {alert}
            </span>
          )}
        </div>
        <div>
          <p className="text-3xl font-bold text-foreground tabular-nums tracking-tight leading-none">{value}</p>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-2">{title}</p>
          {subtitle && <p className="text-xs text-muted-foreground/70 mt-1">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
  return href ? <Link to={href} className="block h-full">{inner}</Link> : inner;
}

function ActivityFeed({ orders }) {
  const recent = useMemo(() =>
    [...orders]
      .filter(o => o.updated_date || o.created_date)
      .sort((a, b) => new Date(b.updated_date || b.created_date) - new Date(a.updated_date || a.created_date))
      .slice(0, 6)
  , [orders]);

  if (recent.length === 0) return (
    <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
      <Activity className="h-8 w-8 opacity-30" />
      <p className="text-xs">Sin actividad reciente</p>
    </div>
  );

  return (
    <div className="space-y-0">
      {recent.map((o, i) => {
        const sc = STATUS_COLORS[o.status] || STATUS_COLORS.pendiente;
        const pc = PRIORITY_COLORS[o.priority] || PRIORITY_COLORS.media;
        const date = o.updated_date || o.created_date;
        return (
          <div key={o.id} className={cn("flex items-start gap-3 py-3", i < recent.length - 1 && "border-b border-border")}>
            <div className="mt-1 flex-shrink-0 flex flex-col items-center gap-1">
              <div className={cn("h-2 w-2 rounded-full", sc.dot)} />
              {i < recent.length - 1 && <div className="w-px flex-1 bg-border h-full min-h-[1rem]" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate leading-tight">{o.title}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border capitalize", pc)}>{o.priority}</span>
                {o.location_qr_name && (
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                    <MapPin className="h-2.5 w-2.5" />{o.location_qr_name}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className={cn("text-[10px] font-medium capitalize", sc.text)}>{o.status?.replace('_', ' ')}</p>
              {date && (
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                  {formatDistanceToNow(new Date(date), { locale: es, addSuffix: true })}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function QuickActionCard({ icon: Icon, label, desc, href, color }) {
  return (
    <Link to={href}>
      <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/40 hover:bg-muted hover:-translate-y-0.5 transition-all duration-150 cursor-pointer group h-full">
        <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0", color)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{label}</p>
          <p className="text-[10px] text-muted-foreground">{desc}</p>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-primary ml-auto flex-shrink-0 transition-colors" />
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { isAdmin, filterByUser, userPermissions, user } = useCurrentUser();
  const [dashFilters, setDashFilters] = React.useState({ dateRange: 'all', jefeSitio: '', priority: '' });

  const canRead = useCallback((moduleKey) => {
    if (user?.role === 'admin') return true;
    if (!userPermissions) return false;
    return userPermissions[moduleKey]?.read === true;
  }, [user, userPermissions]);

  // Solo fetchar si el usuario tiene acceso al módulo
  const { data: projects = [] }  = useQuery({ queryKey: ['projects'],   queryFn: () => base44.entities.Project.list('-updated_date', 100),   staleTime: 60000, refetchInterval: 120000, enabled: canRead('Project') });
  const { data: allOrders = [] } = useQuery({ queryKey: ['workorders'], queryFn: () => base44.entities.WorkOrder.list('-updated_date', 150),  staleTime: 60000, refetchInterval: 60000,  enabled: canRead('WorkOrder') });
  const { data: clients = [] }   = useQuery({ queryKey: ['clients'],    queryFn: () => base44.entities.Client.list('-updated_date', 100),     staleTime: 120000, refetchInterval: 120000, enabled: canRead('Client') });
  const { data: invoices = [] }  = useQuery({ queryKey: ['invoices'],   queryFn: () => base44.entities.Invoice.list('-updated_date', 100),    staleTime: 60000, refetchInterval: 120000, enabled: canRead('Invoice') });
  const { data: materials = [] } = useQuery({ queryKey: ['materials'],  queryFn: () => base44.entities.Material.list('-updated_date', 100),   staleTime: 120000, refetchInterval: 120000, enabled: canRead('Inventory') });
  const { data: assets = [] }    = useQuery({ queryKey: ['assets'],     queryFn: () => base44.entities.Asset.list('-updated_date', 100),      staleTime: 120000, refetchInterval: 120000, enabled: canRead('Asset') });
  const { data: allPendientes = [] } = useQuery({ queryKey: ['pendientes'], queryFn: () => base44.entities.Pendiente.list('-updated_date', 200), staleTime: 60000, refetchInterval: 120000, enabled: canRead('Asset') });
  const { data: employees = [] } = useQuery({ queryKey: ['employees'],  queryFn: () => base44.entities.Employee.list('-updated_date', 80),    staleTime: 120000, refetchInterval: 120000, enabled: canRead('Employee') });

  // Pendientes filtrados: admin ve todos, jefe de sitio solo los suyos
  const pendientes = useMemo(() => {
    if (isAdmin) return allPendientes;
    const nombreJefe = user?.full_name || '';
    return allPendientes.filter(p => p.jefe_sitio === nombreJefe);
  }, [allPendientes, isAdmin, user]);

  const allUserOrders = useMemo(() =>
    filterByUser(allOrders, ['assigned_name', 'assigned_to', 'created_by'])
  , [allOrders, filterByUser]);

  // Fecha de corte según el rango seleccionado
  const filterCutoff = useMemo(() => {
    if (dashFilters.dateRange === '7d')  return subDays(new Date(), 7);
    if (dashFilters.dateRange === '30d') return subDays(new Date(), 30);
    if (dashFilters.dateRange === '3m')  return subDays(new Date(), 90);
    return null;
  }, [dashFilters.dateRange]);

  // Aplicar filtros globales sobre órdenes de trabajo
  const orders = useMemo(() => {
    let result = allUserOrders;
    if (filterCutoff) {
      result = result.filter(o => {
        const d = o.updated_date || o.created_date;
        return d && new Date(d) >= filterCutoff;
      });
    }
    if (dashFilters.jefeSitio) {
      result = result.filter(o => o.assigned_name === dashFilters.jefeSitio);
    }
    if (dashFilters.priority) {
      result = result.filter(o => o.priority === dashFilters.priority);
    }
    return result;
  }, [allUserOrders, filterCutoff, dashFilters.jefeSitio, dashFilters.priority]);

  // Proyectos filtrados por rango de fecha
  const filteredProjects = useMemo(() => {
    if (!filterCutoff) return projects;
    return projects.filter(p => {
      const d = p.updated_date || p.created_date;
      return d && new Date(d) >= filterCutoff;
    });
  }, [projects, filterCutoff]);

  // Lista de jefes de sitio para el selector (tomada de employees con rol jefe)
  const jefesOptions = useMemo(() => {
    const names = employees
      .filter(e => e.role && e.role.toLowerCase().includes('jefe'))
      .map(e => e.full_name)
      .filter(Boolean);
    return [...new Set(names)].sort();
  }, [employees]);

  const metrics = useMemo(() => {
    const thisMonth = startOfMonth(new Date());
    const lastMonth = startOfMonth(subMonths(new Date(), 1));

    const activeProjects   = filteredProjects.filter(p => p.status === 'en_progreso').length;
    const pendingOrders    = orders.filter(o => ['pendiente', 'asignada'].includes(o.status)).length;
    const inProgressOrders = orders.filter(o => o.status === 'en_progreso').length;
    const overdueOrders    = orders.filter(o => { try { return o.scheduled_date && isPast(parseISO(o.scheduled_date)) && !['completada', 'cancelada'].includes(o.status); } catch { return false; } }).length;
    const activeClients    = clients.filter(c => c.status === 'activo').length;
    const activeEmployees  = employees.filter(e => e.status === 'activo').length;

    const revenueThisMonth = invoices.filter(i => i.status === 'pagada' && i.payment_date && parseISO(i.payment_date) >= thisMonth).reduce((s, i) => s + (i.total || 0), 0);
    const revenueLastMonth = invoices.filter(i => i.status === 'pagada' && i.payment_date && parseISO(i.payment_date) >= lastMonth && parseISO(i.payment_date) < thisMonth).reduce((s, i) => s + (i.total || 0), 0);
    const revenueTrend     = revenueLastMonth > 0 ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100) : 0;
    const pendingInvoices  = invoices.filter(i => i.status === 'pendiente').reduce((s, i) => s + (i.total || 0), 0);

    const lowStockItems  = materials.filter(m => m.stock <= m.min_stock && m.min_stock > 0);
    const overdueAssets  = assets.filter(a => { try { return a.next_maintenance && isPast(parseISO(a.next_maintenance)); } catch { return false; } });
    const completedThisMonth = orders.filter(o => o.completed_date && parseISO(o.completed_date) >= thisMonth && o.status === 'completada').length;
    const efficiency     = orders.length > 0 ? Math.round((orders.filter(o => o.status === 'completada').length / orders.length) * 100) : 0;
    const urgentOrders   = orders.filter(o => ['pendiente', 'asignada', 'en_progreso'].includes(o.status) && ['urgente', 'alta'].includes(o.priority));
    const recentProjects = filteredProjects.filter(p => p.status === 'en_progreso').slice(0, 5);
    const hasAlerts      = overdueOrders > 0 || lowStockItems.length > 0 || overdueAssets.length > 0;

    return {
      activeProjects, pendingOrders, inProgressOrders, overdueOrders, activeClients, activeEmployees,
      revenueThisMonth, revenueTrend, pendingInvoices,
      lowStockItems, overdueAssets, completedThisMonth, efficiency,
      recentProjects, urgentOrders, hasAlerts,
    };
  }, [filteredProjects, orders, clients, invoices, materials, assets, employees]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const firstName = user?.full_name?.split(' ')[0] || '';

  return (
    <div className="min-h-screen bg-background space-y-6 pb-10 page-enter">
      <AuroraEffect />

      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1">
        <div>
          <p className="text-muted-foreground text-sm flex items-center gap-1.5 mb-1">
            <Calendar className="h-3.5 w-3.5" />
            {format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })}
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
            {greeting}{firstName ? `, ${firstName}` : ''} <span className="text-2xl">👋</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {canRead('WorkOrder') && <>{metrics.pendingOrders} OTs pendientes · {metrics.inProgressOrders} en progreso</>}
            {canRead('WorkOrder') && metrics.overdueOrders > 0 && <span className="text-red-400 font-semibold"> · ⚠ {metrics.overdueOrders} vencidas</span>}
          </p>
        </div>
        {canRead('WorkOrder') && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link to="/crear-ot">
              <Button size="sm" className="gap-1.5">
                <Zap className="h-3.5 w-3.5" /> Crear OT
              </Button>
            </Link>
            <Link to="/ordenes">
              <Button size="sm" variant="outline" className="gap-1.5">
                <ClipboardList className="h-3.5 w-3.5" /> Ver OTs
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* ── ALERTAS ── */}
      <AlertasBanner />

      {/* ── FILTROS GLOBALES ── */}
      <DashboardFilters filters={dashFilters} onChange={setDashFilters} jefes={jefesOptions} />

      {/* ── CRITICAL ALERTS ── */}
      {metrics.hasAlerts && (
        <div className="flex flex-wrap gap-2">
          {metrics.overdueOrders > 0 && canRead('WorkOrder') && (
            <Link to="/ordenes" className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/25 text-red-300 text-sm hover:bg-red-500/25 transition-all">
              <AlertTriangle className="h-3.5 w-3.5" /> {metrics.overdueOrders} OT{metrics.overdueOrders > 1 ? 's' : ''} vencida{metrics.overdueOrders > 1 ? 's' : ''}
            </Link>
          )}
          {metrics.lowStockItems.length > 0 && canRead('Inventory') && (
            <Link to="/inventario" className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/25 text-amber-300 text-sm hover:bg-amber-500/25 transition-all">
              <Package className="h-3.5 w-3.5" /> {metrics.lowStockItems.length} material{metrics.lowStockItems.length > 1 ? 'es' : ''} bajo stock
            </Link>
          )}
          {metrics.overdueAssets.length > 0 && canRead('Asset') && (
            <Link to="/activos" className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-500/15 border border-orange-500/25 text-orange-300 text-sm hover:bg-orange-500/25 transition-all">
              <Wrench className="h-3.5 w-3.5" /> {metrics.overdueAssets.length} mantenimiento{metrics.overdueAssets.length > 1 ? 's' : ''} vencido{metrics.overdueAssets.length > 1 ? 's' : ''}
            </Link>
          )}
        </div>
      )}

      {/* ── ACCESOS RÁPIDOS ── */}
      {(() => {
        const actions = [
          canRead('WorkOrder')         && { href: '/crear-ot',           icon: Zap,          label: 'Crear OT',     desc: 'Orden rápida',    color: 'bg-emerald-500/15 text-emerald-300' },
          canRead('WorkOrder')         && { href: '/ordenes',            icon: ClipboardList, label: 'OTs',          desc: 'Gestionar',       color: 'bg-amber-500/15 text-amber-300' },
          canRead('InspeccionColegio') && { href: '/inspeccion-colegio', icon: Target,        label: 'Inspección',   desc: 'Recorrido colegio', color: 'bg-blue-500/15 text-blue-300' },
          canRead('Asset')             && { href: '/activos',            icon: Wrench,        label: 'Pendientes',   desc: 'Gestión SAP',     color: 'bg-purple-500/15 text-purple-300' },
          canRead('Certificado')       && { href: '/certificados',       icon: FileCheck,     label: 'Certificados', desc: 'Emitir',          color: 'bg-teal-500/15 text-teal-300' },
          canRead('Reportes')          && { href: '/reportes',           icon: BarChart3,     label: 'Reportes',     desc: 'Ver métricas',    color: 'bg-pink-500/15 text-pink-300' },
        ].filter(Boolean);
        if (actions.length === 0) return null;
        return (
          <div className={panel}>
            <SectionHeader icon={Sparkles} title="Accesos rápidos" subtitle="Tareas frecuentes" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {actions.map((a, i) => <QuickActionCard key={i} {...a} />)}
            </div>
          </div>
        );
      })()}

      {/* ── INDICADORES (KPI GRID) ── */}
      <div>
        <SectionHeader title="Indicadores" subtitle="Resumen general del período" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {canRead('WorkOrder')  && <KpiCard href="/ordenes"     title="OTs Pendientes"   value={metrics.pendingOrders}          subtitle={`${metrics.completedThisMonth} completadas este mes`}  icon={ClipboardList} color="amber"  alert={metrics.overdueOrders > 0 ? metrics.overdueOrders : undefined} />}
          {canRead('WorkOrder')  && <KpiCard href="/ordenes"     title="En Progreso"      value={metrics.inProgressOrders}        subtitle={`${metrics.efficiency}% de eficiencia total`}          icon={Activity}      color="purple" />}
          {canRead('Project')    && <KpiCard href="/proyectos"   title="Proyectos"        value={metrics.activeProjects}         subtitle={`${projects.length} en total`}                          icon={FolderKanban}  color="blue"   />}
          {canRead('Invoice')    && <KpiCard href="/facturacion" title="Ingresos del Mes" value={fmt(metrics.revenueThisMonth)} subtitle={`${fmt(metrics.pendingInvoices)} por cobrar`}         icon={DollarSign}    color="green"  trend={metrics.revenueTrend} />}
        </div>
        <div className="h-4" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {canRead('Client')    && <KpiCard href="/clientes"   title="Proveedores"     value={metrics.activeClients}            subtitle={`${clients.length} en total`}                        icon={Users}         color="primary" />}
          {canRead('WorkOrder') && <KpiCard href="/ordenes"    title="Urgentes"        value={metrics.urgentOrders.length}       subtitle="Alta prioridad activas"                              icon={AlertTriangle} color={metrics.urgentOrders.length > 0 ? 'red' : 'green'} />}
          {canRead('Asset')     && <KpiCard href="/activos"    title="Pendientes SAP"  value={pendientes.filter(p => ['pendiente','asignado','en_progreso'].includes(p.estado)).length} subtitle={`${pendientes.filter(p => p.estado === 'resuelto').length} resueltos`} icon={Wrench} color="amber" alert={pendientes.filter(p => p.prioridad === 'urgente' && p.estado !== 'resuelto').length > 0 ? pendientes.filter(p => p.prioridad === 'urgente' && p.estado !== 'resuelto').length : undefined} />}
          {canRead('Inventory') && <KpiCard href="/inventario" title="Materiales"      value={materials.length}                  subtitle={`${metrics.lowStockItems.length} bajo mínimo`}      icon={Package}       color={metrics.lowStockItems.length > 0 ? 'red' : 'green'} />}
        </div>
      </div>

      {/* ── OPERACIÓN ── */}
      {canRead('WorkOrder') && (
        <div>
          <SectionHeader icon={ClipboardList} title="Operación" subtitle="Órdenes de trabajo y actividad reciente"
            action={<Link to="/ordenes"><Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 px-2">Ver todas <ArrowRight className="h-3 w-3" /></Button></Link>} />
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2">
              <OTsPendientesPanel orders={orders} />
            </div>
            <div className={cn(panel, "h-full")}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Actividad reciente</h3>
                </div>
                <Link to="/ordenes">
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 px-2">Ver <ArrowRight className="h-3 w-3" /></Button>
                </Link>
              </div>
              <ActivityFeed orders={orders} />
            </div>
          </div>
        </div>
      )}

      {/* ── FINANZAS Y CERTIFICACIÓN ── */}
      {(canRead('Invoice') || canRead('Certificado')) && (
        <div>
          <SectionHeader icon={DollarSign} title="Finanzas y certificación" subtitle="Ingresos y certificados del período"
            action={<Link to="/facturacion"><Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 px-2">Ver <ArrowRight className="h-3 w-3" /></Button></Link>} />
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {canRead('Invoice') && (
              <div className="xl:col-span-2">
                <RevenueChart invoices={invoices} />
              </div>
            )}
            {canRead('Certificado') && <CertificadosPanel filterCutoff={filterCutoff} />}
          </div>
        </div>
      )}

      {/* ── INFRAESTRUCTURA ── */}
      {(canRead('Emergencias') || canRead('Project')) && (
        <div>
          <SectionHeader icon={Wrench} title="Infraestructura" subtitle="Emergencias y proyectos en curso"
            action={canRead('Project') ? <Link to="/proyectos"><Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 px-2">Ver <ArrowRight className="h-3 w-3" /></Button></Link> : null} />
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {canRead('Emergencias') && (
              <div className="xl:col-span-2">
                <EmergenciasWidget />
              </div>
            )}
            {canRead('Project') && (
              <div className={cn(panel, "h-full")}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground">Proyectos en curso</h3>
                  <Link to="/proyectos">
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 px-2">Ver <ArrowRight className="h-3 w-3" /></Button>
                  </Link>
                </div>
                {metrics.recentProjects.length === 0 ? (
                  <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">Sin proyectos activos</div>
                ) : (
                  <div className="space-y-4">
                    {metrics.recentProjects.map(p => (
                      <div key={p.id} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-foreground truncate flex-1">{p.name}</p>
                          <span className="text-xs font-bold text-primary flex-shrink-0 tabular-nums">{p.progress || 0}%</span>
                        </div>
                        <Progress value={p.progress || 0} className="h-1.5" />
                        {p.client_name && <p className="text-[10px] text-muted-foreground">{p.client_name}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── GESTIÓN DE SITIOS ── */}
      <div>
        <SectionHeader icon={Shield} title="Gestión de sitios" subtitle="Indicadores por jefe de sitio" />
        <KpisJefeSitio filterJefe={dashFilters.jefeSitio} filterCutoff={filterCutoff} />
      </div>

      {/* ── MÉTRICAS DE OPERACIÓN ── */}
      <div>
        <SectionHeader icon={BarChart3} title="Métricas de operación" subtitle="Vista global de recursos y equipos" />
        <MetricasOperacion
          orders={orders}
          projects={projects}
          materials={materials}
          assets={assets}
          employees={employees}
        />
      </div>
    </div>
  );
}