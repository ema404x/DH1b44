import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Truck, Pencil, Trash2, Phone, Mail, Star } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import EntityFormDialog from '@/components/shared/EntityFormDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const RUBRO_LABELS = {
  construccion: 'Construcción', electricidad: 'Electricidad', plomeria: 'Plomería',
  pintura: 'Pintura', carpinteria: 'Carpintería', herreria: 'Herrería',
  climatizacion: 'Climatización', albanileria: 'Albañilería', impermeabilizacion: 'Impermeabilización',
  materiales: 'Materiales', equipos: 'Equipos', limpieza: 'Limpieza',
  seguridad: 'Seguridad', transporte: 'Transporte', tecnologia: 'Tecnología', otro: 'Otro',
};

const STATUS_STYLES = {
  activo: 'bg-emerald-100 text-emerald-700',
  inactivo: 'bg-slate-100 text-slate-500',
  suspendido: 'bg-red-100 text-red-600',
};

const providerFields = [
  { key: 'name', label: 'Nombre / Razón Social', required: true },
  { key: 'rubro', label: 'Rubro', type: 'select', options: Object.entries(RUBRO_LABELS).map(([value, label]) => ({ value, label })) },
  { key: 'cuit', label: 'CUIT' },
  { key: 'contact_name', label: 'Persona de Contacto' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'phone', label: 'Teléfono' },
  { key: 'address', label: 'Dirección' },
  { key: 'city', label: 'Ciudad' },
  { key: 'status', label: 'Estado', type: 'select', options: [
    { value: 'activo', label: 'Activo' },
    { value: 'inactivo', label: 'Inactivo' },
    { value: 'suspendido', label: 'Suspendido' },
  ]},
  { key: 'valoracion', label: 'Valoración (1-5)', type: 'number' },
  { key: 'notas_valoracion', label: 'Comentarios de valoración', type: 'textarea' },
  { key: 'notes', label: 'Notas', type: 'textarea' },
];

function StarRating({ value }) {
  if (!value) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`h-3.5 w-3.5 ${i <= value ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`} />
      ))}
    </div>
  );
}

export default function Clients() {
  const [search, setSearch] = useState('');
  const [filterRubro, setFilterRubro] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const queryClient = useQueryClient();

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list('-created_date')
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editing ? base44.entities.Client.update(editing.id, data) : base44.entities.Client.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['clients'] }); setDialogOpen(false); setEditing(null); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Client.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] })
  });

  const filtered = providers.filter(p => {
    const matchSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.contact_name?.toLowerCase().includes(search.toLowerCase());
    const matchRubro = !filterRubro || p.rubro === filterRubro;
    return matchSearch && matchRubro;
  });

  const rubrosEnUso = [...new Set(providers.map(p => p.rubro).filter(Boolean))];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proveedores"
        subtitle="Directorio de proveedores y subcontratistas"
        actionLabel="Nuevo Proveedor"
        onAction={() => { setEditing(null); setDialogOpen(true); }}
      />

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar proveedores..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select
          value={filterRubro}
          onChange={e => setFilterRubro(e.target.value)}
          className="text-sm border border-border rounded-md px-3 py-2 bg-background"
        >
          <option value="">Todos los rubros</option>
          {rubrosEnUso.map(r => (
            <option key={r} value={r}>{RUBRO_LABELS[r] || r}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 && !isLoading ? (
        <EmptyState
          icon={Truck}
          title="No hay proveedores"
          description="Agregá tu primer proveedor o subcontratista"
          actionLabel="Nuevo Proveedor"
          onAction={() => { setEditing(null); setDialogOpen(true); }}
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proveedor</TableHead>
                  <TableHead className="hidden md:table-cell">Rubro</TableHead>
                  <TableHead className="hidden md:table-cell">Contacto</TableHead>
                  <TableHead className="hidden lg:table-cell">Teléfono</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="hidden lg:table-cell">Valoración</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(p => (
                  <TableRow key={p.id} className="group">
                    <TableCell>
                      <div>
                        <p className="font-medium">{p.name}</p>
                        {p.cuit && <p className="text-xs text-muted-foreground">CUIT: {p.cuit}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {p.rubro ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          {RUBRO_LABELS[p.rubro] || p.rubro}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="text-sm">
                        {p.contact_name && <p>{p.contact_name}</p>}
                        {p.email && <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-2.5 w-2.5" />{p.email}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {p.phone && <span className="flex items-center gap-1 text-sm"><Phone className="h-3 w-3" />{p.phone}</span>}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_STYLES[p.status] || STATUS_STYLES.activo}`}>
                        {p.status || 'activo'}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <StarRating value={p.valoracion} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(p); setDialogOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar proveedor?</AlertDialogTitle>
                              <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMutation.mutate(p.id)}>Eliminar</AlertDialogAction>
                            </AlertDialogFooter>
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
        title={editing ? 'Editar Proveedor' : 'Nuevo Proveedor'}
        fields={providerFields}
        initialData={editing || { status: 'activo' }}
        onSave={(data) => saveMutation.mutate(data)}
        saving={saveMutation.isPending}
      />
    </div>
  );
}