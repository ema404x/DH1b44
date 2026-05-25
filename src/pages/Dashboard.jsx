import React, { useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
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
import RevenueChart from '@/components/dashboard/RevenueChart';
import OTsPendientesPanel from '@/components/dashboard/OTsPendientesPanel';
import CertificadosPanel from '@/components/dashboard/CertificadosPanel';
import MetricasOperacion from '@/components/dashboard/MetricasOperacion';
import AlertasBanner from '@/components/dashboard/AlertasBanner';
import EmergenciasWidget from '@/components/dashboard/EmergenciasWidget';
import KpisJefeSitio from '@/components/dashboard/KpisJefeSitio';
import AuroraEffect from '@/components/dashboard/AuroraEffect';
import { format, isPast, parseISO, startOfMonth, subMonths, formatDistanceToNow } from 'date-fns';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { es } from 'date-fns/locale';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } } };
const fadeUp = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 120, damping: 16 } } };

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

function KpiCard({ title, value, subtitle, icon: Icon, color = 'blue', trend, href, alert }) {
  const COLORS = {
    blue:    { ring: 'ring-blue-500/30',    icon: 'bg-blue-500/20 text-blue-300',    glow: 'from-blue-500/10' },
    amber:   { ring: 'ring-amber-500/30',   icon: 'bg-amber-500/20 text-amber-300',  glow: 'from-amber-500/10' },
    green:   { ring: 'ring-emerald-500/30', icon: 'bg-emerald-500/20 text-emerald-300', glow: 'from-emerald-500/10' },
    purple:  { ring: 'ring-purple-500/30',  icon: 'bg-purple-500/20 text-purple-300',glow: 'from-purple-500/10' },
    red:     { ring: 'ring-red-500/30',     icon: 'bg-red-500/20 text-red-300',      glow: 'from-red-500/10' },
    primary: { ring: 'ring-primary/30',     icon: 'bg-primary/20 text-primary',      glow: 'from-primary/10' },
  };
  const cfg = COLORS[color] || COLORS.blue;

  const inner = (
    <motion.div variants={fadeUp} whileHover={{ y: -3, transition: { duration: 0.2 } }}>
      <div className={`relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-xl shadow-xl ring-1 ${cfg.ring} p-5 h-full`}>
        <div className={`absolute inset-0 bg-gradient-to-br ${cfg.glow} to-transparent opacity-60 pointer-events-none`} />
        <div className="relative flex items-start justify-between mb-4">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${cfg.icon}`}>
            <Icon className="h-5 w-5" />
          </div>
          {trend !== undefined && (
            <span className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${trend >= 0 ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' : 'bg-red-500/15 text-red-300 border-red-500/25'}`}>
              {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(trend)}%
            </span>
          )}
          {alert && (
            <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
              <AlertTriangle className="h-3 w-3" /> {alert}
            </span>
          )}
        </div>
        <div className="relative">
          <p className="text-3xl font-bold text-white tracking-tight leading-none">{value}</p>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-2">{title}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
      </div>
    </motion.div>
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
    <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-500">
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
          <div key={o.id} className={`flex items-start gap-3 py-3 ${i < recent.length - 1 ? 'border-b border-white/5' : ''}`}>
            <div className="mt-1 flex-shrink-0 flex flex-col items-center gap-1">
              <div className={`h-2 w-2 rounded-full ${sc.dot}`} />
              {i < recent.length - 1 && <div className="w-px flex-1 bg-white/5 h-full min-h-[1rem]" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white/90 truncate leading-tight">{o.title}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border capitalize ${pc}`}>{o.priority}</span>
                {o.location_qr_name && (
                  <span className="flex items-center gap-0.5 text-[10px] text-slate-500">
                    <MapPin className="h-2.5 w-2.5" />{o.location_qr_name}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className={`text-[10px] font-medium capitalize ${sc.text}`}>{o.status?.replace('_', ' ')}</p>
              {date && (
                <p className="text-[10px] text-slate-600 mt-0.5">
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
      <motion.div whileHover={{ y: -2 }} className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-white/3 hover:bg-white/8 transition-colors cursor-pointer group">
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white group-hover:text-primary transition-colors">{label}</p>
          <p className="text-[10px] text-slate-500">{desc}</p>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-600 group-hover:text-primary ml-auto flex-shrink-0 transition-colors" />
      </motion.div>
    </Link>
  );
}

export default function Dashboard() {
  const { isAdmin, filterByUser, userPermissions, user } = useCurrentUser();

  const canRead = useCallback((moduleKey) => {
    if (user?.role === 'admin') return true;
    if (!userPermissions) return false;
    return userPermissions[moduleKey]?.read === true;
  }, [user, userPermissions]);

  // Solo fetchar si el usuario tiene acceso al módulo + refresco cada 30s
  const { data: projects = [] }  = useQuery({ queryKey: ['projects'],   queryFn: () => base44.entities.Project.list('-updated_date', 200),   staleTime: 30000, refetchInterval: 30000, enabled: canRead('Project') });
  const { data: allOrders = [] } = useQuery({ queryKey: ['workorders'], queryFn: () => base44.entities.WorkOrder.list('-updated_date', 300),  staleTime: 30000, refetchInterval: 30000, enabled: canRead('WorkOrder') });
  const { data: clients = [] }   = useQuery({ queryKey: ['clients'],    queryFn: () => base44.entities.Client.list('-updated_date', 200),     staleTime: 60000, refetchInterval: 60000, enabled: canRead('Client') });
  const { data: invoices = [] }  = useQuery({ queryKey: ['invoices'],   queryFn: () => base44.entities.Invoice.list('-updated_date', 200),    staleTime: 30000, refetchInterval: 30000, enabled: canRead('Invoice') });
  const { data: materials = [] } = useQuery({ queryKey: ['materials'],  queryFn: () => base44.entities.Material.list('-updated_date', 200),   staleTime: 60000, refetchInterval: 60000, enabled: canRead('Inventory') });
  const { data: assets = [] }    = useQuery({ queryKey: ['assets'],     queryFn: () => base44.entities.Asset.list('-updated_date', 200),      staleTime: 60000, refetchInterval: 60000, enabled: canRead('Asset') });
  const { data: employees = [] } = useQuery({ queryKey: ['employees'],  queryFn: () => base44.entities.Employee.list('-updated_date', 100),   staleTime: 60000, refetchInterval: 60000, enabled: canRead('Employee') });

  const orders = useMemo(() =>
    filterByUser(allOrders, ['assigned_name', 'assigned_to', 'created_by'])
  , [allOrders, isAdmin, filterByUser]);

  const metrics = useMemo(() => {
    const thisMonth = startOfMonth(new Date());
    const lastMonth = startOfMonth(subMonths(new Date(), 1));

    const activeProjects   = projects.filter(p => p.status === 'en_progreso').length;
    const pendingOrders    = orders.filter(o => ['pendiente', 'asignada'].includes(o.status)).length;
    const inProgressOrders = orders.filter(o => o.status === 'en_progreso').length;
    const overdueOrders    = orders.filter(o => o.scheduled_date && isPast(parseISO(o.scheduled_date)) && !['completada', 'cancelada'].includes(o.status)).length;
    const activeClients    = clients.filter(c => c.status === 'activo').length;
    const activeEmployees  = employees.filter(e => e.status === 'activo').length;

    const revenueThisMonth = invoices.filter(i => i.status === 'pagada' && i.payment_date && parseISO(i.payment_date) >= thisMonth).reduce((s, i) => s + (i.total || 0), 0);
    const revenueLastMonth = invoices.filter(i => i.status === 'pagada' && i.payment_date && parseISO(i.payment_date) >= lastMonth && parseISO(i.payment_date) < thisMonth).reduce((s, i) => s + (i.total || 0), 0);
    const revenueTrend     = revenueLastMonth > 0 ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100) : 0;
    const pendingInvoices  = invoices.filter(i => i.status === 'pendiente').reduce((s, i) => s + (i.total || 0), 0);

    const lowStockItems  = materials.filter(m => m.stock <= m.min_stock && m.min_stock > 0);
    const overdueAssets  = assets.filter(a => a.next_maintenance && isPast(parseISO(a.next_maintenance)));
    const completedThisMonth = orders.filter(o => o.completed_date && parseISO(o.completed_date) >= thisMonth && o.status === 'completada').length;
    const efficiency     = orders.length > 0 ? Math.round((orders.filter(o => o.status === 'completada').length / orders.length) * 100) : 0;
    const urgentOrders   = orders.filter(o => ['pendiente', 'asignada', 'en_progreso'].includes(o.status) && ['urgente', 'alta'].includes(o.priority));
    const recentProjects = projects.filter(p => p.status === 'en_progreso').slice(0, 5);
    const hasAlerts      = overdueOrders > 0 || lowStockItems.length > 0 || overdueAssets.length > 0;

    return {
      activeProjects, pendingOrders, inProgressOrders, overdueOrders, activeClients, activeEmployees,
      revenueThisMonth, revenueTrend, pendingInvoices,
      lowStockItems, overdueAssets, completedThisMonth, efficiency,
      recentProjects, urgentOrders, hasAlerts,
    };
  }, [projects, orders, clients, invoices, materials, assets, employees]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const firstName = user?.full_name?.split(' ')[0] || '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 space-y-6 pb-10">
      <AuroraEffect />
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-48 -right-48 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-purple-600/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '3s' }} />
        <div className="absolute -bottom-32 right-1/3 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1.5s' }} />
      </div>

      {/* ── HEADER ── */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1">
        <div>
          <p className="text-slate-400 text-sm flex items-center gap-1.5 mb-1">
            <Calendar className="h-3.5 w-3.5" />
            {format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })}
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            {greeting}{firstName ? `, ${firstName}` : ''} <span className="text-2xl">👋</span>
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {canRead('WorkOrder') && <>{metrics.pendingOrders} OTs pendientes · {metrics.inProgressOrders} en progreso</>}
            {canRead('WorkOrder') && metrics.overdueOrders > 0 && <span className="text-red-400 font-semibold"> · ⚠ {metrics.overdueOrders} vencidas</span>}
          </p>
        </div>
        {canRead('WorkOrder') && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link to="/crear-ot">
              <Button size="sm" className="gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 border-0">
                <Zap className="h-3.5 w-3.5" /> Crear OT
              </Button>
            </Link>
            <Link to="/ordenes">
              <Button size="sm" variant="outline" className="gap-1.5 border-white/10 text-slate-300 hover:text-white">
                <ClipboardList className="h-3.5 w-3.5" /> Ver OTs
              </Button>
            </Link>
          </div>
        )}
      </motion.div>

      {/* ── ALERTAS ── */}
      <AlertasBanner />

      {/* ── CRITICAL ALERTS ── */}
      {metrics.hasAlerts && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap gap-2">
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
        </motion.div>
      )}

      {/* ── KPI GRID (4 cols) ── */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {canRead('WorkOrder')  && <KpiCard href="/ordenes"     title="OTs Pendientes"  value={metrics.pendingOrders}         subtitle={`${metrics.completedThisMonth} completadas este mes`}   icon={ClipboardList} color="amber"  alert={metrics.overdueOrders > 0 ? metrics.overdueOrders : undefined} />}
        {canRead('WorkOrder')  && <KpiCard href="/ordenes"     title="En Progreso"     value={metrics.inProgressOrders}      subtitle={`${metrics.efficiency}% de eficiencia total`}           icon={Activity}      color="purple" />}
        {canRead('Project')    && <KpiCard href="/proyectos"   title="Proyectos"       value={metrics.activeProjects}        subtitle={`${projects.length} en total`}                          icon={FolderKanban}  color="blue"   />}
        {canRead('Invoice')    && <KpiCard href="/facturacion" title="Ingresos del Mes" value={fmt(metrics.revenueThisMonth)} subtitle={`${fmt(metrics.pendingInvoices)} por cobrar`}         icon={DollarSign}    color="green"  trend={metrics.revenueTrend} />}
      </motion.div>

      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {canRead('Client')    && <KpiCard href="/clientes"   title="Proveedores"  value={metrics.activeClients}            subtitle={`${clients.length} en total`}                        icon={Users}         color="primary" />}
        {canRead('WorkOrder') && <KpiCard href="/ordenes"    title="Urgentes"     value={metrics.urgentOrders.length}      subtitle="Alta prioridad activas"                              icon={AlertTriangle} color={metrics.urgentOrders.length > 0 ? 'red' : 'green'} />}
        {canRead('Asset')     && <KpiCard href="/activos"    title="Activos"      value={assets.length}                    subtitle={`${metrics.overdueAssets.length} mant. vencido`}    icon={Wrench}        color="amber"  />}
        {canRead('Inventory') && <KpiCard href="/inventario" title="Materiales"   value={materials.length}                 subtitle={`${metrics.lowStockItems.length} bajo mínimo`}      icon={Package}       color={metrics.lowStockItems.length > 0 ? 'red' : 'green'} />}
      </motion.div>

      {/* ── MAIN CONTENT ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Revenue chart — 2/3 */}
        {canRead('Invoice') && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="xl:col-span-2">
            <RevenueChart invoices={invoices} />
          </motion.div>
        )}

        {/* Activity Feed — 1/3 */}
        {canRead('WorkOrder') && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-xl shadow-xl h-full p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-white">Actividad Reciente</h3>
                </div>
                <Link to="/ordenes">
                  <Button variant="ghost" size="sm" className="h-6 text-[11px] text-slate-500 hover:text-white gap-1 px-2">
                    Ver todas <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
              <ActivityFeed orders={orders} />
            </div>
          </motion.div>
        )}
      </div>

      {/* ── EMERGENCIAS + PROYECTOS ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {canRead('Emergencias') && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="xl:col-span-2">
            <EmergenciasWidget />
          </motion.div>
        )}

        {/* Proyectos en curso */}
        {canRead('Project') && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}>
            <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-xl shadow-xl p-4 h-full">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FolderKanban className="h-4 w-4 text-blue-400" />
                  <h3 className="text-sm font-semibold text-white">Proyectos en Curso</h3>
                </div>
                <Link to="/proyectos">
                  <Button variant="ghost" size="sm" className="h-6 text-[11px] text-slate-500 hover:text-white gap-1 px-2">
                    Ver <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
              {metrics.recentProjects.length === 0 ? (
                <div className="flex items-center justify-center h-24 text-xs text-slate-600">Sin proyectos activos</div>
              ) : (
                <div className="space-y-4">
                  {metrics.recentProjects.map(p => (
                    <div key={p.id} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-white truncate flex-1">{p.name}</p>
                        <span className="text-xs font-bold text-primary flex-shrink-0">{p.progress || 0}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-primary to-purple-500 transition-all" style={{ width: `${p.progress || 0}%` }} />
                      </div>
                      {p.client_name && <p className="text-[10px] text-slate-600">{p.client_name}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* ── OTs + CERTIFICADOS ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {canRead('WorkOrder') && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <OTsPendientesPanel orders={orders} />
          </motion.div>
        )}
        {canRead('Certificado') && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
            <CertificadosPanel />
          </motion.div>
        )}
      </div>

      {/* ── QUICK ACTIONS (solo módulos accesibles) ── */}
      {(() => {
        const actions = [
          canRead('WorkOrder')         && { href: '/crear-ot',           icon: Zap,          label: 'Crear OT',     desc: 'Orden rápida',    color: 'bg-emerald-500/20 text-emerald-300' },
          canRead('WorkOrder')         && { href: '/ordenes',            icon: ClipboardList, label: 'OTs',          desc: 'Gestionar',       color: 'bg-amber-500/20 text-amber-300' },
          canRead('InspeccionColegio') && { href: '/inspeccion-colegio', icon: Target,        label: 'Inspección',   desc: 'Recorrido',       color: 'bg-blue-500/20 text-blue-300' },
          canRead('Asset')             && { href: '/activos',            icon: ClipboardList, label: 'Pendientes',   desc: 'SAP',             color: 'bg-purple-500/20 text-purple-300' },
          canRead('Certificado')       && { href: '/certificados',       icon: FileCheck,     label: 'Certificados', desc: 'Emitir',          color: 'bg-teal-500/20 text-teal-300' },
          canRead('Reportes')          && { href: '/reportes',           icon: BarChart3,     label: 'Reportes',     desc: 'Ver métricas',    color: 'bg-pink-500/20 text-pink-300' },
        ].filter(Boolean);
        if (actions.length === 0) return null;
        return (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.58 }}>
            <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-white">Acciones Rápidas</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {actions.map((a, i) => <QuickActionCard key={i} {...a} />)}
              </div>
            </div>
          </motion.div>
        );
      })()}

      {/* ── KPIs JEFE SITIO ── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.62 }}>
        <KpisJefeSitio />
      </motion.div>

      {/* ── MÉTRICAS OPERACIÓN ── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}>
        <MetricasOperacion
          orders={orders}
          projects={projects}
          materials={materials}
          assets={assets}
          employees={employees}
        />
      </motion.div>
    </div>
  );
}