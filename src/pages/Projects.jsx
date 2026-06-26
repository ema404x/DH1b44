import React, { useState, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Trash2, Upload, Plus, Loader2, X, ChevronUp, ChevronDown, ScanSearch } from 'lucide-react';
import { toast } from 'sonner';
import { usePermission } from '@/hooks/usePermission';
import { debounce } from '@/lib/performance';

import ImportarObrasExcelModal from '@/components/projects/ImportarObrasExcelModal';
import AuditoriaSincronizacion from '@/components/projects/AuditoriaSincronizacion';
import ProjectDetailPanel from '@/components/projects/ProjectDetailPanel';
import ProyectoFila from '@/components/projects/ProyectoFila';
import { DeleteSelectedModal, DeleteAllModal } from '@/components/projects/DeleteConfirmModal';
import EntityFormDialog from '@/components/shared/EntityFormDialog';

import {
  DETALLE_COLORS, PROJECT_FIELDS, TABLE_COLS, TABLE_HEADERS,
  getDetalle, getComuna,
} from '@/lib/projects-utils';

export default function Projects() {
  const { allowed: canEdit }   = usePermission('Project', 'update');
  const { allowed: canCreate } = usePermission('Project', 'create');
  const { allowed: canDelete } = usePermission('Project', 'delete');

  const [search, setSearch]                     = useState('');
  const [statusFilter, setStatusFilter]         = useState('all');
  const [comunaFilter, setComunaFilter]         = useState('all');
  const [dialogOpen, setDialogOpen]             = useState(false);
  const [editing, setEditing]                   = useState(null);
  const [selectedProject, setSelectedProject]   = useState(null);
  const [showObrasImporter, setShowObrasImporter] = useState(false);
  const [showAuditoria, setShowAuditoria]       = useState(false);
  const [selected, setSelected]                 = useState(new Set());
  const [deleting, setDeleting]                 = useState(false);
  const [deletingProgress, setDeletingProgress] = useState(0);
  const [confirmDelete, setConfirmDelete]       = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [sortKey, setSortKey]                   = useState('name');
  const [sortDir, setSortDir]                   = useState(1);
  const [limit, setLimit]                       = useState(100);

  const queryClient = useQueryClient();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', limit],
    queryFn: () => base44.entities.Project.list('-created_date', limit),
    staleTime: 1000 * 60 * 2,
  });

  const debouncedSearch = useMemo(() => debounce((v) => setSearch(v), 300), []);

  const saveMutation = useMutation({
    mutationFn: (data) => editing
      ? base44.entities.Project.update(editing.id, data)
      : base44.entities.Project.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setDialogOpen(false);
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Project.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });

  const stats = useMemo(() => {
    const counts = {};
    projects.forEach(p => { const d = getDetalle(p); counts[d] = (counts[d] || 0) + 1; });
    return counts;
  }, [projects]);

  const comunaStats = useMemo(() => {
    const c = { '8A': 0, '8B': 0, '10A': 0 };
    projects.forEach(p => { const cm = getComuna(p); if (c[cm] !== undefined) c[cm]++; });
    return c;
  }, [projects]);

  const filtered = useMemo(() => {
    let list = projects.filter(p => {
      if (search) {
        const q = search.toLowerCase();
        if (!p.name?.toLowerCase().includes(q) &&
            !p.client_name?.toLowerCase().includes(q) &&
            !p.address?.toLowerCase().includes(q) &&
            !p.code?.toLowerCase().includes(q) &&
            !p.notes?.toLowerCase().includes(q)) return false;
      }
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (comunaFilter !== 'all' && getComuna(p) !== comunaFilter) return false;
      return true;
    });

    list.sort((a, b) => {
      let av, bv;
      if (sortKey === 'monto')        { av = a.estimated_budget || 0; bv = b.estimated_budget || 0; }
      else if (sortKey === 'avance')  { av = a.progress || 0;         bv = b.progress || 0; }
      else if (sortKey === 'ai')      { av = a.start_date || '';       bv = b.start_date || ''; }
      else if (sortKey === 'detalle') { av = getDetalle(a);            bv = getDetalle(b); }
      else if (sortKey === 'comuna')  { av = getComuna(a);             bv = getComuna(b); }
      else                            { av = a[sortKey] || '';         bv = b[sortKey] || ''; }
      if (av < bv) return -sortDir;
      if (av > bv) return sortDir;
      return 0;
    });

    return list;
  }, [projects, search, statusFilter, comunaFilter, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => -d);
    else { setSortKey(key); setSortDir(1); }
  };

  const SortIcon = ({ k }) => sortKey === k
    ? (sortDir === 1 ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)
    : <ChevronUp className="h-3 w-3 opacity-0 group-hover:opacity-30" />;

  const toggleSelect = useCallback((id) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const toggleAll = () => {
    setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map(p => p.id)));
  };

  const deleteIds = async (ids, deleteAll = false) => {
    setDeleting(true);
    setDeletingProgress(10);
    try {
      const res = await base44.functions.invoke('eliminarTodasObras', deleteAll ? {} : { ids });
      const { deleted, errors } = res.data;
      setDeletingProgress(100);
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      setSelected(new Set());
      toast.success(`${deleted} obras eliminadas${errors > 0 ? ` (${errors} con error)` : ''}`);
    } catch (err) {
      toast.error('Error al eliminar: ' + (err.message || 'intente nuevamente'));
    } finally {
      setDeleting(false);
      setDeletingProgress(0);
      setConfirmDelete(false);
      setConfirmDeleteAll(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col gap-3 text-sm">

      {/* HEADER */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">Planilla de Obras</h1>
          <p className="text-slate-400 text-xs">
            {projects.length.toLocaleString()} obras · 8A: {comunaStats['8A']} · 8B: {comunaStats['8B']} · 10A: {comunaStats['10A']}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selected.size > 0 && canDelete ? (
            <>
              <span className="text-slate-400 text-xs">{selected.size} seleccionadas</span>
              <Button variant="outline" size="sm" className="text-xs h-7" onClick={toggleAll}>
                {selected.size === filtered.length ? 'Deseleccionar' : 'Sel. todo'}
              </Button>
              <Button size="sm" variant="destructive" className="text-xs h-7 gap-1" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-3 w-3" /> Eliminar ({selected.size})
              </Button>
              <Button variant="ghost" size="sm" className="text-xs h-7 text-slate-400" onClick={() => setSelected(new Set())}>
                <X className="h-3 w-3" />
              </Button>
            </>
          ) : (
            <>
              {canCreate && (
                <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => setShowObrasImporter(true)}>
                  <Upload className="h-3 w-3" /> Importar planilla
                </Button>
              )}
              {canCreate && (
                <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => setShowAuditoria(true)}>
                  <ScanSearch className="h-3 w-3" /> Auditar sincronización
                </Button>
              )}
              {canCreate && (
                <Button size="sm" className="text-xs h-7 gap-1 bg-primary hover:bg-primary/90"
                  onClick={() => { setEditing(null); setDialogOpen(true); }}>
                  <Plus className="h-3 w-3" /> Nueva obra
                </Button>
              )}
              {canDelete && projects.length > 0 && (
                <Button size="sm" variant="ghost"
                  className="text-xs h-7 gap-1 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  onClick={() => setConfirmDeleteAll(true)}>
                  <Trash2 className="h-3 w-3" /> Eliminar todo
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* RESUMEN ESTADOS */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(stats).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([d, n]) => {
          const c = DETALLE_COLORS[d] || DETALLE_COLORS['pendiente'];
          return (
            <button key={d}
              onClick={() => setStatusFilter(d === statusFilter ? 'all' : d)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${c.bg} ${c.text} border-current/20 hover:opacity-80`}>
              <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
              {d}: {n}
            </button>
          );
        })}
      </div>

      {/* FILTROS */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <Input
            onChange={e => debouncedSearch(e.target.value)}
            placeholder="Buscar por título, establecimiento, dirección, código..."
            className="pl-8 h-8 text-xs bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500"
          />
          {search && (
            <button onClick={() => { setSearch(''); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <Select value={comunaFilter} onValueChange={setComunaFilter}>
          <SelectTrigger className="w-28 h-8 text-xs bg-slate-800/50 border-slate-700/50 text-white">
            <SelectValue placeholder="Comuna" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {['8A', '8B', '10A'].map(c => <SelectItem key={c} value={c}>Comuna {c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-8 text-xs bg-slate-800/50 border-slate-700/50 text-white">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="en_progreso">En Progreso</SelectItem>
            <SelectItem value="completado">Completado</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-slate-500 self-center whitespace-nowrap">{filtered.length.toLocaleString()} resultados</span>
      </div>

      {/* TABLA */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 overflow-hidden overflow-x-auto bg-slate-900/40 flex-1">
          <div className="grid bg-slate-800/60 border-b border-slate-700"
            style={{ '--cols': TABLE_COLS, gridTemplateColumns: 'var(--cols)' }}>
            <div className="px-2 py-2 flex items-center justify-center">
              <Checkbox checked={selected.size > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} />
            </div>
            {TABLE_HEADERS.map(col => (
              <div key={col.k}
                className={`group px-2 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide select-none cursor-pointer hover:text-white transition-colors flex items-center gap-0.5 ${col.hidden ? 'hidden xl:flex' : ''}`}
                onClick={() => col.k !== '_' && toggleSort(col.k)}>
                {col.label} {col.k !== '_' && <SortIcon k={col.k} />}
              </div>
            ))}
          </div>

          <div style={{ '--cols': TABLE_COLS }}>
            {filtered.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-sm">
                No se encontraron obras con los filtros actuales
              </div>
            ) : (
              <>
                {filtered.map(project => (
                  <ProyectoFila
                    key={project.id}
                    project={project}
                    selected={selected.has(project.id)}
                    onToggle={toggleSelect}
                    onOpen={setSelectedProject}
                    onDelete={(id) => deleteMutation.mutate(id)}
                    canDelete={canDelete}
                  />
                ))}
                {limit < projects.length && (
                  <div className="py-4 text-center">
                    <Button variant="outline" size="sm" onClick={() => setLimit(l => l + 100)} className="text-xs">
                      Cargar {Math.min(100, projects.length - limit)} más ({limit}/{projects.length})
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* MODALS */}
      <EntityFormDialog
        open={dialogOpen} onOpenChange={setDialogOpen}
        title={editing ? 'Editar Obra' : 'Nueva Obra'}
        fields={PROJECT_FIELDS}
        initialData={editing || { status: 'pendiente', progress: 0 }}
        onSave={(data) => saveMutation.mutate(data)}
        saving={saveMutation.isPending}
      />

      {selectedProject && (
        <ProjectDetailPanel
          project={projects.find(p => p.id === selectedProject.id) || selectedProject}
          onClose={() => setSelectedProject(null)}
          onEdit={canEdit ? () => { setEditing(selectedProject); setDialogOpen(true); setSelectedProject(null); } : undefined}
        />
      )}

      {showObrasImporter && (
        <ImportarObrasExcelModal
          onClose={() => setShowObrasImporter(false)}
          onImported={() => setShowObrasImporter(false)}
        />
      )}

      {showAuditoria && (
        <AuditoriaSincronizacion onClose={() => setShowAuditoria(false)} />
      )}

      {confirmDelete && (
        <DeleteSelectedModal
          count={selected.size}
          deleting={deleting}
          progress={deletingProgress}
          onConfirm={() => deleteIds([...selected], false)}
          onCancel={() => setConfirmDelete(false)}
        />
      )}

      {confirmDeleteAll && (
        <DeleteAllModal
          total={projects.length}
          deleting={deleting}
          progress={deletingProgress}
          onConfirm={() => deleteIds([], true)}
          onCancel={() => setConfirmDeleteAll(false)}
        />
      )}
    </div>
  );
}