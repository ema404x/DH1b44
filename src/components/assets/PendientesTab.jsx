import React, { useState, useMemo, useEffect } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search, Plus, ClipboardList, AlertCircle, Upload,
  LayoutGrid, Table2, X, ChevronUp, ChevronDown, Trash2
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format, parseISO, startOfDay } from 'date-fns';

// Parsea fecha YYYY-MM-DD como local (evita desfase UTC → Argentina)
const parseLocalDate = (s) => s ? parseISO(s) : null;
const isVencidoDate = (fecha_limite, estado) => {
  if (!fecha_limite || estado === 'resuelto' || estado === 'cancelado') return false;
  return startOfDay(parseLocalDate(fecha_limite)) < startOfDay(new Date());
};
import { toast } from 'sonner';
import PendienteDialog from '@/components/assets/PendienteDialog';
import PendienteCard from '@/components/assets/PendienteCard';
import ImportarPendientesSAP from '@/components/assets/ImportarPendientesSAP';
import ExportarPendientesPDF from '@/components/assets/ExportarPendientesPDF';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePermission } from '@/hooks/usePermission';

const COMUNAS = ['8A', '8B', '10A'];

const estadoColors = {
  pendiente:   'bg-amber-500/15 text-amber-400 border-amber-500/30',
  asignado:    'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  en_progreso: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  resuelto:    'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  cancelado:   'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

const prioridadColors = {
  baja:    'bg-slate-500/15 text-slate-400 border-slate-500/30',
  media:   'bg-blue-500/15 text-blue-400 border-blue-500/30',
  alta:    'bg-orange-500/15 text-orange-400 border-orange-500/30',
  urgente: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const estadoLabels = {
  pendiente: 'Pendiente', asignado: 'Asignado',
  en_progreso: 'En progreso', resuelto: 'Resuelto', cancelado: 'Cancelado',
};

export default function PendientesTab() {
  const [activeComuna, setActiveComuna] = useState('8A');
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState('all');
  const [filterInspector, setFilterInspector] = useState('all');
  const [viewMode, setViewMode] = useState('table');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [sortCol, setSortCol] = useState('fecha_limite');
  const [sortDir, setSortDir] = useState('asc');
  const [canDelete, setCanDelete] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const qc = useQueryClient();
  const { isAdmin, filterByUser } = useCurrentUser();
  const { allowed: canCreate } = usePermission('Asset', 'create');
  const { allowed: canEdit } = usePermission('Asset', 'update');
  const { allowed: permCanDelete } = usePermission('Asset', 'delete');

  useEffect(() => { setCanDelete(isAdmin && permCanDelete); }, [isAdmin, permCanDelete]);

  // Reset filters when switching commune
  useEffect(() => {
    setSearch('');
    setFilterEstado('all');
    setFilterInspector('all');
    setSelectedIds(new Set());
  }, [activeComuna]);

  const { data: pendientes = [], isLoading } = useQuery({
    queryKey: ['pendientes'],
    queryFn: () => base44.entities.Pendiente.list('-created_date'),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => selected
      ? base44.entities.Pendiente.update(selected.id, data)
      : base44.entities.Pendiente.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pendientes'] });
      setDialogOpen(false);
      setSelected(null);
      toast.success(selected ? 'Pendiente actualizado' : 'Pendiente creado');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Pendiente.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pendientes'] });
      toast.success('Pendiente eliminado');
    },
  });

  const openNew = () => { setSelected(null); setDialogOpen(true); };
  const openEdit = (p) => { setSelected(p); setDialogOpen(true); };

  const quickSaveMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Pendiente.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pendientes'] });
      toast.success('Guardado');
    },
    onError: () => toast.error('Error al guardar'),
  });

  const handleQuickSave = (id, changes) => quickSaveMutation.mutate({ id, data: changes });



  const toggleSelectId = (id, e) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      await Promise.all([...selectedIds].map(id => base44.entities.Pendiente.delete(id)));
      qc.invalidateQueries({ queryKey: ['pendientes'] });
      toast.success(`${selectedIds.size} pendientes eliminados`);
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
    } catch {
      toast.error('Error al eliminar algunos pendientes');
    } finally {
      setBulkDeleting(false);
    }
  };

  const visiblePendientes = useMemo(() =>
    filterByUser(pendientes, ['jefe_sitio', 'jefe_sitio_email', 'inspector', 'created_by'])
  , [pendientes, isAdmin]);

  // Stats per commune (for tab badges)
  const statsByComuna = useMemo(() => {
    const stats = {};
    for (const c of COMUNAS) {
      const cp = visiblePendientes.filter(p => p.comuna === c);
      stats[c] = {
        total: cp.length,
        pendiente: cp.filter(p => p.estado === 'pendiente').length,
        vencidos: cp.filter(p => isVencidoDate(p.fecha_limite, p.estado)).length,
      };
    }
    return stats;
  }, [visiblePendientes]);

  // Pendientes for active commune
  const comunaPendientes = useMemo(() =>
    visiblePendientes.filter(p => p.comuna === activeComuna)
  , [visiblePendientes, activeComuna]);

  // Unique inspectors in this commune
  const inspectors = useMemo(() =>
    [...new Set(comunaPendientes.map(p => p.inspector).filter(Boolean))].sort()
  , [comunaPendientes]);

  const filtered = useMemo(() => {
    let result = comunaPendientes.filter(p => {
      const matchSearch = !search ||
        p.descripcion?.toLowerCase().includes(search.toLowerCase()) ||
        p.numero_sap?.toLowerCase().includes(search.toLowerCase()) ||
        p.sitio?.toLowerCase().includes(search.toLowerCase()) ||
        p.establecimiento?.toLowerCase().includes(search.toLowerCase()) ||
        p.inspector?.toLowerCase().includes(search.toLowerCase()) ||
        p.jefe_sitio?.toLowerCase().includes(search.toLowerCase());
      const matchEstado = filterEstado === 'all' || p.estado === filterEstado;
      const matchInspector = filterInspector === 'all' || p.inspector === filterInspector;
      return matchSearch && matchEstado && matchInspector;
    });

    result = [...result].sort((a, b) => {
      let va = a[sortCol] || '';
      let vb = b[sortCol] || '';
      if (sortCol === 'fecha_limite' || sortCol === 'fecha_emision_sap') {
        va = va ? new Date(va).getTime() : 0;
        vb = vb ? new Date(vb).getTime() : 0;
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [comunaPendientes, search, filterEstado, filterInspector, sortCol, sortDir]);

  const stats = useMemo(() => ({
    total: comunaPendientes.length,
    pendiente: comunaPendientes.filter(p => p.estado === 'pendiente').length,
    asignado: comunaPendientes.filter(p => p.estado === 'asignado' || p.estado === 'en_progreso').length,
    resuelto: comunaPendientes.filter(p => p.estado === 'resuelto').length,
    vencidos: comunaPendientes.filter(p => isVencidoDate(p.fecha_limite, p.estado)).length,
  }), [comunaPendientes]);

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return null;
    return sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

  return (
    <div className="space-y-5">
      {/* COMMUNE TABS */}
      <div className="flex gap-1 border-b border-border">
        {COMUNAS.map(c => {
          const s = statsByComuna[c] || {};
          const isActive = activeComuna === c;
          return (
            <button
              key={c}
              onClick={() => setActiveComuna(c)}
              className={`relative px-5 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px flex items-center gap-2 ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              Comuna {c}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${isActive ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                {s.total || 0}
              </span>
              {s.vencidos > 0 && (
                <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                  {s.vencidos} ⚠
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Stats for active commune */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total',       value: stats.total,     accent: 'border-l-slate-400',   val: 'text-foreground' },
          { label: 'Sin asignar', value: stats.pendiente, accent: 'border-l-amber-400',   val: 'text-amber-400' },
          { label: 'En curso',    value: stats.asignado,  accent: 'border-l-blue-500',    val: 'text-blue-400' },
          { label: 'Resueltos',   value: stats.resuelto,  accent: 'border-l-emerald-500', val: 'text-emerald-400' },
          { label: 'Vencidos',    value: stats.vencidos,  accent: 'border-l-red-500',     val: stats.vencidos > 0 ? 'text-red-400' : 'text-foreground' },
        ].map(s => (
          <Card key={s.label} className={`border-l-4 ${s.accent} border-border/50`}>
            <CardContent className="pt-4 pb-3">
              <div className={`text-2xl font-bold tabular-nums ${s.val}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5 font-medium">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar SAP, descripción, sitio, inspector..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
            {search && (
              <button className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setSearch('')}>
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>

          <Select value={filterEstado} onValueChange={setFilterEstado}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="pendiente">Pendiente</SelectItem>
              <SelectItem value="asignado">Asignado</SelectItem>
              <SelectItem value="en_progreso">En progreso</SelectItem>
              <SelectItem value="resuelto">Resuelto</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>

          {inspectors.length > 0 && (
            <Select value={filterInspector} onValueChange={setFilterInspector}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Inspector" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los inspectores</SelectItem>
                {inspectors.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex gap-2 justify-between">
          <div className="text-sm text-muted-foreground self-center">
            {filtered.length.toLocaleString()} de {comunaPendientes.length.toLocaleString()} órdenes · Comuna {activeComuna}
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <div className="flex border rounded-md overflow-hidden">
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 flex items-center gap-1.5 text-xs ${viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              >
                <Table2 className="h-3.5 w-3.5" /> Tabla
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1.5 flex items-center gap-1.5 text-xs ${viewMode === 'cards' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Cards
              </button>
            </div>
            <ExportarPendientesPDF
              pendientes={filtered}
              filterInfo={[
                `Comuna: ${activeComuna}`,
                filterEstado !== 'all' ? `Estado: ${filterEstado}` : '',
                filterInspector !== 'all' ? `Inspector: ${filterInspector}` : '',
                search ? `Búsqueda: "${search}"` : '',
              ].filter(Boolean).join(' | ')}
            />
            {canCreate && (
              <Button variant="outline" className="gap-1.5" onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4" /> Importar SAP
              </Button>
            )}

            {canDelete && selectedIds.size > 0 && (
              <>
                <span className="text-sm font-medium text-primary self-center">{selectedIds.size} sel.</span>
                <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="gap-1.5">
                      <Trash2 className="h-4 w-4" /> Eliminar seleccionados
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar {selectedIds.size} pendientes?</AlertDialogTitle>
                      <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleBulkDelete} disabled={bulkDeleting}>
                        {bulkDeleting ? 'Eliminando...' : 'Eliminar'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <button onClick={() => setSelectedIds(new Set())} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </>
            )}
            {canCreate && (
              <Button onClick={openNew} className="gap-1.5">
                <Plus className="h-4 w-4" /> Nuevo
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="rounded-lg border border-border/50 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border/50">
                <tr>
                  {canDelete && <th className="px-3 py-2.5 w-8">
                    <Checkbox
                      checked={selectedIds.size > 0 && selectedIds.size === filtered.length}
                      onCheckedChange={() => {
                        if (selectedIds.size === filtered.length) setSelectedIds(new Set());
                        else setSelectedIds(new Set(filtered.map(p => p.id)));
                      }}
                    />
                  </th>}
                  {[
                    { key: 'inspector', label: 'Inspector' },
                    { key: 'sitio', label: 'Ubicación' },
                    { key: 'establecimiento', label: 'Establecimiento' },
                    { key: 'descripcion', label: 'Tareas a realizar' },
                    { key: 'numero_sap', label: 'N° Orden' },
                    { key: 'fecha_emision_sap', label: 'Inicio' },
                    { key: 'fecha_limite', label: 'Límite' },
                    { key: 'clase_orden', label: 'Clase' },
                    { key: 'estado', label: 'Estado' },
                    { key: 'jefe_sitio', label: 'Jefe Sitio' },
                    ...(canDelete ? [{ key: '_delete', label: '' }] : []),
                  ].map(col => (
                    <th
                      key={col.key}
                      onClick={col.key === '_delete' ? undefined : () => toggleSort(col.key)}
                      className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none whitespace-nowrap"
                    >
                      <span className="flex items-center gap-1">
                        {col.label} <SortIcon col={col.key} />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {isLoading ? (
                  <tr>
                    <td colSpan={12} className="text-center py-16 text-muted-foreground">
                      <div className="w-6 h-6 border-2 border-border border-t-primary rounded-full animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center py-16 text-muted-foreground">
                      <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-20" />
                      <p className="font-medium">No hay pendientes en Comuna {activeComuna}</p>
                      <p className="text-xs mt-1 opacity-70">Importá desde SAP o creá uno manualmente</p>
                    </td>
                  </tr>
                ) : filtered.map((p, idx) => {
                  const isVencido = isVencidoDate(p.fecha_limite, p.estado);
                  return (
                    <tr
                      key={p.id}
                      onClick={canEdit ? () => openEdit(p) : undefined}
                      className={`transition-colors ${canEdit ? 'cursor-pointer' : ''} ${
                        selectedIds.has(p.id) ? 'bg-primary/10' :
                        isVencido ? 'bg-red-950/30 hover:bg-red-950/50' :
                        idx % 2 !== 0 ? 'bg-muted/10 hover:bg-accent/20' : 'hover:bg-accent/20'
                      }`}
                    >
                      {canDelete && (
                        <td className="px-3 py-2.5 w-8" onClick={e => toggleSelectId(p.id, e)}>
                          <Checkbox checked={selectedIds.has(p.id)} />
                        </td>
                      )}
                      <td className="px-3 py-2.5 text-xs font-medium whitespace-nowrap text-foreground/90">{p.inspector || '—'}</td>
                      <td className="px-3 py-2.5 text-xs max-w-36 truncate text-foreground/70" title={p.sitio}>{p.sitio || '—'}</td>
                      <td className="px-3 py-2.5 text-xs max-w-36 truncate text-foreground/70" title={p.establecimiento}>{p.establecimiento || '—'}</td>
                      <td className="px-3 py-2.5 text-xs max-w-52">
                        <span className="line-clamp-2 leading-snug text-foreground/80" title={p.descripcion}>{p.descripcion}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs font-mono whitespace-nowrap text-primary/80">{p.numero_sap || '—'}</td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap tabular-nums text-foreground/70">
                        {p.fecha_emision_sap ? format(parseLocalDate(p.fecha_emision_sap), 'dd/MM/yy') : '—'}
                      </td>
                      <td className={`px-3 py-2.5 text-xs whitespace-nowrap tabular-nums font-medium ${isVencido ? 'text-red-400' : 'text-foreground/70'}`}>
                        {p.fecha_limite ? format(parseLocalDate(p.fecha_limite), 'dd/MM/yy') : '—'}
                        {isVencido && <span className="ml-1 text-red-400">⚠</span>}
                      </td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap text-foreground/60">{p.clase_orden || '—'}</td>
                      <td className="px-3 py-2.5">
                        <Badge variant="outline" className={`text-[10px] border px-1.5 py-0.5 ${estadoColors[p.estado]}`}>
                          {estadoLabels[p.estado]}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                        {p.jefe_sitio
                          ? <span className="text-primary/90 font-medium">{p.jefe_sitio}</span>
                          : <span className="text-amber-400/80 flex items-center gap-1"><AlertCircle className="h-3 w-3" />Sin asignar</span>
                        }
                      </td>
                      {canDelete && (
                        <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/50 hover:text-destructive hover:bg-destructive/10">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar pendiente?</AlertDialogTitle>
                                <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(p.id)}>Eliminar</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CARDS VIEW */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(p => (
            <PendienteCard
              key={p.id}
              pendiente={p}
              estadoColors={estadoColors}
              prioridadColors={prioridadColors}
              onEdit={canEdit ? openEdit : undefined}
              onDelete={(id) => deleteMutation.mutate(id)}
              onQuickSave={handleQuickSave}
              isSaving={quickSaveMutation.isPending}
              canDelete={canDelete}
            />
          ))}
          {filtered.length === 0 && !isLoading && (
            <div className="col-span-full text-center py-16 text-muted-foreground">
              <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">No hay pendientes en Comuna {activeComuna}</p>
              <p className="text-sm mt-1">Importá desde SAP o creá uno manualmente</p>
            </div>
          )}
        </div>
      )}

      {/* Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" /> Importar Pendientes SAP — Comuna {activeComuna}
            </DialogTitle>
          </DialogHeader>
          <ImportarPendientesSAP
            defaultComuna={activeComuna}
            onImportDone={() => {
              qc.invalidateQueries({ queryKey: ['pendientes'] });
              setImportOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>

      <PendienteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        pendiente={selected}
        onSave={(data) => saveMutation.mutate(data)}
        isSaving={saveMutation.isPending}
      />
    </div>
  );
}