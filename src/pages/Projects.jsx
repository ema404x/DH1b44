import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Search, FolderKanban, MapPin, Calendar, Trash2, Pencil, Upload, Plus, TrendingUp, Zap } from 'lucide-react';
import { exportProyectosPDF } from '@/utils/exportPDF';
import { format } from 'date-fns';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import EntityFormDialog from '@/components/shared/EntityFormDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import ProjectDetailPanel from '@/components/projects/ProjectDetailPanel';
import ProjectImporter from '@/components/projects/ProjectImporter';
import ProjectAlerts from '@/components/projects/ProjectAlerts';
import ImportarObrasExcelModal from '@/components/projects/ImportarObrasExcelModal';

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
  const [selectedProject, setSelectedProject] = useState(null);
  const [showImporter, setShowImporter] = useState(false);
  const [showObrasImporter, setShowObrasImporter] = useState(false);
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list('-created_date') });

  const stats = useMemo(() => ({
    total: projects.length,
    activos: projects.filter(p => p.status === 'en_progreso').length,
    completados: projects.filter(p => p.status === 'completado').length,
    presupuesto: projects.reduce((s, p) => s + (p.estimated_budget || 0), 0),
  }), [projects]);

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

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 space-y-6">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/30 rounded-full blur-3xl opacity-20 animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-4xl font-bold text-white flex items-center gap-3">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shrink-0">
                <FolderKanban className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              Proyectos
            </h1>
            <p className="text-slate-400 mt-1 text-sm">Gestión integral de obras y proyectos</p>
          </div>
          <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }} className="gap-2 bg-gradient-to-r from-primary to-purple-600 hover:shadow-lg shadow-primary/50 transition-all shrink-0">
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nuevo </span>Proyecto
          </Button>
        </div>

        {/* Stats */}
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: stats.total, icon: FolderKanban, color: 'from-blue-500' },
            { label: 'En Progreso', value: stats.activos, icon: Zap, color: 'from-emerald-500' },
            { label: 'Completados', value: stats.completados, icon: TrendingUp, color: 'from-green-500' },
          ].map((stat, i) => (
            <motion.div key={i} variants={item}>
              <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur border border-slate-700/50 rounded-lg p-4 hover:border-slate-600/50 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">{stat.label}</p>
                  <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${stat.color} to-transparent flex items-center justify-center`}>
                    <stat.icon className="h-4 w-4 text-white" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      {/* Alertas de proyectos */}
      {projects.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <ProjectAlerts projects={projects} />
        </motion.div>
      )}

      {/* Filtros */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Buscar proyectos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-primary/50"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40 bg-slate-800/50 border-slate-700/50 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="en_progreso">En Progreso</SelectItem>
            <SelectItem value="pausado">Pausado</SelectItem>
            <SelectItem value="completado">Completado</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowImporter(true)}>
          <Upload className="h-3.5 w-3.5" /> Importar
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10" onClick={() => setShowObrasImporter(true)}>
          <Upload className="h-3.5 w-3.5" /> Planilla Obras
        </Button>
      </motion.div>

      {/* Grid */}
      {filtered.length === 0 && !isLoading ? (
        <EmptyState icon={FolderKanban} title="No hay proyectos" description="Creá tu primer proyecto" actionLabel="Nuevo Proyecto" onAction={() => { setEditing(null); setDialogOpen(true); }} />
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(project => (
            <motion.div key={project.id} variants={item}>
              <Card
                className="group cursor-pointer border-0 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur hover:shadow-xl hover:shadow-primary/20 transition-all hover:border-primary/30 border border-slate-700/50"
                onClick={() => setSelectedProject(project)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white truncate">{project.name}</p>
                      {project.code && <p className="text-xs text-slate-500 font-mono mt-1">{project.code}</p>}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white" onClick={(e) => { e.stopPropagation(); setEditing(project); setDialogOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" /></Button>
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

                  <div className="flex flex-wrap gap-2 mb-4">
                    <StatusBadge value={project.status} />
                    <StatusBadge value={project.priority} type="priority" />
                    {project.type && <Badge variant="secondary" className="text-xs">{typeLabels[project.type]}</Badge>}
                  </div>

                  {project.client_name && <p className="text-xs text-slate-400 mb-2">👤 {project.client_name}</p>}
                  {project.address && <p className="text-xs text-slate-400 mb-2 flex items-center gap-1"><MapPin className="h-3 w-3" /> {project.address}</p>}

                  {project.start_date && (
                    <p className="text-xs text-slate-500 mb-4 flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {format(new Date(project.start_date), 'dd/MM/yy')} {project.end_date && `→ ${format(new Date(project.end_date), 'dd/MM/yy')}`}
                    </p>
                  )}

                  <div className="flex items-center gap-2">
                    <Progress value={project.progress || 0} className="h-1.5 flex-1 bg-slate-700" />
                    <span className="text-xs font-bold text-primary">{project.progress || 0}%</span>
                  </div>

                  {project.estimated_budget > 0 && (
                    <p className="text-xs text-slate-400 mt-3">Presupuesto: <span className="font-semibold text-white">${project.estimated_budget?.toLocaleString()}</span></p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
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

      {selectedProject && (
        <ProjectDetailPanel
          project={projects.find(p => p.id === selectedProject.id) || selectedProject}
          onClose={() => setSelectedProject(null)}
          onEdit={() => { setEditing(selectedProject); setDialogOpen(true); setSelectedProject(null); }}
        />
      )}

      {showImporter && (
        <ProjectImporter
          onClose={() => setShowImporter(false)}
          onImported={() => setShowImporter(false)}
        />
      )}

      {showObrasImporter && (
        <ImportarObrasExcelModal
          onClose={() => setShowObrasImporter(false)}
          onImported={() => setShowObrasImporter(false)}
        />
      )}
    </div>
  );
}