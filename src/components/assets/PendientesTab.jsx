import React, { useState, useMemo, useEffect } from 'react';
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { isPast, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import PendienteDialog from '@/components/assets/PendienteDialog';
import PendienteCard from '@/components/assets/PendienteCard';
import ImportarPendientesSAP from '@/components/assets/ImportarPendientesSAP';
import ExportarPendientesPDF from '@/components/assets/ExportarPendientesPDF';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const estadoColors = {
  pendiente: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  asignado: 'bg-blue-100 text-blue-700 border-blue-200',
  en_progreso: 'bg-purple-100 text-purple-700 border-purple-200',
  resuelto: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  cancelado: 'bg-gray-100 text-gray-500 border-gray-200',
};

const prioridadColors = {
  baja: 'bg-slate-100 text-slate-600',
  media: 'bg-blue-100 text-blue-700',
  alta: 'bg-orange-100 text-orange-700',
  urgente: 'bg-red-100 text-red-700',
};

const estadoLabels = {
  pendiente: 'Pendiente', asignado: 'Asignado',
  en_progreso: 'En progreso', resuelto: 'Resuelto', cancelado: 'Cancelado',
};

export default function PendientesTab() {
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState('all');
  const [filterInspector, setFilterInspector] = useState('all');
  const [filterComuna, setFilterComuna] = useState('all');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [sortCol, setSortCol] = useState('fecha_limite');
  const [sortDir, setSortDir] = useState('asc');
  const [canDelete, setCanDelete] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => {
      setCanDelete(u?.role === 'admin' || u?.can_delete_pendientes === true);
    }).catch(() => {});
  }, []);

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

  // Unique inspectors & comunas
  const inspectors = useMemo(() => [...new Set(pendientes.map(p => p.inspector).filter(Boolean))].sort(), [pendientes]);
  const comunas = useMemo(() => [...new Set(pendientes.map(p => p.comuna).filter(Boolean))].sort(), [pendientes]);

  const filtered = useMemo(() => {
    let result = pendientes.filter(p => {
      const matchSearch = !search ||
        p.descripcion?.toLowerCase().includes(search.toLowerCase()) ||
        p.numero_sap?.toLowerCase().includes(search.toLowerCase()) ||
        p.sitio?.toLowerCase().includes(search.toLowerCase()) ||
        p.establecimiento?.toLowerCase().includes(search.toLowerCase()) ||
        p.inspector?.toLowerCase().includes(search.toLowerCase()) ||
        p.jefe_sitio?.toLowerCase().includes(search.toLowerCase());
      const matchEstado = filterEstado === 'all' || p.estado === filterEstado;
      const matchInspector = filterInspector === 'all' || p.inspector === filterInspector;
      const matchComuna = filterComuna === 'all' || p.comuna === filterComuna;
      return matchSearch && matchEstado && matchInspector && matchComuna;
    });

    // Sort
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
  }, [pendientes, search, filterEstado, filterInspector, filterComuna, sortCol, sortDir]);

  const stats = {
    total: pendientes.length,
    pendiente: pendientes.filter(p => p.estado === 'pendiente').length,
    asignado: pendientes.filter(p => p.estado === 'asignado' || p.estado === 'en_progreso').length,
    resuelto: pendientes.filter(p => p.estado === 'resuelto').length,
    vencidos: pendientes.filter(p => p.fecha_limite && isPast(new Date(p.fecha_limite)) && p.estado !== 'resuelto' && p.estado !== 'cancelado').length,
  };

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
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'border-l-slate-400' },
          { label: 'Sin asignar', value: stats.pendiente, color: 'border-l-yellow-400' },
          { label: 'En curso', value: stats.asignado, color: 'border-l-blue-500' },
          { label: 'Resueltos', value: stats.resuelto, color: 'border-l-emerald-500' },
          { label: 'Vencidos', value: stats.vencidos, color: 'border-l-red-500' },
        ].map(s => (
          <Card key={s.label} className={`border-l-4 ${s.color}`}>
            <CardContent className="pt-4 pb-3">
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
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

          {comunas.length > 0 && (
            <Select value={filterComuna} onValueChange={setFilterComuna}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Comuna" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las comunas</SelectItem>
                {comunas.map(c => <SelectItem key={c} value={c}>Comuna {c}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex gap-2 justify-between">
          <div className="text-sm text-muted-foreground self-center">
            {filtered.length.toLocaleString()} de {pendientes.length.toLocaleString()} órdenes
          </div>
          <div className="flex gap-2">
            {/* View toggle */}
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
                filterEstado !== 'all' ? `Estado: ${filterEstado}` : '',
                filterInspector !== 'all' ? `Inspector: ${filterInspector}` : '',
                filterComuna !== 'all' ? `Comuna: ${filterComuna}` : '',
                search ? `Búsqueda: "${search}"` : '',
              ].filter(Boolean).join(' | ')}
            />
            <Button variant="outline" className="gap-1.5" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" /> Importar SAP
            </Button>
            <Button onClick={openNew} className="gap-1.5">
              <Plus className="h-4 w-4" /> Nuevo
            </Button>
          </div>
        </div>
      </div>

      {/* TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/60 border-b">
                  {[
                    { key: 'inspector', label: 'INSPECTOR' },
                    { key: 'sitio', label: 'UBICACIÓN' },
                    { key: 'establecimiento', label: 'ESTABLECIMIENTO' },
                    { key: 'descripcion', label: 'TAREAS A REALIZAR' },
                    { key: 'numero_sap', label: 'N° ORDEN' },
                    { key: 'fecha_emision_sap', label: 'FECHA INICIO' },
                    { key: 'fecha_limite', label: 'FECHA LÍMITE' },
                    { key: 'clase_orden', label: 'CLASE' },
                    { key: 'estado', label: 'ESTADO' },
                    { key: 'jefe_sitio', label: 'JEFE SITIO' },
                    { key: 'comuna', label: 'COMUNA' },
                    ...(canDelete ? [{ key: '_delete', label: '' }] : []),
                  ].map(col => (
                    <th
                      key={col.key}
                      onClick={() => toggleSort(col.key)}
                      className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer hover:text-foreground select-none whitespace-nowrap"
                    >
                      <span className="flex items-center gap-1">
                        {col.label} <SortIcon col={col.key} />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-16 text-muted-foreground">
                      <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-20" />
                      <p>No hay pendientes</p>
                    </td>
                  </tr>
                ) : filtered.map((p, idx) => {
                  const isVencido = p.fecha_limite && isPast(new Date(p.fecha_limite)) && p.estado !== 'resuelto' && p.estado !== 'cancelado';
                  return (
                    <tr
                      key={p.id}
                      onClick={() => openEdit(p)}
                      className={`border-b cursor-pointer hover:bg-muted/40 transition-colors ${isVencido ? 'bg-red-50/50' : idx % 2 === 0 ? 'bg-white' : 'bg-muted/10'}`}
                    >
                      <td className="px-3 py-2 text-xs font-medium whitespace-nowrap">{p.inspector || '—'}</td>
                      <td className="px-3 py-2 text-xs max-w-36 truncate" title={p.sitio}>{p.sitio || '—'}</td>
                      <td className="px-3 py-2 text-xs max-w-36 truncate" title={p.establecimiento}>{p.establecimiento || '—'}</td>
                      <td className="px-3 py-2 text-xs max-w-52">
                        <span className="line-clamp-2 leading-snug" title={p.descripcion}>{p.descripcion}</span>
                      </td>
                      <td className="px-3 py-2 text-xs font-mono whitespace-nowrap">{p.numero_sap || '—'}</td>
                      <td className="px-3 py-2 text-xs whitespace-nowrap">
                        {p.fecha_emision_sap ? format(new Date(p.fecha_emision_sap), 'dd/MM/yy') : '—'}
                      </td>
                      <td className={`px-3 py-2 text-xs whitespace-nowrap font-medium ${isVencido ? 'text-red-600' : ''}`}>
                        {p.fecha_limite ? format(new Date(p.fecha_limite), 'dd/MM/yy') : '—'}
                        {isVencido && ' ⚠'}
                      </td>
                      <td className="px-3 py-2 text-xs whitespace-nowrap">{p.clase_orden || '—'}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className={`text-[10px] border ${estadoColors[p.estado]}`}>
                          {estadoLabels[p.estado]}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-xs whitespace-nowrap">
                        {p.jefe_sitio
                          ? <span className="text-primary font-medium">{p.jefe_sitio}</span>
                          : <span className="text-yellow-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" />Sin asignar</span>
                        }
                      </td>
                      <td className="px-3 py-2">
                        {p.comuna
                          ? <Badge variant="outline" className="text-[10px]">{p.comuna}</Badge>
                          : <span className="text-xs text-muted-foreground">—</span>
                        }
                      </td>
                      {canDelete && (
                        <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
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
              onEdit={openEdit}
              onDelete={(id) => deleteMutation.mutate(id)}
              canDelete={canDelete}
            />
          ))}
          {filtered.length === 0 && !isLoading && (
            <div className="col-span-full text-center py-16 text-muted-foreground">
              <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">No hay pendientes</p>
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
              <Upload className="h-5 w-5" /> Importar Pendientes SAP
            </DialogTitle>
          </DialogHeader>
          <ImportarPendientesSAP
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