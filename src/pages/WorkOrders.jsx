import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, ClipboardList, Pencil, Trash2, Clock, User } from 'lucide-react';
import { format } from 'date-fns';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import EntityFormDialog from '@/components/shared/EntityFormDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const typeLabels = {
  mantenimiento_preventivo: 'Mant. Preventivo', mantenimiento_correctivo: 'Mant. Correctivo',
  instalacion: 'Instalación', inspeccion: 'Inspección', reparacion: 'Reparación', emergencia: 'Emergencia'
};

const orderFields = [
  { key: 'title', label: 'Título', required: true },
  { key: 'code', label: 'Código OT', placeholder: 'OT-001' },
  { key: 'project_name', label: 'Proyecto' },
  { key: 'type', label: 'Tipo', type: 'select', options: Object.entries(typeLabels).map(([value, label]) => ({ value, label })) },
  { key: 'status', label: 'Estado', type: 'select', options: [
    { value: 'pendiente', label: 'Pendiente' }, { value: 'asignada', label: 'Asignada' },
    { value: 'en_progreso', label: 'En Progreso' }, { value: 'en_espera', label: 'En Espera' },
    { value: 'completada', label: 'Completada' }, { value: 'cancelada', label: 'Cancelada' }
  ]},
  { key: 'priority', label: 'Prioridad', type: 'select', options: [
    { value: 'baja', label: 'Baja' }, { value: 'media', label: 'Media' }, { value: 'alta', label: 'Alta' }, { value: 'urgente', label: 'Urgente' }
  ]},
  { key: 'assigned_name', label: 'Asignado a' },
  { key: 'scheduled_date', label: 'Fecha Programada', type: 'date' },
  { key: 'estimated_hours', label: 'Horas Estimadas', type: 'number' },
  { key: 'actual_hours', label: 'Horas Reales', type: 'number' },
  { key: 'description', label: 'Descripción', type: 'textarea' },
  { key: 'notes', label: 'Notas', type: 'textarea' },
];

export default function WorkOrders() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({ queryKey: ['workorders'], queryFn: () => base44.entities.WorkOrder.list('-created_date') });

  const saveMutation = useMutation({
    mutationFn: (data) => editing ? base44.entities.WorkOrder.update(editing.id, data) : base44.entities.WorkOrder.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['workorders'] }); setDialogOpen(false); setEditing(null); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.WorkOrder.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workorders'] })
  });

  const filtered = orders.filter(o => {
    const matchSearch = !search || o.title?.toLowerCase().includes(search.toLowerCase()) || o.assigned_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Órdenes de Trabajo" subtitle="Gestión de OT y mantenimiento" actionLabel="Nueva OT" onAction={() => { setEditing(null); setDialogOpen(true); }} />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar órdenes..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="asignada">Asignada</SelectItem>
            <SelectItem value="en_progreso">En Progreso</SelectItem>
            <SelectItem value="completada">Completada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 && !isLoading ? (
        <EmptyState icon={ClipboardList} title="No hay órdenes de trabajo" description="Creá una orden de trabajo para empezar" actionLabel="Nueva OT" onAction={() => { setEditing(null); setDialogOpen(true); }} />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead className="hidden md:table-cell">Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead className="hidden lg:table-cell">Asignado</TableHead>
                  <TableHead className="hidden lg:table-cell">Fecha</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(order => (
                  <TableRow key={order.id} className="group">
                    <TableCell className="font-mono text-xs">{order.code || '-'}</TableCell>
                    <TableCell className="font-medium">{order.title}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs">{typeLabels[order.type] || order.type}</TableCell>
                    <TableCell><StatusBadge value={order.status} /></TableCell>
                    <TableCell><StatusBadge value={order.priority} type="priority" /></TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {order.assigned_name ? (
                        <span className="flex items-center gap-1 text-sm"><User className="h-3 w-3" />{order.assigned_name}</span>
                      ) : <span className="text-muted-foreground text-xs">Sin asignar</span>}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs">
                      {order.scheduled_date ? format(new Date(order.scheduled_date), 'dd/MM/yy') : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(order); setDialogOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>¿Eliminar OT?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(order.id)}>Eliminar</AlertDialogAction></AlertDialogFooter>
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
        title={editing ? 'Editar Orden de Trabajo' : 'Nueva Orden de Trabajo'}
        fields={orderFields}
        initialData={editing || { status: 'pendiente', priority: 'media', type: 'mantenimiento_correctivo' }}
        onSave={(data) => saveMutation.mutate(data)}
        saving={saveMutation.isPending}
      />
    </div>
  );
}