import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Users, Pencil, Trash2, Phone, Mail, MapPin } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import EntityFormDialog from '@/components/shared/EntityFormDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const clientFields = [
  { key: 'name', label: 'Nombre / Razón Social', required: true },
  { key: 'type', label: 'Tipo', type: 'select', options: [
    { value: 'empresa', label: 'Empresa' }, { value: 'particular', label: 'Particular' },
    { value: 'gobierno', label: 'Gobierno' }, { value: 'consorcio', label: 'Consorcio' }
  ]},
  { key: 'cuit', label: 'CUIT' },
  { key: 'contact_name', label: 'Persona de Contacto' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'phone', label: 'Teléfono' },
  { key: 'address', label: 'Dirección' },
  { key: 'city', label: 'Ciudad' },
  { key: 'status', label: 'Estado', type: 'select', options: [
    { value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }
  ]},
  { key: 'notes', label: 'Notas', type: 'textarea' },
];

export default function Clients() {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const queryClient = useQueryClient();

  const { data: clients = [], isLoading } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list('-created_date') });

  const saveMutation = useMutation({
    mutationFn: (data) => editing ? base44.entities.Client.update(editing.id, data) : base44.entities.Client.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['clients'] }); setDialogOpen(false); setEditing(null); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Client.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] })
  });

  const filtered = clients.filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.contact_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Clientes" subtitle="Base de datos de clientes" actionLabel="Nuevo Cliente" onAction={() => { setEditing(null); setDialogOpen(true); }} />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar clientes..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {filtered.length === 0 && !isLoading ? (
        <EmptyState icon={Users} title="No hay clientes" description="Agregá tu primer cliente" actionLabel="Nuevo Cliente" onAction={() => { setEditing(null); setDialogOpen(true); }} />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="hidden md:table-cell">Tipo</TableHead>
                  <TableHead className="hidden md:table-cell">Contacto</TableHead>
                  <TableHead className="hidden lg:table-cell">Teléfono</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(client => (
                  <TableRow key={client.id} className="group">
                    <TableCell>
                      <div>
                        <p className="font-medium">{client.name}</p>
                        {client.city && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-2.5 w-2.5" />{client.city}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm capitalize">{client.type}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="text-sm">
                        {client.contact_name && <p>{client.contact_name}</p>}
                        {client.email && <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-2.5 w-2.5" />{client.email}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {client.phone && <span className="flex items-center gap-1 text-sm"><Phone className="h-3 w-3" />{client.phone}</span>}
                    </TableCell>
                    <TableCell><StatusBadge value={client.status || 'activo'} /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(client); setDialogOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(client.id)}>Eliminar</AlertDialogAction></AlertDialogFooter>
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
        title={editing ? 'Editar Cliente' : 'Nuevo Cliente'}
        fields={clientFields}
        initialData={editing || { type: 'empresa', status: 'activo' }}
        onSave={(data) => saveMutation.mutate(data)}
        saving={saveMutation.isPending}
      />
    </div>
  );
}