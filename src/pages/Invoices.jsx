import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  DollarSign, Receipt, BarChart3, FileCheck, Plus,
  TrendingUp, ArrowLeftRight, Wallet, TrendingDown,
  Clock, CheckCircle2, AlertCircle, ArrowUpRight, ArrowDownRight,
  Activity, Layers
} from 'lucide-react';
import EntityFormDialog from '@/components/shared/EntityFormDialog';
import CertificacionObrasPanel from '@/components/invoices/CertificacionObrasPanel';
import DashboardFinanciero from '@/components/finanzas/DashboardFinanciero';
import TablaFacturas from '@/components/invoices/TablaFacturas';
import ReportesFacturacion from '@/components/invoices/ReportesFacturacion';
import RentabilidadProyectos from '@/components/finanzas/RentabilidadProyectos';
import FlujoDeCaja from '@/components/finanzas/FlujoDeCaja';

const invoiceFields = [
  { key: 'code',         label: 'Número de Factura', placeholder: 'FAC-001' },
  { key: 'client_name',  label: 'Cliente', required: true },
  { key: 'project_name', label: 'Proyecto' },
  { key: 'status', label: 'Estado', type: 'select', options: [
    { value: 'pendiente', label: 'Pendiente' },
    { value: 'pagada',    label: 'Pagada'    },
    { value: 'vencida',   label: 'Vencida'   },
    { value: 'cancelada', label: 'Cancelada' },
  ]},
  { key: 'subtotal',     label: 'Subtotal ($)',         type: 'number' },
  { key: 'tax_rate',     label: 'IVA (%)',              type: 'number' },
  { key: 'total',        label: 'Total ($)',            type: 'number' },
  { key: 'issue_date',   label: 'Fecha de Emisión',     type: 'date'   },
  { key: 'due_date',     label: 'Fecha de Vencimiento', type: 'date'   },
  { key: 'payment_date', label: 'Fecha de Pago',        type: 'date'   },
  { key: 'notes',        label: 'Notas',                type: 'textarea' },
];

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

function KpiCard({ label, value, sub, icon: Icon, color, border, bg, trend, trendUp }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border ${border} ${bg} p-4 flex flex-col gap-3 group`}>
      {/* Subtle glow accent */}
      <div className={`absolute -top-6 -right-6 h-20 w-20 rounded-full opacity-[0.07] ${bg.replace('/5','/60')}`} />
      <div className="flex items-start justify-between relative">
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${bg} border ${border}`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        {trend != null && (
          <div className={`flex items-center gap-0.5 text-xs font-medium px-2 py-0.5 rounded-full ${trendUp ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
            {trendUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {trend}
          </div>
        )}
      </div>
      <div className="relative">
        <p className="text-2xl font-bold text-foreground leading-tight tabular-nums tracking-tight">{value}</p>
        <p className={`text-xs font-medium mt-0.5 ${color}`}>{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

const TABS = [
  { key: 'dashboard',     label: 'Dashboard',     icon: Activity      },
  { key: 'facturas',      label: 'Facturas',      icon: Receipt       },
  { key: 'flujo',         label: 'Flujo de Caja', icon: ArrowLeftRight },
  { key: 'rentabilidad',  label: 'Rentabilidad',  icon: TrendingUp    },
  { key: 'reportes',      label: 'Reportes',      icon: BarChart3     },
  { key: 'certificacion', label: 'Certificación', icon: FileCheck     },
];

export default function Invoices() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing]       = useState(null);
  const [activeTab, setActiveTab]   = useState('dashboard');
  const queryClient = useQueryClient();
  const STALE = 2 * 60 * 1000;

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list('-created_date'),
    staleTime: STALE,
    refetchOnWindowFocus: true,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-updated_date', 300),
    staleTime: STALE,
  });

  const kpis = useMemo(() => {
    const total    = invoices.reduce((s, i) => s + (i.total || 0), 0);
    const cobrado  = invoices.filter(i => i.status === 'pagada').reduce((s, i) => s + (i.total || 0), 0);
    const pending  = invoices.filter(i => i.status === 'pendiente').reduce((s, i) => s + (i.total || 0), 0);
    const overdue  = invoices.filter(i => i.status === 'vencida').reduce((s, i) => s + (i.total || 0), 0);
    const cobPct   = total > 0 ? Math.round((cobrado / total) * 100) : 0;
    return {
      total, cobrado, pending, overdue, cobPct,
      nPending: invoices.filter(i => i.status === 'pendiente').length,
      nPaid:    invoices.filter(i => i.status === 'pagada').length,
      nOverdue: invoices.filter(i => i.status === 'vencida').length,
      count:    invoices.length,
    };
  }, [invoices]);

  const saveMutation = useMutation({
    mutationFn: (data) => editing
      ? base44.entities.Invoice.update(editing.id, data)
      : base44.entities.Invoice.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setDialogOpen(false);
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Invoice.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  });

  const handleEdit = (inv) => { setEditing(inv); setDialogOpen(true); };
  const handleNew  = ()    => { setEditing(null); setDialogOpen(true); };

  return (
    <div className="min-h-screen space-y-0 pb-12">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl mb-6"
        style={{ background: 'linear-gradient(135deg, hsl(215,45%,12%) 0%, hsl(213,60%,14%) 50%, hsl(215,35%,11%) 100%)' }}>
        {/* Grid texture */}
        <div className="absolute inset-0"
          style={{ backgroundImage: 'linear-gradient(hsl(var(--border)/0.12) 1px,transparent 1px),linear-gradient(90deg,hsl(var(--border)/0.12) 1px,transparent 1px)', backgroundSize: '32px 32px' }} />
        {/* Radial glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-32 rounded-full opacity-20"
          style={{ background: 'radial-gradient(ellipse, hsl(213,90%,55%) 0%, transparent 70%)' }} />

        <div className="relative px-6 py-6">
          {/* Top row */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl flex items-center justify-center border border-primary/30"
                style={{ background: 'linear-gradient(135deg,hsl(213,90%,20%),hsl(213,90%,12%))' }}>
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground tracking-tight">Centro Financiero</h1>
                <p className="text-xs text-muted-foreground">Facturación · Cobros · Rentabilidad · Obras</p>
              </div>
            </div>
            <Button onClick={handleNew} size="sm" className="gap-2 shadow-lg shadow-primary/20">
              <Plus className="h-3.5 w-3.5" /> Nueva Factura
            </Button>
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              label="Total facturado" value={fmt(kpis.total)} sub={`${kpis.count} facturas en total`}
              icon={Wallet} color="text-primary" border="border-primary/25" bg="bg-primary/8"
              trend={null}
            />
            <KpiCard
              label="Cobrado" value={fmt(kpis.cobrado)} sub={`${kpis.nPaid} facturas pagadas`}
              icon={CheckCircle2} color="text-emerald-400" border="border-emerald-500/25" bg="bg-emerald-500/8"
              trend={`${kpis.cobPct}%`} trendUp={true}
            />
            <KpiCard
              label="Pendiente de cobro" value={fmt(kpis.pending)} sub={`${kpis.nPending} facturas`}
              icon={Clock} color="text-amber-400" border="border-amber-500/25" bg="bg-amber-500/8"
              trend={null}
            />
            <KpiCard
              label="Vencido sin cobrar" value={fmt(kpis.overdue)} sub={`${kpis.nOverdue} facturas`}
              icon={AlertCircle} color="text-red-400" border="border-red-500/25" bg="bg-red-500/8"
              trend={kpis.nOverdue > 0 ? 'Atención' : null} trendUp={false}
            />
          </div>
        </div>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div className="border-b border-border/40 mb-6">
        <div className="flex gap-0 overflow-x-auto scrollbar-none">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`
                relative flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors
                ${activeTab === key
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
                }
              `}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">{label}</span>
              {activeTab === key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────── */}
      <div className="page-enter">
        {activeTab === 'dashboard'     && <DashboardFinanciero />}
        {activeTab === 'facturas'      && (
          <TablaFacturas
            invoices={invoices}
            isLoading={isLoading}
            onEdit={handleEdit}
            onDelete={(id) => deleteMutation.mutate(id)}
            onNew={handleNew}
          />
        )}
        {activeTab === 'flujo'         && (
          <div className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Flujo de Caja</h2>
              <p className="text-sm text-muted-foreground">Ingresos cobrados, por cobrar y acumulado histórico</p>
            </div>
            <FlujoDeCaja invoices={invoices} />
          </div>
        )}
        {activeTab === 'rentabilidad'  && (
          <div className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Rentabilidad por Proyecto</h2>
              <p className="text-sm text-muted-foreground">Presupuesto, ejecución y comparativa por proyecto</p>
            </div>
            <RentabilidadProyectos projects={projects} invoices={invoices} />
          </div>
        )}
        {activeTab === 'reportes'      && <ReportesFacturacion />}
        {activeTab === 'certificacion' && <CertificacionObrasPanel />}
      </div>

      <EntityFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? 'Editar Factura' : 'Nueva Factura'}
        fields={invoiceFields}
        initialData={editing || { status: 'pendiente', tax_rate: 21 }}
        onSave={(data) => saveMutation.mutate(data)}
        saving={saveMutation.isPending}
      />
    </div>
  );
}