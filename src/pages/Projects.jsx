import React, { useState, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, FolderKanban, Trash2, Pencil, Upload, Plus, CheckSquare, X, AlertTriangle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import EntityFormDialog from '@/components/shared/EntityFormDialog';
import ProjectDetailPanel from '@/components/projects/ProjectDetailPanel';
import ProjectAlerts from '@/components/projects/ProjectAlerts';
import ImportarObrasExcelModal from '@/components/projects/ImportarObrasExcelModal';
import { toast } from 'sonner';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'en_progreso', label: 'En Progreso' },
  { value: 'pausado', label: 'Pausado' },
  { value: 'completado', label: 'Completado' },
  { value: 'cancelado', label: 'Cancelado' },
];

const STATUS_COLORS = {
  pendiente: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  en_progreso: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  pausado: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  completado: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  cancelado: 'bg-red-500/20 text-red-300 border-red-500/30',
};

const STATUS_LABELS = {
  pendiente: 'Pendiente', en_progreso: 'En Progreso', pausado: 'Pausado',
  completado: 'Completado', cancelado: 'Cancelado',
};

const typeLabels = {
  obra_nueva: 'Obra Nueva', remodelacion: 'Remodelación', mantenimiento_preventivo: 'Mant. Preventivo',
  mantenimiento_correctivo: 'Mant. Correctivo', emergencia: 'Emergencia', inspeccion: 'Inspección',
};

const projectFields = [
  { key: 'name', label: 'Nombre del Proyecto', required: true },
  { key: 'code', label: 'Código SAP', placeholder: 'Nº Orden SAP' },
  { key: 'client_name', label: 'Establecimiento' },
  { key: 'type', label: 'Tipo', type: 'select', options: Object.entries(typeLabels).map(([value, label]) => ({ value, label })) },
  { key: 'status', label: 'Estado', type: 'select', options: STATUS_OPTIONS.filter(o => o.value !== 'all') },
  { key: 'priority', label: 'Prioridad', type: 'select', options: [
    { value: 'baja', label: 'Baja' }, { value: 'media', label: 'Media' }, { value: 'alta', label: 'Alta' }, { value: 'urgente', label: 'Urgente' }
  ]},
  { key: 'address', label: 'Dirección' },
  { key: 'start_date', label: 'Fecha Inicio (AI)', type: 'date' },
  { key: 'end_date', label: 'Fecha Fin (AR)', type: 'date' },
  { key: 'estimated_budget', label: 'Monto Base', type: 'number' },
  { key: 'progress', label: 'Avance (%)', type: 'number' },
  { key: 'notes', label: 'Notas / Info SAP', type: 'textarea' },
];

export default function Projects() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showObrasImporter, setShowObrasImporter] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-created_date', 5000),
  });

  const stats = useMemo(() => ({
    total: projects.length,
    activos: projects.filter(p => p.status === 'en_progreso').length,
    completados: projects.filter(p => p.status === 'completado').length,
    pendientes: projects.filter(p => p.status === 'pendiente').length,
    cancelados: projects.filter(p => p.status === 'cancelado').length,
  }), [projects]);

  const saveMutation = useMutation({
    mutationFn: (data) => editing ? base44.entities.Project.update(editing.id, data) : base44.entities.Project.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projects'] }); setDialogOpen(false); setEditing(null); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Project.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] })
  });

  const filtered = useMemo(() => projects.filter(p => {
    const matchSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.code?.toLowerCase().includes(search.toLowerCase()) ||
      p.address?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  }), [projects, search, statusFilter]);

  // Selección
  const toggleSelect = useCallback((id, e) => {
    e.stopPropagation();
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(p => p.id)));
    }
  };

  const handleBulkDelete = async () => {
    setDeleting(true);
    const ids = [...selected];
    let ok = 0, fail = 0;
    // Borrar en lotes de 10 en paralelo para no colapsar la API
    for (let i = 0; i < ids.length; i += 10) {
      const batch = ids.slice(i, i + 10);
      const results = await Promise.allSettled(batch.map(id => base44.entities.Project.delete(id)));
      ok += results.filter(r => r.status === 'fulfilled').length;
      fail += results.filter(r => r.status === 'rejected').length;
    }
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    setSelected(new Set());
    setSelectMode(false);
    setDeleting(false);
    setConfirmDeleteAll(false);
    toast.success(`${ok} proyectos eliminados${fail > 0 ? ` (${fail} con error)` : ''}`);
  };

  const exitSelectMode = () => { setSelectMode(false); setSelected(new Set()); };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FolderKanban className="h-6 w-6 text-primary" />
            Proyectos
          </h1>
          <p className="text-slate-400 text-xs mt-0.5">{stats.total.toLocaleString()} obras totales</p>
        </div>
        <div className="flex items-center gap-2">
          {!selectMode ? (
            <>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setShowObrasImporter(true)}>
                <Upload className="h-3.5 w-3.5" /> Importar planilla
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={() => setSelectMode(true)}>
                <CheckSquare className="h-3.5 w-3.5" /> Seleccionar
              </Button>
              <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }} className="gap-1.5 bg-primary hover:bg-primary/90">
                <Plus className="h-4 w-4" /> Nueva obra
              </Button>
            </>
          ) : (
            <>
              <span className="text-sm text-slate-400">{selected.size} seleccionados</span>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={toggleAll}>
                {selected.size === filtered.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
              </Button>
              {selected.size > 0 && (
                <Button size="sm" variant="destructive" className="gap-1.5 text-xs" onClick={() => setConfirmDeleteAll(true)}>
                  <Trash2 className="h-3.5 w-3.5" /> Eliminar ({selected.size})
                </Button>
              )}
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-400" onClick={exitSelectMode}>
                <X className="h-3.5 w-3.5" /> Cancelar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats pills */}
      <div className="flex flex-wrap gap-2 text-xs">
        {[
          { label: 'En progreso', val: stats.activos, color: 'bg-blue-500/20 text-blue-300' },
          { label: 'Completados', val: stats.completados, color: 'bg-emerald-500/20 text-emerald-300' },
          { label: 'Pendientes', val: stats.pendientes, color: 'bg-yellow-500/20 text-yellow-300' },
          { label: 'Cancelados', val: stats.cancelados, color: 'bg-red-500/20 text-red-300' },
        ].map(s => (
          <button key={s.label}
            onClick={() => setStatusFilter(STATUS_OPTIONS.find(o => o.label === s.label || o.label.toLowerCase().includes(s.label.toLowerCase()))?.value || 'all')}
            className={`px-3 py-1 rounded-full font-medium ${s.color} border border-current/20 hover:opacity-80 transition-opacity`}>
            {s.label}: {s.val.toLocaleString()}
          </button>
        ))}
      </div>

      {/* Alertas */}
      {projects.length > 0 && <ProjectAlerts projects={projects} />}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Buscar por nombre, establecimiento, código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 h-9"
          />
          {search && (
            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white" onClick={() => setSearch('')}>
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44 bg-slate-800/50 border-slate-700/50 text-white h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-slate-500 self-center whitespace-nowrap">{filtered.length.toLocaleString()} resultados</span>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={FolderKanban} title="No hay proyectos" description="Importá una planilla o creá una obra nueva" actionLabel="Nueva obra" onAction={() => { setEditing(null); setDialogOpen(true); }} />
      ) : (
        <div className="divide-y divide-slate-800/60 rounded-xl border border-slate-800 overflow-hidden bg-slate-900/40">
          {filtered.map(project => (
            <div
              key={project.id}
              className={`group flex items-center gap-3 px-4 py-3 hover:bg-slate-800/40 transition-colors cursor-pointer ${selected.has(project.id) ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
              onClick={() => selectMode ? toggleSelect(project.id, { stopPropagation: () => {} }) : setSelectedProject(project)}
            >
              {selectMode && (
                <Checkbox
                  checked={selected.has(project.id)}
                  onCheckedChange={() => toggleSelect(project.id, { stopPropagation: () => {} })}
                  className="shrink-0"
                />
              )}

              {/* Estado */}
              <span className={`hidden sm:inline-flex shrink-0 px-2 py-0.5 rounded text-xs font-medium border ${STATUS_COLORS[project.status] || 'bg-slate-700 text-slate-300'}`}>
                {STATUS_LABELS[project.status] || project.status}
              </span>

              {/* Avance */}
              <div className="hidden md:flex items-center gap-1.5 w-20 shrink-0">
                <Progress value={project.progress || 0} className="h-1.5 flex-1 bg-slate-700" />
                <span className="text-xs text-slate-400 w-7 text-right">{project.progress || 0}%</span>
              </div>

              {/* Código */}
              {project.code && (
                <span className="hidden lg:block text-xs font-mono text-slate-500 shrink-0 w-24 truncate">{project.code}</span>
              )}

              {/* Nombre + info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{project.name}</p>
                <p className="text-xs text-slate-500 truncate">
                  {[project.client_name, project.address].filter(Boolean).join(' · ')}
                </p>
              </div>

              {/* Fecha */}
              {project.start_date && (
                <span className="hidden xl:block text-xs text-slate-500 shrink-0 w-20 text-right">
                  {format(new Date(project.start_date), 'dd/MM/yy')}
                </span>
              )}

              {/* Monto */}
              {project.estimated_budget > 0 && (
                <span className="hidden lg:block text-xs text-slate-400 shrink-0 w-28 text-right font-mono">
                  ${(project.estimated_budget / 1000000).toFixed(2)}M
                </span>
              )}

              {/* Acciones */}
              {!selectMode && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white"
                    onClick={() => { setEditing(project); setDialogOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-500/10"
                    onClick={() => deleteMutation.mutate(project.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Dialogs */}
      <EntityFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? 'Editar Obra' : 'Nueva Obra'}
        fields={projectFields}
        initialData={editing || { status: 'pendiente', priority: 'media', type: 'obra_nueva', progress: 0 }}
        onSave={(data) => saveMutation.mutate(data)}
        saving={saveMutation.isPending}
      />

      {selectedProject && (
        <ProjectDetailPanel
          project={projects.find(p => p.id === selectedProject.id) || selectedProject}
          onClose={() => setSelectedProject(null)}
          onEdit={() => { setEditing(selectedProject); setDialogOpen(true); setSelectedProject(null); }}
        />
      )}

      {showObrasImporter && (
        <ImportarObrasExcelModal
          onClose={() => setShowObrasImporter(false)}
          onImported={() => setShowObrasImporter(false)}
        />
      )}

      {/* Modal confirmación borrado masivo */}
      {confirmDeleteAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={() => setConfirmDeleteAll(false)} />
          <div className="relative bg-slate-900 border border-red-500/30 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-white">Eliminar {selected.size} obras</h3>
                <p className="text-xs text-slate-400">Esta acción no se puede deshacer</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <Button variant="outline" size="sm" onClick={() => setConfirmDeleteAll(false)} disabled={deleting}>Cancelar</Button>
              <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={deleting} className="gap-1.5">
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                {deleting ? 'Eliminando...' : `Eliminar ${selected.size}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}