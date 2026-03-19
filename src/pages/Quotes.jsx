import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, FileText, Pencil, Trash2, Eye } from 'lucide-react';
import { format } from 'date-fns';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import EntityFormDialog from '@/components/shared/EntityFormDialog';
import QuoteDetailDialog from '@/components/quotes/QuoteDetailDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const quoteFields = [
  { key: 'title', label: 'Título', required: true },
  { key: 'code', label: 'Código', placeholder: 'PRES-001' },
  { key: 'client_name', label: 'Cliente', required: true },
  { key: 'status', label: 'Estado', type: 'select', options: [
    { value: 'borrador', label: 'Borrador' }, { value: 'enviado', label: 'Enviado' },
    { value: 'aprobado', label: 'Aprobado' }, { value: 'rechazado', label: 'Rechazado' }, { value: 'vencido', label: 'Vencido' }
  ]},
  { key: 'valid_until', label: 'Válido Hasta', type: 'date' },
  { key: 'description', label: 'Descripción', type: 'textarea' },
  { key: 'notes', label: 'Notas', type: 'textarea' },
];

export default function Quotes() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detailQuote, setDetailQuote] = useState(null);
  const queryClient = useQueryClient();

  const { data: quotes = [], isLoading } = useQuery({ queryKey: ['quotes'], queryFn: () => base44.entities.Quote.list('-created_date') });

  const saveMutation = useMutation({
    mutationFn: (data) => editing ? base44.entities.Quote.update(editing.id, data) : base44.entities.Quote.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['quotes'] }); setDialogOpen(false); setEditing(null); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Quote.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quotes'] })
  });

  const filtered = quotes.filter(q => {
    const matchSearch = !search || q.title?.toLowerCase().includes(search.toLowerCase()) || q.client_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || q.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Presupuestos" subtitle="Gestión de presupuestos y cotizaciones" actionLabel="Nuevo Presupuesto" onAction={() => { setEditing(null); setDialogOpen(true); }} />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar presupuestos..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="borrador">Borrador</SelectItem>
            <SelectItem value="enviado">Enviado</SelectItem>
            <SelectItem value="aprobado">Aprobado</SelectItem>
            <SelectItem value="rechazado">Rechazado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 && !isLoading ? (
        <EmptyState icon={FileText} title="No hay presupuestos" description="Creá tu primer presupuesto" actionLabel="Nuevo Presupuesto" onAction={() => { setEditing(null); setDialogOpen(true); }} />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead className="hidden md:table-cell">Cliente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="hidden lg:table-cell">Válido Hasta</TableHead>
                  <TableHead className="w-28"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(quote => (
                  <TableRow key={quote.id} className="group">
                    <TableCell className="font-mono text-xs">{quote.code || '-'}</TableCell>
                    <TableCell className="font-medium">{quote.title}</TableCell>
                    <TableCell className="hidden md:table-cell">{quote.client_name}</TableCell>
                    <TableCell><StatusBadge value={quote.status} /></TableCell>
                    <TableCell className="text-right font-medium">${(quote.total || 0).toLocaleString()}</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs">
                      {quote.valid_until ? format(new Date(quote.valid_until), 'dd/MM/yy') : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetailQuote(quote)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(quote); setDialogOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>¿Eliminar presupuesto?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(quote.id)}>Eliminar</AlertDialogAction></AlertDialogFooter>
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
        title={editing ? 'Editar Presupuesto' : 'Nuevo Presupuesto'}
        fields={quoteFields}
        initialData={editing || { status: 'borrador' }}
        onSave={(data) => saveMutation.mutate(data)}
        saving={saveMutation.isPending}
      />

      <QuoteDetailDialog quote={detailQuote} onClose={() => setDetailQuote(null)} />
    </div>
  );
}