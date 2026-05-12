import React, { useState, useMemo, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Trash2, Upload, Plus, AlertTriangle, Loader2, X, Filter, ChevronUp, ChevronDown, Download } from 'lucide-react';
import { format } from 'date-fns';
import ImportarObrasExcelModal from '@/components/projects/ImportarObrasExcelModal';
import ProjectDetailPanel from '@/components/projects/ProjectDetailPanel';
import EntityFormDialog from '@/components/shared/EntityFormDialog';
import { toast } from 'sonner';

// ─── Constantes ─────────────────────────────────────────────────────────────

const DETALLE_COLORS = {
  'Certificado':     { bg: 'bg-emerald-500/15', text: 'text-emerald-300', dot: 'bg-emerald-400' },
  'En ejecución':    { bg: 'bg-blue-500/15',    text: 'text-blue-300',    dot: 'bg-blue-400' },
  'A ejecutar':      { bg: 'bg-cyan-500/15',     text: 'text-cyan-300',    dot: 'bg-cyan-400' },
  'Presupuestado':   { bg: 'bg-yellow-500/15',   text: 'text-yellow-300',  dot: 'bg-yellow-400' },
  'Rechazado':       { bg: 'bg-red-500/15',      text: 'text-red-300',     dot: 'bg-red-400' },
  'Sin presupuesto': { bg: 'bg-slate-500/15',    text: 'text-slate-300',   dot: 'bg-slate-400' },
  'Sin solicitud':   { bg: 'bg-slate-600/15',    text: 'text-slate-400',   dot: 'bg-slate-500' },
  'Cancelado':       { bg: 'bg-red-900/20',      text: 'text-red-400',     dot: 'bg-red-500' },
  'pendiente':       { bg: 'bg-yellow-500/15',   text: 'text-yellow-300',  dot: 'bg-yellow-400' },
  'en_progreso':     { bg: 'bg-blue-500/15',     text: 'text-blue-300',    dot: 'bg-blue-400' },
  'completado':      { bg: 'bg-emerald-500/15',  text: 'text-emerald-300', dot: 'bg-emerald-400' },
  'cancelado':       { bg: 'bg-red-900/20',      text: 'text-red-400',     dot: 'bg-red-500' },
  'pausado':         { bg: 'bg-slate-500/15',    text: 'text-slate-300',   dot: 'bg-slate-400' },
};

const STATUS_LABELS = {
  pendiente: 'Pendiente', en_progreso: 'En Progreso', completado: 'Completado',
  cancelado: 'Cancelado', pausado: 'Pausado',
};

const COMUNAS = ['all', '8A', '8B', '10A'];

const projectFields = [
  { key: 'name', label: 'Título obra en SAP', required: true },
  { key: 'code', label: 'Nº Orden SAP', placeholder: '420000000' },
  { key: 'client_name', label: 'Establecimiento' },
  { key: 'address', label: 'Dirección' },
  { key: 'status', label: 'Estado', type: 'select', options: [
    { value: 'pendiente', label: 'Pendiente' }, { value: 'en_progreso', label: 'En Progreso' },
    { value: 'pausado', label: 'Pausado' }, { value: 'completado', label: 'Completado' }, { value: 'cancelado', label: 'Cancelado' }
  ]},
  { key: 'start_date', label: 'AI (Fecha Inicio)', type: 'date' },
  { key: 'end_date', label: 'AR (Fecha Recepción)', type: 'date' },
  { key: 'estimated_budget', label: 'Monto Base Feb-23', type: 'number' },
  { key: 'progress', label: '% Avance', type: 'number' },
  { key: 'notes', label: 'Notas (Jefe Sitio, Inspector, etc.)', type: 'textarea' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function getDetalle(project) {
  // Intentar extraer el detalle de las notas
  const notes = project.notes || '';
  const detalleMatch = notes.match(/Detalle:\s*([^|]+)/);
  if (detalleMatch) return detalleMatch[1].trim();
  return STATUS_LABELS[project.status] || project.status || '—';
}

function getComuna(project) {
  const notes = project.notes || '';
  const m = notes.match(/Comuna:\s*([^|]+)/);
  if (m) return m[1].trim();
  return '—';
}

function getJefeSitio(project) {
  const notes = project.notes || '';
  const m = notes.match(/Jefe de Sitio:\s*([^|]+)/);
  if (m) return m[1].trim();
  return '—';
}

function getInspector(project) {
  const notes = project.notes || '';
  const m = notes.match(/Inspector:\s*([^|]+)/);
  if (m) return m[1].trim();
  return '—';
}

function fmtMonto(val) {
  if (!val || val === 0) return '—';
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  return `$${val.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

function fmtFecha(val) {
  if (!val) return '—';
  try { return format(new Date(val), 'dd/MM/yy'); } catch { return '—'; }
}

// ─── Componente fila ─────────────────────────────────────────────────────────

function ProyectoFila({ project, selected, onToggle, onOpen, onDelete }) {
  const detalle = getDetalle(project);
  const colors = DETALLE_COLORS[detalle] || DETALLE_COLORS[project.status] || DETALLE_COLORS['pendiente'];
  const avance = project.progress || 0;

  return (
    <div
      className={`group grid items-center border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors cursor-pointer text-xs
        ${selected ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
      style={{ gridTemplateColumns: 'var(--cols)' }}
      onClick={() => onOpen(project)}
    >
      {/* Checkbox */}
      <div className="px-2 py-2 flex items-center justify-center" onClick={e => { e.stopPropagation(); onToggle(project.id); }}>
        <Checkbox checked={selected} />
      </div>
      {/* COMUNA */}
      <div className="px-2 py-2 font-mono text-slate-400 font-semibold">{getComuna(project)}</div>
      {/* DIRECCIÓN */}
      <div className="px-2 py-2 text-slate-300 truncate" title={project.address}>{project.address || '—'}</div>
      {/* ESTABLECIMIENTO */}
      <div className="px-2 py-2 text-slate-300 truncate" title={project.client_name}>{project.client_name || '—'}</div>
      {/* TÍTULO */}
      <div className="px-2 py-2 text-white font-medium truncate" title={project.name}>{project.name}</div>
      {/* MONTO */}
      <div className="px-2 py-2 text-right font-mono text-slate-300 tabular-nums">{fmtMonto(project.estimated_budget)}</div>
      {/* Nº ORDEN */}
      <div className="px-2 py-2 font-mono text-slate-400 text-center">{project.code || '—'}</div>
      {/* ESTADO / DETALLE */}
      <div className="px-2 py-2">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${colors.dot} shrink-0`} />
          {detalle}
        </span>
      </div>
      {/* AI */}
      <div className="px-2 py-2 text-center font-mono text-slate-400">{fmtFecha(project.start_date)}</div>
      {/* AR */}
      <div className="px-2 py-2 text-center font-mono text-slate-400">{fmtFecha(project.end_date)}</div>
      {/* % AVANCE */}
      <div className="px-2 py-2">
        <div className="flex items-center gap-1.5">
          <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${avance >= 100 ? 'bg-emerald-500' : avance > 50 ? 'bg-blue-500' : 'bg-yellow-500'}`}
              style={{ width: `${Math.min(100, avance)}%` }}
            />
          </div>
          <span className={`text-xs font-bold tabular-nums w-8 text-right ${avance >= 100 ? 'text-emerald-400' : 'text-slate-300'}`}>
            {avance}%
          </span>
        </div>
      </div>
      {/* JEFE SITIO */}
      <div className="px-2 py-2 text-slate-400 truncate hidden xl:block" title={getJefeSitio(project)}>{getJefeSitio(project)}</div>
      {/* INSPECTOR */}
      <div className="px-2 py-2 text-slate-400 truncate hidden xl:block" title={getInspector(project)}>{getInspector(project)}</div>
      {/* ACCIONES */}
      <div className="px-2 py-2 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:bg-red-500/10"
          onClick={() => onDelete(project.id)}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────

export default function Projects() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [comunaFilter, setComunaFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showObrasImporter, setShowObrasImporter] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState(1);
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-created_date', 5000),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editing ? base44.entities.Project.update(editing.id, data) : base44.entities.Project.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projects'] }); setDialogOpen(false); setEditing(null); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Project.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] })
  });

  // Stats rápidos por detalle
  const stats = useMemo(() => {
    const counts = {};
    projects.forEach(p => {
      const d = getDetalle(p);
      counts[d] = (counts[d] || 0) + 1;
    });
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
      if (sortKey === 'name') { av = a.name || ''; bv = b.name || ''; }
      else if (sortKey === 'monto') { av = a.estimated_budget || 0; bv = b.estimated_budget || 0; }
      else if (sortKey === 'avance') { av = a.progress || 0; bv = b.progress || 0; }
      else if (sortKey === 'ai') { av = a.start_date || ''; bv = b.start_date || ''; }
      else if (sortKey === 'detalle') { av = getDetalle(a); bv = getDetalle(b); }
      else if (sortKey === 'comuna') { av = getComuna(a); bv = getComuna(b); }
      else { av = a[sortKey] || ''; bv = b[sortKey] || ''; }
      if (av < bv) return -1 * sortDir;
      if (av > bv) return 1 * sortDir;
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

  // Selección
  const toggleSelect = useCallback((id) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const toggleAll = () => {
    setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map(p => p.id)));
  };

  const handleBulkDelete = async () => {
    setDeleting(true);
    const ids = [...selected];
    let ok = 0, fail = 0;
    for (let i = 0; i < ids.length; i += 10) {
      const batch = ids.slice(i, i + 10);
      const results = await Promise.allSettled(batch.map(id => base44.entities.Project.delete(id)));
      ok += results.filter(r => r.status === 'fulfilled').length;
      fail += results.filter(r => r.status === 'rejected').length;
    }
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    setSelected(new Set()); setDeleting(false); setConfirmDelete(false);
    toast.success(`${ok} obras eliminadas${fail > 0 ? ` (${fail} con error)` : ''}`);
  };

  // CSS variable para el grid
  const colsVar = 'repeat(1,28px) 48px 1fr 1fr 2fr 80px 90px 110px 70px 70px 100px 120px 120px 32px';

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col gap-3 text-sm">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">Planilla de Obras</h1>
          <p className="text-slate-400 text-xs">
            {projects.length.toLocaleString()} obras · 8A: {comunaStats['8A']} · 8B: {comunaStats['8B']} · 10A: {comunaStats['10A']}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selected.size > 0 ? (
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
              <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => setShowObrasImporter(true)}>
                <Upload className="h-3 w-3" /> Importar planilla
              </Button>
              <Button size="sm" className="text-xs h-7 gap-1 bg-primary hover:bg-primary/90" onClick={() => { setEditing(null); setDialogOpen(true); }}>
                <Plus className="h-3 w-3" /> Nueva obra
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── RESUMEN ESTADOS ── */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(stats).sort((a,b) => b[1]-a[1]).slice(0,8).map(([d, n]) => {
          const c = DETALLE_COLORS[d] || DETALLE_COLORS['pendiente'];
          return (
            <button key={d}
              onClick={() => setStatusFilter(d === statusFilter ? 'all' : d)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all
                ${c.bg} ${c.text} border-current/20 hover:opacity-80`}>
              <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
              {d}: {n}
            </button>
          );
        })}
      </div>

      {/* ── FILTROS ── */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por título, establecimiento, dirección, código..."
            className="pl-8 h-8 text-xs bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500" />
          {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"><X className="h-3 w-3" /></button>}
        </div>
        <Select value={comunaFilter} onValueChange={setComunaFilter}>
          <SelectTrigger className="w-28 h-8 text-xs bg-slate-800/50 border-slate-700/50 text-white">
            <SelectValue placeholder="Comuna" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {['8A','8B','10A'].map(c => <SelectItem key={c} value={c}>Comuna {c}</SelectItem>)}
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

      {/* ── TABLA ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 overflow-hidden overflow-x-auto bg-slate-900/40 flex-1">
          {/* Header de columnas */}
          <div
            className="grid bg-slate-800/60 border-b border-slate-700"
            style={{ '--cols': colsVar, gridTemplateColumns: 'var(--cols)' }}
          >
            {/* Checkbox */}
            <div className="px-2 py-2 flex items-center justify-center">
              <Checkbox checked={selected.size > 0 && selected.size === filtered.length}
                onCheckedChange={toggleAll} />
            </div>
            {[
              { k: 'comuna', label: 'COM.' },
              { k: 'address', label: 'DIRECCIÓN' },
              { k: 'client_name', label: 'ESTABLECIMIENTO' },
              { k: 'name', label: 'TÍTULO OBRA EN SAP' },
              { k: 'monto', label: 'MONTO' },
              { k: 'code', label: 'Nº ORDEN' },
              { k: 'detalle', label: 'ESTADO' },
              { k: 'ai', label: 'AI' },
              { k: 'ar', label: 'AR' },
              { k: 'avance', label: '% AVANCE' },
              { k: 'jefe', label: 'JEFE SITIO', hidden: true },
              { k: 'inspector', label: 'INSPECTOR', hidden: true },
              { k: '_', label: '' },
            ].map(col => (
              <div key={col.k}
                className={`group px-2 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide select-none cursor-pointer hover:text-white transition-colors flex items-center gap-0.5 ${col.hidden ? 'hidden xl:flex' : ''}`}
                onClick={() => col.k !== '_' && toggleSort(col.k)}>
                {col.label} {col.k !== '_' && <SortIcon k={col.k} />}
              </div>
            ))}
          </div>

          {/* Filas */}
          <div style={{ '--cols': colsVar }}>
            {filtered.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-sm">
                No se encontraron obras con los filtros actuales
              </div>
            ) : (
              filtered.map(project => (
                <ProyectoFila
                  key={project.id}
                  project={project}
                  selected={selected.has(project.id)}
                  onToggle={toggleSelect}
                  onOpen={setSelectedProject}
                  onDelete={(id) => deleteMutation.mutate(id)}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* ── MODALS ── */}
      <EntityFormDialog
        open={dialogOpen} onOpenChange={setDialogOpen}
        title={editing ? 'Editar Obra' : 'Nueva Obra'}
        fields={projectFields}
        initialData={editing || { status: 'pendiente', progress: 0 }}
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

      {/* Confirmación borrado masivo */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={() => setConfirmDelete(false)} />
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
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)} disabled={deleting}>Cancelar</Button>
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