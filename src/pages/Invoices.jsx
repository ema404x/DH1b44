import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  DollarSign, BarChart3, FileCheck, TrendingUp,
  Wallet, Clock, CheckCircle2, AlertCircle,
  ArrowUpRight, ArrowDownRight, Activity, Layers, PieChart
} from 'lucide-react';
import CertificacionObrasPanel from '@/components/invoices/CertificacionObrasPanel';
import DashboardFinanciero from '@/components/finanzas/DashboardFinanciero';
import ReportesFacturacion from '@/components/invoices/ReportesFacturacion';
import RentabilidadProyectos from '@/components/finanzas/RentabilidadProyectos';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

function HeroKpi({ label, value, sub, icon: Icon, color, border, bg, trend, trendUp }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border ${border} p-4 flex flex-col gap-3`} style={{ background: bg }}>
      <div className="flex items-start justify-between">
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center border ${border}`} style={{ background: bg }}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        {trend != null && (
          <div className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${trendUp ? 'bg-emerald-500/12 text-emerald-400' : 'bg-red-500/12 text-red-400'}`}>
            {trendUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {trend}
          </div>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground leading-none tabular-nums tracking-tight">{value}</p>
        <p className={`text-xs font-semibold mt-1 ${color}`}>{label}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

const TABS = [
  { key: 'dashboard',    label: 'Dashboard',    icon: Activity  },
  { key: 'rentabilidad', label: 'Rentabilidad', icon: TrendingUp },
  { key: 'reportes',     label: 'Reportes',     icon: BarChart3  },
  { key: 'certificacion',label: 'Certificación',icon: FileCheck  },
];

export default function Invoices() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const STALE = 2 * 60 * 1000;

  const { data: invoices  = [] } = useQuery({ queryKey: ['invoices'],  queryFn: () => base44.entities.Invoice.list('-created_date'),    staleTime: STALE });
  const { data: projects  = [] } = useQuery({ queryKey: ['projects'],  queryFn: () => base44.entities.Project.list('-updated_date', 300), staleTime: STALE });
  const { data: obras     = [] } = useQuery({ queryKey: ['obras-certificacion'], queryFn: () => base44.entities.ObraCertificacion.list('-created_date', 1000), staleTime: STALE });

  const kpis = useMemo(() => {
    const total   = invoices.reduce((s, i) => s + (i.total || 0), 0);
    const cobrado = invoices.filter(i => i.status === 'pagada').reduce((s, i) => s + (i.total || 0), 0);
    const pending = invoices.filter(i => i.status === 'pendiente').reduce((s, i) => s + (i.total || 0), 0);
    const overdue = invoices.filter(i => i.status === 'vencida').reduce((s, i) => s + (i.total || 0), 0);
    const cobPct  = total > 0 ? Math.round((cobrado / total) * 100) : 0;
    const montoACobrar = obras.filter(o => !o.ciclo_archivado).reduce((s, o) => s + (o.monto_a_cobrar || 0), 0);
    return {
      total, cobrado, pending, overdue, cobPct,
      nPending: invoices.filter(i => i.status === 'pendiente').length,
      nPaid:    invoices.filter(i => i.status === 'pagada').length,
      nOverdue: invoices.filter(i => i.status === 'vencida').length,
      count:    invoices.length,
      montoACobrar,
      nObras:   obras.filter(o => !o.ciclo_archivado).length,
    };
  }, [invoices, obras]);

  return (
    <div className="pb-12 space-y-0">

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl mb-6 border border-border/30"
        style={{ background: 'linear-gradient(135deg, hsl(215,40%,11%) 0%, hsl(213,55%,13%) 60%, hsl(215,35%,10%) 100%)' }}>
        {/* Grid lines */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(hsl(var(--border)/0.10) 1px,transparent 1px),linear-gradient(90deg,hsl(var(--border)/0.10) 1px,transparent 1px)', backgroundSize: '28px 28px' }} />
        {/* Top glow */}
        <div className="absolute -top-12 left-1/3 w-72 h-28 rounded-full opacity-[0.15] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, hsl(213,90%,55%), transparent 70%)' }} />

        <div className="relative px-6 pt-5 pb-6">
          {/* Title row */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl flex items-center justify-center border border-primary/20 bg-primary/10">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground tracking-tight leading-none">Centro Financiero</h1>
                <p className="text-xs text-muted-foreground mt-0.5">Rentabilidad · Reportes · Certificación de Obras</p>
              </div>
            </div>
            {/* Quick stat badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/8 text-xs text-emerald-400 font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {kpis.cobPct}% cobrado
            </div>
          </div>

          {/* KPI grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <HeroKpi
              label="Total Facturado" value={fmt(kpis.total)} sub={`${kpis.count} facturas en total`}
              icon={Wallet} color="text-primary" border="border-primary/20" bg="rgba(59,130,246,0.06)"
            />
            <HeroKpi
              label="Cobrado" value={fmt(kpis.cobrado)} sub={`${kpis.nPaid} facturas pagadas`}
              icon={CheckCircle2} color="text-emerald-400" border="border-emerald-500/20" bg="rgba(16,185,129,0.06)"
              trend={`${kpis.cobPct}%`} trendUp={true}
            />
            <HeroKpi
              label="Pendiente" value={fmt(kpis.pending)} sub={`${kpis.nPending} facturas`}
              icon={Clock} color="text-amber-400" border="border-amber-500/20" bg="rgba(245,158,11,0.06)"
            />
            <HeroKpi
              label="Obras — A Cobrar" value={fmt(kpis.montoACobrar)} sub={`${kpis.nObras} obras activas`}
              icon={TrendingUp} color="text-sky-400" border="border-sky-500/20" bg="rgba(14,165,233,0.06)"
              trend={kpis.overdue > 0 ? `${kpis.nOverdue} venc.` : null} trendUp={false}
            />
          </div>
        </div>
      </div>

      {/* ── Tab nav ──────────────────────────────────────────────────── */}
      <div className="border-b border-border/35 mb-6">
        <div className="flex gap-0 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`relative flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap transition-all duration-150
                ${activeTab === key ? 'text-primary' : 'text-muted-foreground hover:text-foreground/80'}`}
            >
              <Icon className={`h-3.5 w-3.5 shrink-0 transition-colors ${activeTab === key ? 'text-primary' : ''}`} />
              <span className="hidden sm:inline">{label}</span>
              {activeTab === key && (
                <span className="absolute bottom-0 left-4 right-4 h-[2px] bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────── */}
      <div className="page-enter" key={activeTab}>
        {activeTab === 'dashboard'    && <DashboardFinanciero />}
        {activeTab === 'rentabilidad' && <RentabilidadProyectos projects={projects} invoices={invoices} />}
        {activeTab === 'reportes'     && <ReportesFacturacion />}
        {activeTab === 'certificacion'&& <CertificacionObrasPanel />}
      </div>
    </div>
  );
}