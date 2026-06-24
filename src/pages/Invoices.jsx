import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsList, TabsContent, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DollarSign, Receipt, BarChart3, FileCheck, Plus,
  TrendingUp, ArrowLeftRight, Wallet, ChevronRight,
  Clock, CheckCircle2, AlertCircle, ArrowUpRight, ArrowDownRight
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

function KpiStrip({ invoices }) {
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

  const cards = [
    {
      label: 'Total facturado', value: fmt(kpis.total), sub: `${kpis.count} facturas`,
      icon: Wallet, color: 'text-primary', border: 'border-primary/20', bg: 'bg-primary/5',
      trend: null,
    },
    {
      label: 'Cobrado', value: fmt(kpis.cobrado), sub: `${kpis.nPaid} facturas · ${kpis.cobPct}%`,
      icon: CheckCircle2, color: 'text-emerald-400', border: 'border-emerald-500/20', bg: 'bg-emerald-500/5',
      trend: <span className="flex items-center gap-0.5 text-emerald-400 text-xs"><ArrowUpRight className="h-3 w-3" />{kpis.cobPct}%</span>,
    },
    {
      label: 'Pendiente de cobro', value: fmt(kpis.pending), sub: `${kpis.nPending} facturas`,
      icon: Clock, color: 'text-amber-400', border: 'border-amber-500/20', bg: 'bg-amber-500/5',
      trend: null,
    },
    {
      label: 'Vencido sin cobrar', value: fmt(kpis.overdue), sub: `${kpis.nOverdue} facturas`,
      icon: AlertCircle, color: 'text-red-400', border: 'border-red-500/20', bg: 'bg-red-500/5',
      trend: kpis.overdue > 0 ? <span className="flex items-center gap-0.5 text-red-400 text-xs"><ArrowDownRight className="h-3 w-3" />Atención</span> : null,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.label} className={`rounded-2xl border ${c.border} ${c.bg} p-4 flex flex-col gap-2`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-medium ${c.color}`}>{c.label}</span>
              <div className={`h-7 w-7 rounded-lg flex items-center justify-center bg-current/10`}>
                <Icon className={`h-3.5 w-3.5 ${c.color}`} />
              </div>
            </div>
            <div>
              <p className="text-xl font-bold text-foreground leading-tight tabular-nums">{c.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{c.sub}</p>
            </div>
            {c.trend && <div className="mt-auto pt-1 border-t border-border/30">{c.trend}</div>}
          </div>
        );
      })}
    </div>
  );
}

const TABS = [
  { key: 'dashboard',     label: 'Dashboard',    icon: DollarSign    },
  { key: 'facturas',      label: 'Facturas',     icon: Receipt       },
  { key: 'flujo',         label: 'Flujo de Caja',icon: ArrowLeftRight },
  { key: 'rentabilidad',  label: 'Rentabilidad', icon: TrendingUp    },
  { key: 'reportes',      label: 'Reportes',     icon: BarChart3     },
  { key: 'certificacion', label: 'Certificación',icon: FileCheck     },
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
    <div className="space-y-6 pb-10">

      {/* ── Hero header ─────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/8 via-primary/3 to-transparent p-6">
        {/* Subtle dot grid */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle, hsl(var(--primary)) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative">
          <div className="flex items-start justify-between flex-wrap gap-4 mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="h-8 w-8 rounded-xl bg-primary/15 flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-primary" />
                </div>
                <h1 className="text-2xl font-bold text-foreground">Centro Financiero</h1>
              </div>
              <p className="text-sm text-muted-foreground">Facturación, cobros, rentabilidad y flujo de caja unificados</p>
            </div>
            <Button onClick={handleNew} className="gap-2 shrink-0 shadow-lg">
              <Plus className="h-4 w-4" /> Nueva Factura
            </Button>
          </div>
          <KpiStrip invoices={invoices} />
        </div>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="border-b border-border/50">
          <TabsList className="h-auto bg-transparent p-0 gap-0 rounded-none flex flex-wrap">
            {TABS.map(({ key, label, icon: Icon }) => (
              <TabsTrigger
                key={key}
                value={key}
                className={`
                  relative flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-none border-b-2
                  data-[state=inactive]:border-transparent data-[state=inactive]:text-muted-foreground
                  data-[state=active]:border-primary data-[state=active]:text-primary
                  hover:text-foreground transition-colors bg-transparent -mb-px
                `}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* ── Dashboard ─────────────────────────────────────────────────── */}
        <TabsContent value="dashboard" className="mt-6">
          <DashboardFinanciero />
        </TabsContent>

        {/* ── Facturas ──────────────────────────────────────────────────── */}
        <TabsContent value="facturas" className="mt-6">
          <TablaFacturas
            invoices={invoices}
            isLoading={isLoading}
            onEdit={handleEdit}
            onDelete={(id) => deleteMutation.mutate(id)}
            onNew={handleNew}
          />
        </TabsContent>

        {/* ── Flujo de caja ─────────────────────────────────────────────── */}
        <TabsContent value="flujo" className="mt-6">
          <div className="space-y-2 mb-4">
            <h2 className="text-base font-semibold text-foreground">Flujo de Caja</h2>
            <p className="text-sm text-muted-foreground">Ingresos cobrados, por cobrar y acumulado histórico</p>
          </div>
          <FlujoDeCaja invoices={invoices} />
        </TabsContent>

        {/* ── Rentabilidad ──────────────────────────────────────────────── */}
        <TabsContent value="rentabilidad" className="mt-6">
          <div className="space-y-2 mb-4">
            <h2 className="text-base font-semibold text-foreground">Rentabilidad por Proyecto</h2>
            <p className="text-sm text-muted-foreground">Presupuesto, ejecución y comparativa por proyecto</p>
          </div>
          <RentabilidadProyectos projects={projects} invoices={invoices} />
        </TabsContent>

        {/* ── Reportes ──────────────────────────────────────────────────── */}
        <TabsContent value="reportes" className="mt-6">
          <ReportesFacturacion />
        </TabsContent>

        {/* ── Certificación de obras ────────────────────────────────────── */}
        <TabsContent value="certificacion" className="mt-6">
          <CertificacionObrasPanel />
        </TabsContent>
      </Tabs>

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