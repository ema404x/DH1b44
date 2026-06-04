import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsContent, TabsTrigger } from '@/components/ui/tabs';
import { Search, Receipt, Pencil, Trash2, DollarSign, BarChart3, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { format } from 'date-fns';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import StatsCard from '@/components/shared/StatsCard';
import EntityFormDialog from '@/components/shared/EntityFormDialog';
import CertificacionesVinculadas from '@/components/finanzas/CertificacionesVinculadas';
import ReporteMensualComparativo from '@/components/reportes/ReporteMensualComparativo';
import DashboardFinanciero from '@/components/finanzas/DashboardFinanciero';
import GastoMensualAbonosMensuales from '@/components/reportes/GastoMensualAbonosMensuales';
import FiltrosAvanzadosFacturas from '@/components/invoices/FiltrosAvanzadosFacturas';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const invoiceFields = [
  { key: 'code', label: 'Número de Factura', placeholder: 'FAC-001' },
  { key: 'client_name', label: 'Cliente', required: true },
  { key: 'project_name', label: 'Proyecto' },
  { key: 'status', label: 'Estado', type: 'select', options: [
    { value: 'pendiente', label: 'Pendiente' }, { value: 'pagada', label: 'Pagada' },
    { value: 'vencida', label: 'Vencida' }, { value: 'cancelada', label: 'Cancelada' }
  ]},
  { key: 'subtotal', label: 'Subtotal ($)', type: 'number' },
  { key: 'tax_rate', label: 'IVA (%)', type: 'number' },
  { key: 'total', label: 'Total ($)', type: 'number' },
  { key: 'issue_date', label: 'Fecha de Emisión', type: 'date' },
  { key: 'due_date', label: 'Fecha de Vencimiento', type: 'date' },
  { key: 'payment_date', label: 'Fecha de Pago', type: 'date' },
  { key: 'notes', label: 'Notas', type: 'textarea' },
];

export default function Invoices() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [filtered, setFiltered] = useState([]);
  const queryClient = useQueryClient();

  const { data: invoices = [], isLoading } = useQuery({ queryKey: ['invoices'], queryFn: () => base44.entities.Invoice.list('-created_date') });

  const saveMutation = useMutation({
    mutationFn: (data) => editing ? base44.entities.Invoice.update(editing.id, data) : base44.entities.Invoice.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['invoices'] }); setDialogOpen(false); setEditing(null); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Invoice.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] })
  });

  // Inicializar filtered con todas las facturas
  React.useEffect(() => {
    setFiltered(invoices);
  }, [invoices]);

  const totalPending = invoices.filter(i => i.status === 'pendiente').reduce((s, i) => s + (i.total || 0), 0);
  const totalPaid = invoices.filter(i => i.status === 'pagada').reduce((s, i) => s + (i.total || 0), 0);
  const totalOverdue = invoices.filter(i => i.status === 'vencida').reduce((s, i) => s + (i.total || 0), 0);

  return (
    <div className="space-y-8 pb-8">
      <div className="bg-gradient-to-br from-primary/5 via-primary/2.5 to-transparent border border-primary/10 rounded-2xl p-8">
        <PageHeader title="Facturación" subtitle="Gestión integral de facturas, cobros y reportes financieros" actionLabel="Nueva Factura" onAction={() => { setEditing(null); setDialogOpen(true); }} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
         <TabsList className="grid w-full grid-cols-3 bg-muted/40 border border-border rounded-lg p-1">
           <TabsTrigger value="dashboard" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
             <DollarSign className="h-4 w-4" />
             <span className="hidden sm:inline">Dashboard</span>
           </TabsTrigger>
           <TabsTrigger value="facturas" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
             <Receipt className="h-4 w-4" />
             <span className="hidden sm:inline">Facturas</span>
           </TabsTrigger>
           <TabsTrigger value="reportes" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
             <BarChart3 className="h-4 w-4" />
             <span className="hidden sm:inline">Reportes</span>
           </TabsTrigger>
         </TabsList>

         <TabsContent value="dashboard" className="mt-8 animate-in fade-in-50 duration-300">
           <DashboardFinanciero />
         </TabsContent>

         <TabsContent value="facturas" className="space-y-6 mt-8 animate-in fade-in-50 duration-300">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="animate-in fade-in-50 duration-300" style={{animationDelay: '50ms'}}>
          <Card className="border-border/50 bg-gradient-to-br from-amber/5 to-transparent p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Pendiente de Cobro</p>
                <p className="text-2xl font-bold text-foreground mt-2">${totalPending.toLocaleString()}</p>
              </div>
              <Clock className="h-5 w-5 text-amber-500/60" />
            </div>
          </Card>
        </div>
        <div className="animate-in fade-in-50 duration-300" style={{animationDelay: '100ms'}}>
          <Card className="border-border/50 bg-gradient-to-br from-green-500/5 to-transparent p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Cobrado</p>
                <p className="text-2xl font-bold text-foreground mt-2">${totalPaid.toLocaleString()}</p>
              </div>
              <TrendingUp className="h-5 w-5 text-green-500/60" />
            </div>
          </Card>
        </div>
        <div className="animate-in fade-in-50 duration-300" style={{animationDelay: '150ms'}}>
          <Card className="border-border/50 bg-gradient-to-br from-red-500/5 to-transparent p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Vencido</p>
                <p className="text-2xl font-bold text-foreground mt-2">${totalOverdue.toLocaleString()}</p>
              </div>
              <TrendingDown className="h-5 w-5 text-red-500/60" />
            </div>
          </Card>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Búsqueda y Filtros</h3>
        </div>
        <FiltrosAvanzadosFacturas invoices={invoices} onFilter={setFiltered} />
      </div>

      {isLoading ? (
        <Card className="p-12 flex justify-center items-center border-border/50">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Cargando facturas...</p>
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Receipt} title="No hay facturas" description="Creá tu primera factura" actionLabel="Nueva Factura" onAction={() => { setEditing(null); setDialogOpen(true); }} />
      ) : (
        <div className="space-y-4 animate-in fade-in-50 duration-300">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Listado de Facturas ({filtered.length})</h3>
        </div>
        <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-border/50">
                  <TableHead className="font-semibold">Nº Factura</TableHead>
                  <TableHead className="font-semibold">Cliente</TableHead>
                  <TableHead className="hidden md:table-cell font-semibold">Proyecto</TableHead>
                  <TableHead className="font-semibold">Estado</TableHead>
                  <TableHead className="text-right font-semibold">Total</TableHead>
                  <TableHead className="hidden lg:table-cell font-semibold text-xs">Emisión</TableHead>
                  <TableHead className="hidden lg:table-cell font-semibold text-xs">Vencimiento</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((invoice, idx) => (
                  <TableRow key={invoice.id} className="border-border/50 hover:bg-accent/30 transition-colors group" style={{animationDelay: `${idx * 25}ms`}}>
                    <TableCell className="font-mono text-xs font-semibold text-primary/80 cursor-pointer hover:text-primary transition-colors" onClick={() => setSelectedInvoice(invoice)}>{invoice.code || '-'}</TableCell>
                    <TableCell className="font-medium text-foreground/90 cursor-pointer hover:text-primary transition-colors" onClick={() => setSelectedInvoice(invoice)}>{invoice.client_name}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-foreground/70 cursor-pointer hover:text-primary transition-colors" onClick={() => setSelectedInvoice(invoice)}>{invoice.project_name || '-'}</TableCell>
                    <TableCell><StatusBadge value={invoice.status} /></TableCell>
                    <TableCell className="text-right font-semibold text-foreground">${(invoice.total || 0).toLocaleString()}</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{invoice.issue_date ? format(new Date(invoice.issue_date), 'dd/MM/yy') : '-'}</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{invoice.due_date ? format(new Date(invoice.due_date), 'dd/MM/yy') : '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                        <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-primary/10 hover:text-primary" onClick={() => { setEditing(invoice); setDialogOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>¿Eliminar factura?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(invoice.id)}>Eliminar</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>

        {selectedInvoice && (
           <div className="animate-in fade-in-50 duration-300">
             <CertificacionesVinculadas 
               projectName={selectedInvoice.project_name} 
               clientName={selectedInvoice.client_name}
             />
           </div>
         )}
        </div>
      )}
        </TabsContent>

         <TabsContent value="reportes" className="mt-8 space-y-8 animate-in fade-in-50 duration-300">
           <div className="space-y-5 animate-in fade-in-50 duration-300" style={{animationDelay: '50ms'}}>
             <Card className="border-border/30 bg-gradient-to-r from-blue-500/5 to-transparent p-4">
               <div>
                 <h3 className="text-sm font-semibold text-foreground">Gasto Mensual - Abonos Mensuales</h3>
                 <p className="text-xs text-muted-foreground mt-1">Análisis de gastos en certificados de abonos mensuales</p>
               </div>
             </Card>
             <GastoMensualAbonosMensuales />
           </div>

           <div className="space-y-5 border-t border-border/30 pt-8 animate-in fade-in-50 duration-300" style={{animationDelay: '100ms'}}>
             <Card className="border-border/30 bg-gradient-to-r from-purple-500/5 to-transparent p-4">
               <div>
                 <h3 className="text-sm font-semibold text-foreground">Certificación por Mantenimiento</h3>
                 <p className="text-xs text-muted-foreground mt-1">Dinero que sale de la empresa - Pagos a proveedores</p>
               </div>
             </Card>
             <ReporteMensualComparativo />
           </div>

           <div className="space-y-5 border-t border-border/30 pt-8 animate-in fade-in-50 duration-300" style={{animationDelay: '150ms'}}>
             <Card className="border-border/30 bg-gradient-to-r from-teal-500/5 to-transparent p-4">
               <div>
                 <h3 className="text-sm font-semibold text-foreground">Obra/Proyecto</h3>
                 <p className="text-xs text-muted-foreground mt-1">Dinero que entra a la empresa - Certificaciones de obras</p>
               </div>
             </Card>
             <CertificacionesVinculadas />
           </div>
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