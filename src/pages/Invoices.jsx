import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsContent, TabsTrigger } from '@/components/ui/tabs';
import { Search, Receipt, Pencil, Trash2, DollarSign, BarChart3 } from 'lucide-react';
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
      <PageHeader title="Facturación" subtitle="Gestión integral de facturas, cobros y reportes financieros" actionLabel="Nueva Factura" onAction={() => { setEditing(null); setDialogOpen(true); }} />

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
          <StatsCard title="Pendiente de Cobro" value={`$${totalPending.toLocaleString()}`} icon={DollarSign} color="amber" />
        </div>
        <div className="animate-in fade-in-50 duration-300" style={{animationDelay: '100ms'}}>
          <StatsCard title="Cobrado" value={`$${totalPaid.toLocaleString()}`} icon={DollarSign} color="green" />
        </div>
        <div className="animate-in fade-in-50 duration-300" style={{animationDelay: '150ms'}}>
          <StatsCard title="Vencido" value={`$${totalOverdue.toLocaleString()}`} icon={DollarSign} color="red" />
        </div>
      </div>

      <FiltrosAvanzadosFacturas invoices={invoices} onFilter={setFiltered} />

      {isLoading ? (
        <Card className="p-8 flex justify-center items-center">
          <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Receipt} title="No hay facturas" description="Creá tu primera factura" actionLabel="Nueva Factura" onAction={() => { setEditing(null); setDialogOpen(true); }} />
      ) : (
        <div className="space-y-4 animate-in fade-in-50 duration-300">
        <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
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
           <div className="space-y-4 animate-in fade-in-50 duration-300" style={{animationDelay: '50ms'}}>
             <div className="flex items-start justify-between">
               <div>
                 <h3 className="text-lg font-semibold">Gasto Mensual - Abonos Mensuales</h3>
                 <p className="text-sm text-muted-foreground mt-1">Análisis de gastos en certificados de abonos mensuales</p>
               </div>
             </div>
             <GastoMensualAbonosMensuales />
           </div>

           <div className="space-y-4 border-t border-border/50 pt-8 animate-in fade-in-50 duration-300" style={{animationDelay: '100ms'}}>
             <div className="flex items-start justify-between">
               <div>
                 <h3 className="text-lg font-semibold">Certificación por Mantenimiento</h3>
                 <p className="text-sm text-muted-foreground mt-1">Dinero que sale de la empresa - Pagos a proveedores</p>
               </div>
             </div>
             <ReporteMensualComparativo />
           </div>

           <div className="space-y-4 border-t border-border/50 pt-8 animate-in fade-in-50 duration-300" style={{animationDelay: '150ms'}}>
             <div className="flex items-start justify-between">
               <div>
                 <h3 className="text-lg font-semibold">Obra/Proyecto</h3>
                 <p className="text-sm text-muted-foreground mt-1">Dinero que entra a la empresa - Certificaciones de obras</p>
               </div>
             </div>
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