import React, { useMemo, useCallback, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  FolderKanban, ClipboardList, Users, DollarSign, TrendingUp, TrendingDown,
  AlertTriangle, Wrench, ArrowRight, Zap, Package, BarChart3,
  Activity, FileCheck, MapPin, Sparkles, ChevronRight,
  Shield, Target
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import RevenueChart from '@/components/dashboard/RevenueChart';
import OTsPendientesPanel from '@/components/dashboard/OTsPendientesPanel';
import CertificadosPanel from '@/components/dashboard/CertificadosPanel';
import MetricasOperacion from '@/components/dashboard/MetricasOperacion';
import AlertasBanner from '@/components/dashboard/AlertasBanner';
import EmergenciasWidget from '@/components/dashboard/EmergenciasWidget';
import KpisJefeSitio from '@/components/dashboard/KpisJefeSitio';
import DashboardFilters from '@/components/dashboard/DashboardFilters';
import SectionHeader from '@/components/dashboard/SectionHeader';
import CountUp from '@/components/dashboard/CountUp';
import { format, isPast, parseISO, startOfMonth, subMonths, formatDistanceToNow, subDays } from 'date-fns';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { es } from 'date-fns/locale';
import { esOtVencida } from '@/lib/otVencimiento';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

const HERO_IMG = 'https://media.base44.com/images/public/69bc7d2a6f0e7ed160c90003/1b31ee69b_generated_206f514f.jpg';

const panel = "rounded-2xl border border-border bg-card shadow-[0_13px_25px_rgba(15,23,42,0.2)] p-4 lg:p-5";

const STATUS_COLORS = {
  pendiente:   { dot: 'bg-amber-400', text: 'text-amber-400', ring: 'shadow-[0_0_0_4px_rgba(245,158,11,0.12)]' },
  asignada:    { dot: 'bg-cyan-400',  text: 'text-cyan-400', ring: 'shadow-[0_0_0_4px_rgba(34,211,238,0.12)]' },
  en_progreso: { dot: 'bg-cyan-400',  text: 'text-cyan-400', ring: 'shadow-[0_0_0_4px_rgba(34,211,238,0.12)]' },
  completada:  { dot: 'bg-emerald-400', text: 'text-emerald-400', ring: 'shadow-[0_0_0_4px_rgba(52,211,153,0.12)]' },
  cancelada:   { dot: 'bg-red-400',   text: 'text-red-400', ring: 'shadow-[0_0_0_4px_rgba(239,68,68,0.12)]' },
};

const PRIORITY_TAGS = {
  urgente: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  alta:    'bg-orange-500/15 text-orange-300 border-orange-500/30',
  media:   'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  baja:    'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

const KPI_TOP = {
  cyan:    { top: 'border-t-cyan-500',   icon: 'text-cyan-400' },
  amber:   { top: 'border-t-amber-500',  icon: 'text-amber-400' },
  red:     { top: 'border-t-red-400',    icon: 'text-red-400' },
  green:   { top: 'border-t-emerald-500',icon: 'text-emerald-400' },
  gold:    { top: 'border-t-amber-500',  icon: 'text-amber-400' },
  primary: { top: 'border-t-primary',     icon: 'text-primary' },
};

const KpiCard = React.memo(function KpiCard({ title, value, subtitle, icon: Icon, color = 'cyan', trend, href, alert }) {
  const cfg = KPI_TOP[color] || KPI_TOP.cyan;
  const inner = (
    <div className={cn(
      "acero-kpi relative overflow-hidden rounded-2xl border border-border bg-card p-4 lg:p-5 h-full border-t-[3px] shadow-[0_13px_25px_rgba(15,23,42,0.2)]",
      "focus-visible:outline-2 focus-visible:outline-amber-500 focus-visible:[outline-offset:3px]",
      cfg.top
    )}>
      <div className="flex items-start justify-between mb-3 lg:mb-4">
        <div className={cn("h-9 w-9 lg:h-10 lg:w-10 rounded-xl flex items-center justify-center bg-primary/10", cfg.icon)}>
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
        <p className="text-2xl lg:text-3xl font-bold text-foreground tabular-nums tracking-tight leading-none"><CountUp value={value} /></p>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-2">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground/70 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
  return href ? <Link to={href} className="block h-full focus-visible:outline-2 focus-visible:outline-amber-500 focus-visible:[outline-offset:3px]">{inner}</Link> : inner;
});

function KpiCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-[0_13px_25px_rgba(15,23,42,0.2)] p-4 lg:p-6 h-full border-t-[3px] border-t-border">
      <div className="flex items-start justify-between mb-4">
        <div className="h-9 w-9 lg:h-10 lg:w-10 rounded-xl skeleton" />
      </div>
      <div className="h-8 w-24 skeleton mb-2" />
      <div className="h-3 w-28 skeleton" />
    </div>
  );
}

const ActivityFeedItem = React.memo(function ActivityFeedItem({ o, isLast }) {
  const sc = STATUS_COLORS[o.status] || STATUS_COLORS.pendiente;
  const pc = PRIORITY_TAGS[o.priority] || PRIORITY_TAGS.media;
  const date = o.updated_date || o.created_date;
  return (
    <div className={cn("flex items-start gap-3 py-3", !isLast && "border-b border-border")}>
      <div className="mt-1 flex-shrink-0 flex flex-col items-center gap-1">
        <div className={cn("h-2 w-2 rounded-full", sc.dot, sc.ring)} />
        {!isLast && <div className="w-px flex-1 bg-border h-full min-h-[1rem]" />}
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
});

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
      {recent.map((o, i) => (
        <ActivityFeedItem key={o.id} o={o} isLast={i === recent.length - 1} />
      ))}
    </div>
  );
}

const QuickActionCard = React.memo(function QuickActionCard({ icon: Icon, label, desc, href, color }) {
  return (
    <Link to={href} className="block focus-visible:outline-2 focus-visible:outline-cyan-500 focus-visible:[outline-offset:2px]">
      <div className="acero-quick-item flex items-center gap-3 p-3 rounded-xl border border-border bg-[hsl(215,25%,22%)] cursor-pointer group h-full">
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
});

export default function Dashboard() {
  const { isAdmin, filterByUser, userPermissions, user, displayName } = useCurrentUser();
  const [dashFilters, setDashFilters] = React.useState({ dateRange: 'all', jefeSitio: '', priority: '' });

  const canRead = useCallback((moduleKey) => {
    if (user?.role === 'admin') return true;
    if (!userPermissions) return false;
    return userPermissions[moduleKey]?.read === true;
  }, [user, userPermissions]);

  const STALE_5MIN = 5 * 60 * 1000;
  const { data: projects = [] }  = useQuery({ queryKey: ['projects'],   queryFn: () => base44.entities.Project.list('-updated_date', 100),   staleTime: STALE_5MIN, enabled: canRead('Project') });
  const { data: _ownOrdersRaw = [] } = useQuery({
    queryKey: ['workorders-dashboard-own'],
    queryFn: async () => (await base44.functions.invoke('getWorkOrdersForUser', { scope: 'own' })).data?.orders || [],
    staleTime: STALE_5MIN, enabled: canRead('WorkOrder'),
  });
  const allOrders = Array.isArray(_ownOrdersRaw) ? _ownOrdersRaw : (_ownOrdersRaw?.orders || []);
  const { data: clients = [] }   = useQuery({ queryKey: ['clients'],    queryFn: () => base44.entities.Client.list('-updated_date', 100),     staleTime: STALE_5MIN, enabled: canRead('Client') });
  const { data: invoices = [] }  = useQuery({ queryKey: ['invoices'],   queryFn: () => base44.entities.Invoice.list('-updated_date', 100),    staleTime: STALE_5MIN, enabled: canRead('Invoice') });
  const { data: materials = [] } = useQuery({ queryKey: ['materials'],  queryFn: () => base44.entities.Material.list('-updated_date', 100),   staleTime: STALE_5MIN, enabled: canRead('Inventory') });
  const { data: assets = [] }    = useQuery({ queryKey: ['assets'],     queryFn: () => base44.entities.Asset.list('-updated_date', 100),      staleTime: STALE_5MIN, enabled: canRead('Asset') });
  const { data: allPendientes = [] } = useQuery({ queryKey: ['pendientes'], queryFn: async () => (await base44.functions.invoke('getPendientesForUser')).data.pendientes || [], staleTime: STALE_5MIN, enabled: canRead('Pendientes') });
  const { data: employees = [] } = useQuery({ queryKey: ['employees'],  queryFn: () => base44.entities.Employee.list('-updated_date', 80),    staleTime: STALE_5MIN, enabled: canRead('Employee') });

  const useBackendKpis = canRead('WorkOrder');
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['dashboard-metrics-own'],
    queryFn: async () => (await base44.functions.invoke('getDashboardMetrics', { scope: 'own' })).data,
    staleTime: 3 * 60 * 1000, retry: 1,
    enabled: useBackendKpis,
  });
  const B = (useBackendKpis && kpis) ? kpis : null;
  const kpiVal = (b, c) => (B != null && b != null ? b : c);

  const pendientes = useMemo(() =>
    filterByUser(allPendientes)
  , [allPendientes, filterByUser]);

  const allUserOrders = useMemo(() =>
    filterByUser(allOrders, ['assigned_name', 'assigned_to', 'jefe_sitio', 'jefe_sitio_email'])
  , [allOrders, filterByUser]);

  const pendientesKpis = useMemo(() => {
    const activos = pendientes.filter(p => ['pendiente', 'asignado', 'en_progreso'].includes(p.estado));
    const resueltos = pendientes.filter(p => p.estado === 'resuelto');
    const urgentes = pendientes.filter(p => p.prioridad === 'urgente' && p.estado !== 'resuelto');
    return { activos: activos.length, resueltos: resueltos.length, urgentes: urgentes.length };
  }, [pendientes]);

  const filterCutoff = useMemo(() => {
    if (dashFilters.dateRange === '7d')  return subDays(new Date(), 7);
    if (dashFilters.dateRange === '30d') return subDays(new Date(), 30);
    if (dashFilters.dateRange === '3m')  return subDays(new Date(), 90);
    return null;
  }, [dashFilters.dateRange]);

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

  const filteredProjects = useMemo(() => {
    if (!filterCutoff) return projects;
    return projects.filter(p => {
      const d = p.updated_date || p.created_date;
      return d && new Date(d) >= filterCutoff;
    });
  }, [projects, filterCutoff]);

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
    const overdueOrders    = orders.filter(o => esOtVencida(o)).length;
    const activeClients    = clients.filter(c => c.status === 'activo').length;
    const activeEmployees  = employees.filter(e => e.status === 'activo').length;

    const revenueThisMonth = invoices.filter(i => i.status === 'pagada' && i.payment_date && parseISO(i.payment_date) >= thisMonth).reduce((s, i) => s + (i.total || 0), 0);
    const revenueLastMonth = invoices.filter(i => i.status === 'pagada' && i.payment_date && parseISO(i.payment_date) >= lastMonth && parseISO(i.payment_date) < thisMonth).reduce((s, i) => s + (i.total || 0), 0);
    const revenueTrend     = revenueLastMonth > 0 ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100) : 0;
    const pendingInvoices  = invoices.filter(i => i.status === 'pendiente').reduce((s, i) => s + (i.total || 0), 0);

    const lowStockItems  = materials.filter(m => m.stock <= m.min_stock && m.min_stock > 0);
    const overdueAssets  = assets.filter(a => { try { return a.next_maintenance && isPast(parseISO(a.next_maintenance)); } catch { return false; } });
    const completedThisMonth = orders.filter(o => o.completed_date && parseISO(o.completed_date) >= thisMonth && o.status === 'completada').length;
    const validOrders     = orders.filter(o => o.status !== 'cancelada');
    const efficiency     = validOrders.length > 0 ? Math.round((orders.filter(o => o.status === 'completada').length / validOrders.length) * 100) : 0;
    const urgentOrders   = orders.filter(o => ['pendiente', 'asignada', 'en_progreso', 'obra', 'pendiente_validacion'].includes(o.status) && ['urgente', 'alta'].includes(o.priority));
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
  const firstName = (displayName || '').split(' ')[0] || '';

  return (
    <div className="min-h-screen bg-background space-y-7 pb-4 lg:pb-10 acero-rise">
      {/* ── HERO ── */}
      <section className="relative min-h-[220px] lg:min-h-[252px] border border-border rounded-2xl overflow-hidden bg-card mb-2 shadow-[0_18px_35px_rgba(15,23,42,0.25)]">
        <img src={HERO_IMG} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50" />
        <div className="absolute inset-0 acero-hero-overlay" />
        <div className="absolute w-60 h-60 rounded-full right-[8%] -top-32 bg-primary/15 blur-sm acero-drift" />
        <div className="relative z-10 p-6 lg:p-9 w-full sm:w-3/5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary mb-3.5">Dashboard</p>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground tracking-tight leading-tight mb-3">
            {greeting}{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="text-sm text-muted-foreground">
            {canRead('WorkOrder') && <>{kpiVal(kpis?.pendingOrders, metrics.pendingOrders)} OTs pendientes · {kpiVal(kpis?.inProgressOrders, metrics.inProgressOrders)} en progreso</>}
            {canRead('WorkOrder') && kpiVal(kpis?.overdueOrders, metrics.overdueOrders) > 0 && <span className="text-amber-400 font-semibold"> · ⚠ {kpiVal(kpis?.overdueOrders, metrics.overdueOrders)} vencidas</span>}
          </p>
          {canRead('WorkOrder') && (
            <div className="flex items-center gap-2.5 mt-5">
              <Link to="/crear-ot">
                <Button size="sm" className="gap-1.5 bg-primary hover:bg-cyan-300 text-primary-foreground border-primary font-bold shadow-sm">
                  <Zap className="h-3.5 w-3.5" /> Crear OT
                </Button>
              </Link>
              <Link to="/ordenes">
                <Button size="sm" variant="outline" className="gap-1.5 font-bold border-border bg-secondary/60 hover:bg-secondary text-foreground">
                  <ClipboardList className="h-3.5 w-3.5" /> Ver OTs
                </Button>
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── ALERTAS ── */}
      <AlertasBanner />

      {/* ── FILTROS GLOBALES ── */}
      <DashboardFilters filters={dashFilters} onChange={setDashFilters} jefes={jefesOptions} />

      {/* ── CRITICAL ALERTS ── */}
      {(() => {
        const _overdue = kpiVal(kpis?.overdueOrders, metrics.overdueOrders);
        const _lowStock = kpiVal(kpis?.lowStockItems, metrics.lowStockItems.length);
        const _overdueAssets = kpiVal(kpis?.overdueAssets, metrics.overdueAssets.length);
        if (!(_overdue > 0 || _lowStock > 0 || _overdueAssets > 0)) return null;
        return (
          <div className="flex flex-wrap gap-2">
            {_overdue > 0 && canRead('WorkOrder') && (
              <Link to="/ordenes" className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/25 text-amber-300 text-sm hover:bg-amber-500/25 transition-all">
                <AlertTriangle className="h-3.5 w-3.5" /> {_overdue} OT{_overdue > 1 ? 's' : ''} vencida{_overdue > 1 ? 's' : ''}
              </Link>
            )}
            {_lowStock > 0 && canRead('Inventory') && (
              <Link to="/inventario" className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/25 text-amber-300 text-sm hover:bg-amber-500/25 transition-all">
                <Package className="h-3.5 w-3.5" /> {_lowStock} material{_lowStock > 1 ? 'es' : ''} bajo stock
              </Link>
            )}
            {_overdueAssets > 0 && canRead('Asset') && (
              <Link to="/activos" className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/25 text-red-300 text-sm hover:bg-red-500/25 transition-all">
                <Wrench className="h-3.5 w-3.5" /> {_overdueAssets} mantenimiento{_overdueAssets > 1 ? 's' : ''} vencido{_overdueAssets > 1 ? 's' : ''}
              </Link>
            )}
          </div>
        );
      })()}

      {/* ── ACCESOS RÁPIDOS ── */}
      {(() => {
        const actions = [
          canRead('WorkOrder')         && { href: '/crear-ot',           icon: Zap,          label: 'Crear OT',     desc: 'Orden rápida',    color: 'bg-cyan-500/15 text-cyan-300' },
          canRead('WorkOrder')         && { href: '/ordenes',            icon: ClipboardList, label: 'OTs',          desc: 'Gestionar',       color: 'bg-cyan-500/15 text-cyan-300' },
          canRead('InspeccionColegio') && { href: '/inspeccion-colegio', icon: Target,        label: 'Inspección',   desc: 'Recorrido colegio', color: 'bg-cyan-500/15 text-cyan-300' },
          canRead('Asset')             && { href: '/activos',            icon: Wrench,        label: 'Pendientes',   desc: 'Gestión SAP',     color: 'bg-cyan-500/15 text-cyan-300' },
          canRead('Certificado')       && { href: '/certificados',       icon: FileCheck,     label: 'Certificados', desc: 'Emitir',          color: 'bg-cyan-500/15 text-cyan-300' },
          canRead('Reportes')          && { href: '/reportes',           icon: BarChart3,     label: 'Reportes',     desc: 'Ver métricas',    color: 'bg-cyan-500/15 text-cyan-300' },
        ].filter(Boolean);
        if (actions.length === 0) return null;
        return (
          <div className={cn(panel, "acero-rise")} style={{ animationDelay: '0.08s' }}>
            <SectionHeader icon={Sparkles} title="Accesos rápidos" subtitle="Tareas frecuentes" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {actions.map((a, i) => <QuickActionCard key={i} {...a} />)}
            </div>
          </div>
        );
      })()}

      {/* ── INDICADORES (KPI GRID) ── */}
      <div className="acero-rise" style={{ animationDelay: '0.16s' }}>
        <SectionHeader title="Indicadores" subtitle="Resumen general del período" />
        {kpisLoading ? (
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <KpiCardSkeleton key={i} />)}
          </div>
        ) : (
        <>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {canRead('WorkOrder')  && <KpiCard href="/ordenes"     title="OTs Pendientes"   value={kpiVal(kpis?.pendingOrders, metrics.pendingOrders)}          subtitle={`${kpiVal(kpis?.completedThisMonth, metrics.completedThisMonth)} completadas este mes`}  icon={ClipboardList} color="amber"  alert={kpiVal(kpis?.overdueOrders, metrics.overdueOrders) > 0 ? kpiVal(kpis?.overdueOrders, metrics.overdueOrders) : undefined} />}
          {canRead('WorkOrder')  && <KpiCard href="/ordenes"     title="En Progreso"      value={kpiVal(kpis?.inProgressOrders, metrics.inProgressOrders)}        subtitle={`${kpiVal(kpis?.efficiency, metrics.efficiency)}% de eficiencia total`}          icon={Activity}      color="cyan" />}
          {canRead('Project')    && <KpiCard href="/proyectos"   title="Proyectos"        value={kpiVal(kpis?.activeProjects, metrics.activeProjects)}         subtitle={`${kpiVal(kpis?.totalProjects, projects.length)} en total`}                          icon={FolderKanban}  color="cyan"   />}
          {canRead('Invoice')    && <KpiCard href="/facturacion" title="Ingresos del Mes" value={fmt(kpiVal(kpis?.revenueThisMonth, metrics.revenueThisMonth))} subtitle={`${fmt(kpiVal(kpis?.pendingInvoices, metrics.pendingInvoices))} por cobrar`}         icon={DollarSign}    color="amber"  trend={kpiVal(kpis?.revenueTrend, metrics.revenueTrend)} />}
        </div>
        <div className="h-4" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {canRead('Client')    && <KpiCard href="/clientes"   title="Proveedores"     value={kpiVal(kpis?.activeClients, metrics.activeClients)}            subtitle={`${kpiVal(kpis?.totalClients, clients.length)} en total`}                        icon={Users}         color="cyan" />}
          {canRead('WorkOrder') && <KpiCard href="/ordenes"    title="Urgentes"        value={kpiVal(kpis?.urgentOrders, metrics.urgentOrders.length)}       subtitle="Alta prioridad activas"                              icon={AlertTriangle} color={kpiVal(kpis?.urgentOrders, metrics.urgentOrders.length) > 0 ? 'red' : 'green'} />}
          {canRead('Pendientes') && <KpiCard href="/activos"    title="Pendientes SAP"  value={kpiVal(kpis?.pendientesActivos, pendientesKpis.activos)} subtitle={`${kpiVal(kpis?.pendientesResueltos, pendientesKpis.resueltos)} resueltos`} icon={Wrench} color="amber" alert={kpiVal(kpis?.pendientesUrgentes, pendientesKpis.urgentes) > 0 ? kpiVal(kpis?.pendientesUrgentes, pendientesKpis.urgentes) : undefined} />}
          {canRead('Inventory') && <KpiCard href="/inventario" title="Materiales"      value={kpiVal(kpis?.totalMaterials, materials.length)}                  subtitle={`${kpiVal(kpis?.lowStockItems, metrics.lowStockItems.length)} bajo mínimo`}      icon={Package}       color={kpiVal(kpis?.lowStockItems, metrics.lowStockItems.length) > 0 ? 'red' : 'amber'} />}
        </div>
        </>
        )}
      </div>

      {/* ── OPERACIÓN ── */}
      {canRead('WorkOrder') && (
        <div className="acero-rise" style={{ animationDelay: '0.24s' }}>
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
        <div className="acero-rise" style={{ animationDelay: '0.32s' }}>
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
        <div className="acero-rise" style={{ animationDelay: '0.32s' }}>
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
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-300" style={{ width: `${p.progress || 0}%` }} />
                        </div>
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
      <div className="acero-rise" style={{ animationDelay: '0.32s' }}>
        <SectionHeader icon={Shield} title="Gestión de sitios" subtitle="Indicadores por jefe de sitio" />
        <KpisJefeSitio filterJefe={dashFilters.jefeSitio} filterCutoff={filterCutoff} orders={allUserOrders} pendientes={pendientes} employees={employees} />
      </div>

      {/* ── MÉTRICAS DE OPERACIÓN ── */}
      <div className="acero-rise" style={{ animationDelay: '0.32s' }}>
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