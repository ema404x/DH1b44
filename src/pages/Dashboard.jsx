import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  FolderKanban, ClipboardList, Users, DollarSign, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle2, Wrench, ArrowRight, Zap, Package, BarChart3,
  Sparkles, Target, Activity
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
import { format, differenceInDays, isPast, parseISO, startOfMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

const GRADIENT_CONFIGS = {
  blue:    { gradient: 'from-blue-500 to-blue-600',    bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/30' },
  amber:   { gradient: 'from-amber-400 to-amber-500',  bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/30' },
  green:   { gradient: 'from-emerald-500 to-teal-500', bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  primary: { gradient: 'from-primary to-purple-600',   bg: 'bg-primary/20', text: 'text-primary', border: 'border-primary/30' },
  purple:  { gradient: 'from-purple-500 to-violet-600',bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/30' },
  red:     { gradient: 'from-red-500 to-rose-500',     bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/30' },
};

function KpiCard({ title, value, subtitle, icon: Icon, trend, color = 'primary', href }) {
  const cfg = GRADIENT_CONFIGS[color] || GRADIENT_CONFIGS.primary;
  const trendUp = trend > 0;

  const content = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}
      transition={{ type: 'spring', stiffness: 100 }}
    >
      <Card className={`group relative overflow-hidden border-0 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl shadow-lg ${cfg.border} border`}>
        <div className={`absolute inset-0 bg-gradient-to-br ${cfg.gradient} opacity-10`} />
        <CardContent className="relative pt-5 pb-5 px-5">
          <div className="flex items-start justify-between mb-4">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${cfg.bg} border ${cfg.border}`}>
              <Icon className={`h-5 w-5 ${cfg.text}`} />
            </div>
            {trend !== undefined && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${trendUp ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}
              >
                {trendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(trend)}%
              </motion.div>
            )}
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
          <div className="text-xs font-semibold text-slate-400 mt-2 uppercase tracking-wide">{title}</div>
          {subtitle && <div className="text-xs text-slate-500 mt-1">{subtitle}</div>}
        </CardContent>
      </Card>
    </motion.div>
  );

  return href ? <Link to={href}>{content}</Link> : content;
}

export default function Dashboard() {
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list() });
  const { data: orders = [] } = useQuery({ queryKey: ['workorders'], queryFn: () => base44.entities.WorkOrder.list() });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list() });
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: () => base44.entities.Invoice.list() });
  const { data: materials = [] } = useQuery({ queryKey: ['materials'], queryFn: () => base44.entities.Material.list() });
  const { data: assets = [] } = useQuery({ queryKey: ['assets'], queryFn: () => base44.entities.Asset.list() });
  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: () => base44.entities.Employee.list() });

  const metrics = useMemo(() => {
    const thisMonth = startOfMonth(new Date());
    const lastMonth = startOfMonth(subMonths(new Date(), 1));

    const activeProjects = projects.filter(p => p.status === 'en_progreso').length;
    const pendingOrders = orders.filter(o => ['pendiente', 'asignada'].includes(o.status)).length;
    const overdueOrders = orders.filter(o => o.scheduled_date && isPast(parseISO(o.scheduled_date)) && !['completada', 'cancelada'].includes(o.status)).length;
    const activeClients = clients.filter(c => c.status === 'activo').length;
    const activeEmployees = employees.filter(e => e.status === 'activo').length;

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

    return {
      activeProjects, pendingOrders, overdueOrders, activeClients, activeEmployees,
      revenueThisMonth, revenueTrend, pendingInvoices,
      lowStockItems, overdueAssets, completedThisMonth, efficiency,
      recentProjects, urgentOrders, hasAlerts,
    };
  }, [projects, orders, clients, invoices, materials, assets, employees]);

  const {
    activeProjects, pendingOrders, overdueOrders, activeClients, activeEmployees,
    revenueThisMonth, revenueTrend, pendingInvoices,
    lowStockItems, overdueAssets, completedThisMonth, efficiency,
    recentProjects, urgentOrders, hasAlerts,
  } = metrics;

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.1 } }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 space-y-6">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/30 rounded-full blur-3xl opacity-20 animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-white">Panel de Control</h1>
        <p className="text-slate-400 flex items-center gap-2">
          <Activity className="h-4 w-4" />
          {format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })}
        </p>
      </motion.div>

      {/* Alertas */}
      <AlertasBanner />

      {/* Critical Alerts */}
      {hasAlerts && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap gap-2">
          {overdueOrders > 0 && (
            <Link to="/ordenes" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30 transition-all">
              <AlertTriangle className="h-4 w-4" /> {overdueOrders} OT vencida{overdueOrders > 1 ? 's' : ''}
            </Link>
          )}
          {lowStockItems.length > 0 && (
            <Link to="/inventario" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30 transition-all">
              <Package className="h-4 w-4" /> {lowStockItems.length} material{lowStockItems.length > 1 ? 'es' : ''} bajo
            </Link>
          )}
        </motion.div>
      )}

      {/* KPI Grid */}
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard href="/proyectos"   title="Proyectos" value={activeProjects}       subtitle={`${projects.length} en total`}                     icon={FolderKanban}  color="blue" />
        <KpiCard href="/ordenes"     title="OTs Pendientes"    value={pendingOrders}         subtitle={`${completedThisMonth} completadas`}        icon={ClipboardList} color="amber" />
        <KpiCard href="/facturacion" title="Ingresos Mes"  value={fmt(revenueThisMonth)} subtitle={`${fmt(pendingInvoices)} por cobrar`}                icon={DollarSign}    color="green" trend={revenueTrend} />
        <KpiCard href="/ordenes"     title="Eficiencia"    value={`${efficiency}%`}      subtitle={`${activeEmployees} técnicos activos`}               icon={BarChart3}     color="primary" />
      </motion.div>

      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard href="/clientes"   title="Clientes"   value={activeClients}          subtitle={`${clients.length} en total`}                        icon={Users}         color="purple" />
        <KpiCard href="/ordenes"    title="OTs Urgentes"       value={urgentOrders.length}     subtitle="Alta o urgente"                            icon={AlertTriangle} color={urgentOrders.length > 0 ? 'red' : 'green'} />
        <KpiCard href="/activos"    title="Activos" value={assets.length}          subtitle={`${overdueAssets.length} mant. vencido`}         icon={Wrench}        color="amber" />
        <KpiCard href="/inventario" title="Materiales" value={materials.length}       subtitle={`${lowStockItems.length} bajo mínimo`}               icon={Package}       color={lowStockItems.length > 0 ? 'red' : 'green'} />
      </motion.div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="lg:col-span-2">
          <RevenueChart invoices={invoices} />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="border-0 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl shadow-lg">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-white">Proyectos en Curso</CardTitle>
                <Link to="/proyectos">
                  <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-slate-400 hover:text-white">
                    Ver todos <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentProjects.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">Sin proyectos activos</p>
              ) : (
                recentProjects.map(p => (
                  <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-white truncate">{p.name}</span>
                      <span className="text-xs font-bold text-primary flex-shrink-0">{p.progress || 0}%</span>
                    </div>
                    <Progress value={p.progress || 0} className="h-1.5 bg-slate-700" />
                    <p className="text-xs text-slate-500">{p.client_name}</p>
                  </motion.div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Emergencias */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
        <EmergenciasWidget />
      </motion.div>

      {/* OTs + Certificados */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <OTsPendientesPanel orders={orders} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <CertificadosPanel />
        </motion.div>
      </div>

      {/* Métricas */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
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