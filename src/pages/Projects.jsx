import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Search, FolderKanban, MapPin, Calendar, Trash2, Pencil, FileText } from 'lucide-react';
import { exportProyectosPDF } from '@/utils/exportPDF';
import { format } from 'date-fns';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import EntityFormDialog from '@/components/shared/EntityFormDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const typeLabels = {
  obra_nueva: 'Obra Nueva', remodelacion: 'Remodelación', mantenimiento_preventivo: 'Mant. Preventivo',
  mantenimiento_correctivo: 'Mant. Correctivo', emergencia: 'Emergencia', inspeccion: 'Inspección',
};

const projectFields = [
  { key: 'name', label: 'Nombre del Proyecto', required: true },
  { key: 'code', label: 'Código', placeholder: 'PRO-001' },
  { key: 'client_name', label: 'Cliente' },
  { key: 'type', label: 'Tipo', type: 'select', options: Object.entries(typeLabels).map(([value, label]) => ({ value, label })) },
  { key: 'status', label: 'Estado', type: 'select', options: [
    { value: 'pendiente', label: 'Pendiente' }, { value: 'en_progreso', label: 'En Progreso' },
    { value: 'pausado', label: 'Pausado' }, { value: 'completado', label: 'Completado' }, { value: 'cancelado', label: 'Cancelado' }
  ]},
  { key: 'priority', label: 'Prioridad', type: 'select', options: [
    { value: 'baja', label: 'Baja' }, { value: 'media', label: 'Media' }, { value: 'alta', label: 'Alta' }, { value: 'urgente', label: 'Urgente' }
  ]},
  { key: 'address', label: 'Dirección' },
  { key: 'start_date', label: 'Fecha Inicio', type: 'date' },
  { key: 'end_date', label: 'Fecha Fin', type: 'date' },
  { key: 'estimated_budget', label: 'Presupuesto Estimado', type: 'number' },
  { key: 'progress', label: 'Avance (%)', type: 'number' },
  { key: 'description', label: 'Descripción', type: 'textarea' },
];

export default function Projects() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list('-created_date') });

  const saveMutation = useMutation({
    mutationFn: (data) => editing ? base44.entities.Project.update(editing.id, data) : base44.entities.Project.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projects'] }); setDialogOpen(false); setEditing(null); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Project.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] })
  });

  const filtered = projects.filter(p => {
    const matchSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.client_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-0">
        <PageHeader title="Proyectos" subtitle="Gestión de obras y proyectos" actionLabel="Nuevo Proyecto" onAction={() => { setEditing(null); setDialogOpen(true); }} />
        <Button variant="outline" size="sm" className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50 -mt-8 mr-1 hidden sm:flex" onClick={() => exportProyectosPDF(filtered)}>
          <FileText className="h-3.5 w-3.5" /> PDF
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar proyectos..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="en_progreso">En Progreso</SelectItem>
            <SelectItem value="pausado">Pausado</SelectItem>
            <SelectItem value="completado">Completado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 && !isLoading ? (
        <EmptyState icon={FolderKanban} title="No hay proyectos" description="Creá tu primer proyecto para empezar a gestionar tus obras" actionLabel="Nuevo Proyecto" onAction={() => { setEditing(null); setDialogOpen(true); }} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(project => (
            <Card key={project.id} className="hover:shadow-md transition-shadow group">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{project.name}</p>
                    <p className="text-xs text-muted-foreground">{project.code}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(project); setDialogOpen(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar proyecto?</AlertDialogTitle>
                          <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(project.id)}>Eliminar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  <StatusBadge value={project.status} />
                  <StatusBadge value={project.priority} type="priority" />
                  {project.type && <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{typeLabels[project.type] || project.type}</span>}
                </div>
                {project.client_name && <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><span>👤</span> {project.client_name}</p>}
                {project.address && <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><MapPin className="h-3 w-3" /> {project.address}</p>}
                {project.start_date && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mb-3">
                    <Calendar className="h-3 w-3" /> {format(new Date(project.start_date), 'dd/MM/yy')} {project.end_date && `→ ${format(new Date(project.end_date), 'dd/MM/yy')}`}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <Progress value={project.progress || 0} className="h-1.5 flex-1" />
                  <span className="text-xs font-medium text-muted-foreground">{project.progress || 0}%</span>
                </div>
                {project.estimated_budget > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">Presupuesto: <span className="font-medium text-foreground">${project.estimated_budget?.toLocaleString()}</span></p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <EntityFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? 'Editar Proyecto' : 'Nuevo Proyecto'}
        fields={projectFields}
        initialData={editing || { status: 'pendiente', priority: 'media', type: 'obra_nueva', progress: 0 }}
        onSave={(data) => saveMutation.mutate(data)}
        saving={saveMutation.isPending}
      />
    </div>
  );
}