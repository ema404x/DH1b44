import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Receipt, Pencil, Trash2, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import StatsCard from '@/components/shared/StatsCard';
import EntityFormDialog from '@/components/shared/EntityFormDialog';
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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
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

  const filtered = invoices.filter(i => {
    const matchSearch = !search || i.client_name?.toLowerCase().includes(search.toLowerCase()) || i.code?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || i.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalPending = invoices.filter(i => i.status === 'pendiente').reduce((s, i) => s + (i.total || 0), 0);
  const totalPaid = invoices.filter(i => i.status === 'pagada').reduce((s, i) => s + (i.total || 0), 0);
  const totalOverdue = invoices.filter(i => i.status === 'vencida').reduce((s, i) => s + (i.total || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Facturación" subtitle="Control de facturas y pagos" actionLabel="Nueva Factura" onAction={() => { setEditing(null); setDialogOpen(true); }} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard title="Pendiente de Cobro" value={`$${totalPending.toLocaleString()}`} icon={DollarSign} color="amber" />
        <StatsCard title="Cobrado" value={`$${totalPaid.toLocaleString()}`} icon={DollarSign} color="green" />
        <StatsCard title="Vencido" value={`$${totalOverdue.toLocaleString()}`} icon={DollarSign} color="red" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar facturas..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="pagada">Pagada</SelectItem>
            <SelectItem value="vencida">Vencida</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 && !isLoading ? (
        <EmptyState icon={Receipt} title="No hay facturas" description="Creá tu primera factura" actionLabel="Nueva Factura" onAction={() => { setEditing(null); setDialogOpen(true); }} />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº Factura</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="hidden md:table-cell">Proyecto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="hidden lg:table-cell">Emisión</TableHead>
                  <TableHead className="hidden lg:table-cell">Vencimiento</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(invoice => (
                  <TableRow key={invoice.id} className="group">
                    <TableCell className="font-mono text-xs">{invoice.code || '-'}</TableCell>
                    <TableCell className="font-medium">{invoice.client_name}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{invoice.project_name || '-'}</TableCell>
                    <TableCell><StatusBadge value={invoice.status} /></TableCell>
                    <TableCell className="text-right font-semibold">${(invoice.total || 0).toLocaleString()}</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs">{invoice.issue_date ? format(new Date(invoice.issue_date), 'dd/MM/yy') : '-'}</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs">{invoice.due_date ? format(new Date(invoice.due_date), 'dd/MM/yy') : '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(invoice); setDialogOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
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
      )}

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