import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Truck, Pencil, Trash2, Phone, Mail, Star, Plus } from 'lucide-react';
import EmptyState from '@/components/shared/EmptyState';
import EntityFormDialog from '@/components/shared/EntityFormDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { usePermission } from '@/hooks/usePermission';

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
  const { allowed: canEdit } = usePermission('Client', 'update');
  const { allowed: canCreate } = usePermission('Client', 'create');
  const { allowed: canDelete } = usePermission('Client', 'delete');
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

  const stats = {
    total: providers.length,
    activos: providers.filter(p => p.status === 'activo').length,
    rubros: [...new Set(providers.map(p => p.rubro).filter(Boolean))].length,
  };

  return (
    <div className="min-h-screen space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Truck className="h-5 w-5 text-white" />
            </div>
            Proveedores
          </h1>
          <p className="text-slate-400 mt-1">Directorio de proveedores y subcontratistas</p>
        </div>
        {canCreate && (
          <Button
            onClick={() => { setEditing(null); setDialogOpen(true); }}
            className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:shadow-lg shadow-cyan-500/30 transition-all"
          >
            <Plus className="h-4 w-4" /> Nuevo Proveedor
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'from-blue-500' },
          { label: 'Activos', value: stats.activos, color: 'from-emerald-500' },
          { label: 'Rubros', value: stats.rubros, color: 'from-purple-500' },
        ].map((s, i) => (
          <div key={i} className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-lg p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide">{s.label}</p>
            <p className="text-2xl font-bold text-white mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input placeholder="Buscar proveedores..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500" />
        </div>
        <select
          value={filterRubro}
          onChange={e => setFilterRubro(e.target.value)}
          className="text-sm border border-slate-700/50 rounded-md px-3 py-2 bg-slate-800/50 text-white"
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
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700/50">
                  <TableHead className="text-slate-300">Proveedor</TableHead>
                  <TableHead className="hidden md:table-cell text-slate-300">Rubro</TableHead>
                  <TableHead className="hidden md:table-cell text-slate-300">Contacto</TableHead>
                  <TableHead className="hidden lg:table-cell text-slate-300">Teléfono</TableHead>
                  <TableHead className="text-slate-300">Estado</TableHead>
                  <TableHead className="hidden lg:table-cell text-slate-300">Valoración</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(p => (
                  <TableRow key={p.id} className="group border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                    <TableCell>
                      <div>
                        <p className="font-medium text-white">{p.name}</p>
                        {p.cuit && <p className="text-xs text-slate-500">CUIT: {p.cuit}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {p.rubro ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          {RUBRO_LABELS[p.rubro] || p.rubro}
                        </span>
                      ) : <span className="text-xs text-slate-500">—</span>}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="text-sm">
                        {p.contact_name && <p className="text-slate-300">{p.contact_name}</p>}
                        {p.email && <p className="text-xs text-slate-500 flex items-center gap-1"><Mail className="h-2.5 w-2.5" />{p.email}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {p.phone && <span className="flex items-center gap-1 text-sm text-slate-300"><Phone className="h-3 w-3" />{p.phone}</span>}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${
                        p.status === 'activo' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                        p.status === 'suspendido' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                        'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                      }`}>
                        {p.status || 'activo'}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <StarRating value={p.valoracion} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {canEdit && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white" onClick={() => { setEditing(p); setDialogOpen(true); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canDelete && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" /></Button>
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
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
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