import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsList, TabsContent, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { DollarSign, Receipt, BarChart3, FileCheck, Plus } from 'lucide-react';
import EntityFormDialog from '@/components/shared/EntityFormDialog';
import CertificacionObrasPanel from '@/components/invoices/CertificacionObrasPanel';
import DashboardFinanciero from '@/components/finanzas/DashboardFinanciero';
import TablaFacturas from '@/components/invoices/TablaFacturas';
import ReportesFacturacion from '@/components/invoices/ReportesFacturacion';

const invoiceFields = [
  { key: 'code',         label: 'Número de Factura', placeholder: 'FAC-001' },
  { key: 'client_name',  label: 'Cliente', required: true },
  { key: 'project_name', label: 'Proyecto' },
  { key: 'status',       label: 'Estado', type: 'select', options: [
    { value: 'pendiente',  label: 'Pendiente'  },
    { value: 'pagada',     label: 'Pagada'     },
    { value: 'vencida',    label: 'Vencida'    },
    { value: 'cancelada',  label: 'Cancelada'  },
  ]},
  { key: 'subtotal',      label: 'Subtotal ($)',           type: 'number' },
  { key: 'tax_rate',      label: 'IVA (%)',                type: 'number' },
  { key: 'total',         label: 'Total ($)',              type: 'number' },
  { key: 'issue_date',    label: 'Fecha de Emisión',       type: 'date'   },
  { key: 'due_date',      label: 'Fecha de Vencimiento',   type: 'date'   },
  { key: 'payment_date',  label: 'Fecha de Pago',          type: 'date'   },
  { key: 'notes',         label: 'Notas',                  type: 'textarea' },
];

export default function Invoices() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing]       = useState(null);
  const [activeTab, setActiveTab]   = useState('dashboard');
  const queryClient = useQueryClient();

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list('-created_date'),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
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

  const handleEdit   = (inv) => { setEditing(inv); setDialogOpen(true); };
  const handleNew    = ()    => { setEditing(null); setDialogOpen(true); };

  // KPIs rápidos para el header
  const kpis = useMemo(() => {
    const pending  = invoices.filter(i => i.status === 'pendiente').reduce((s, i) => s + (i.total || 0), 0);
    const paid     = invoices.filter(i => i.status === 'pagada').reduce((s, i) => s + (i.total || 0), 0);
    const overdue  = invoices.filter(i => i.status === 'vencida').reduce((s, i) => s + (i.total || 0), 0);
    const total    = invoices.reduce((s, i) => s + (i.total || 0), 0);
    return { pending, paid, overdue, total, count: invoices.length };
  }, [invoices]);

  const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

  return (
    <div className="space-y-6 pb-10">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/5 via-primary/2 to-transparent p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Facturación</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Gestión integral de facturas, cobros y reportes financieros</p>
          </div>
          <Button onClick={handleNew} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" /> Nueva Factura
          </Button>
        </div>

        {/* KPI strip */}
        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-background/60 border border-border/50 rounded-xl p-3">
            <p className="text-xs text-muted-foreground">Total facturado</p>
            <p className="text-lg font-bold text-foreground mt-0.5">{fmt(kpis.total)}</p>
            <p className="text-xs text-muted-foreground">{kpis.count} facturas</p>
          </div>
          <div className="bg-background/60 border border-amber-500/20 rounded-xl p-3">
            <p className="text-xs text-amber-400">Pendiente de cobro</p>
            <p className="text-lg font-bold text-foreground mt-0.5">{fmt(kpis.pending)}</p>
            <p className="text-xs text-muted-foreground">{invoices.filter(i => i.status === 'pendiente').length} facturas</p>
          </div>
          <div className="bg-background/60 border border-emerald-500/20 rounded-xl p-3">
            <p className="text-xs text-emerald-400">Cobrado</p>
            <p className="text-lg font-bold text-foreground mt-0.5">{fmt(kpis.paid)}</p>
            <p className="text-xs text-muted-foreground">{invoices.filter(i => i.status === 'pagada').length} facturas</p>
          </div>
          <div className="bg-background/60 border border-red-500/20 rounded-xl p-3">
            <p className="text-xs text-red-400">Vencido sin cobrar</p>
            <p className="text-lg font-bold text-foreground mt-0.5">{fmt(kpis.overdue)}</p>
            <p className="text-xs text-muted-foreground">{invoices.filter(i => i.status === 'vencida').length} facturas</p>
          </div>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-muted/40 border border-border rounded-lg p-1">
          <TabsTrigger value="dashboard" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs sm:text-sm">
            <DollarSign className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="facturas" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs sm:text-sm">
            <Receipt className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Facturas</span>
          </TabsTrigger>
          <TabsTrigger value="reportes" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs sm:text-sm">
            <BarChart3 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reportes</span>
          </TabsTrigger>
          <TabsTrigger value="obras" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs sm:text-sm">
            <FileCheck className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Certificación</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6 animate-in fade-in-50 duration-300">
          <DashboardFinanciero />
        </TabsContent>

        <TabsContent value="facturas" className="mt-6 animate-in fade-in-50 duration-300">
          <TablaFacturas
            invoices={invoices}
            isLoading={isLoading}
            onEdit={handleEdit}
            onDelete={(id) => deleteMutation.mutate(id)}
            onNew={handleNew}
          />
        </TabsContent>

        <TabsContent value="reportes" className="mt-6 animate-in fade-in-50 duration-300">
          <ReportesFacturacion />
        </TabsContent>

        <TabsContent value="obras" className="mt-6 animate-in fade-in-50 duration-300">
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