import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Search, Plus, ClipboardList, User, Calendar, MapPin,
  AlertTriangle, CheckCircle2, Clock, Zap, Wrench, Eye, Trash2, FileText
} from 'lucide-react';
import { exportOTsPDF } from '@/utils/exportPDF';
import { format, isPast, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import EmptyState from '@/components/shared/EmptyState';
import WorkOrderDetailPanel from '@/components/workorders/WorkOrderDetailPanel';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const typeLabels = {
  mantenimiento_preventivo: 'Preventivo', mantenimiento_correctivo: 'Correctivo',
  instalacion: 'Instalación', inspeccion: 'Inspección', reparacion: 'Reparación', emergencia: 'Emergencia'
};

const statusConfig = {
  pendiente:   { label: 'Pendiente',   color: 'bg-slate-100 text-slate-600 border-slate-200',   dot: 'bg-slate-400' },
  asignada:    { label: 'Asignada',    color: 'bg-blue-100 text-blue-700 border-blue-200',       dot: 'bg-blue-500' },
  en_progreso: { label: 'En Progreso', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' },
  en_espera:   { label: 'En Espera',   color: 'bg-yellow-100 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
  completada:  { label: 'Completada',  color: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  cancelada:   { label: 'Cancelada',   color: 'bg-red-100 text-red-600 border-red-200',          dot: 'bg-red-400' },
};

const priorityConfig = {
  baja:    { color: 'text-slate-500', bg: 'bg-slate-50' },
  media:   { color: 'text-blue-600',  bg: 'bg-blue-50' },
  alta:    { color: 'text-orange-600', bg: 'bg-orange-50' },
  urgente: { color: 'text-red-600',   bg: 'bg-red-50' },
};

const typeIcons = {
  mantenimiento_preventivo: Wrench, mantenimiento_correctivo: Wrench,
  instalacion: Zap, inspeccion: Eye, reparacion: Wrench, emergencia: AlertTriangle,
};

const STATUS_TABS = [
  { value: 'all', label: 'Todas' },
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'en_progreso', label: 'En Progreso' },
  { value: 'completada', label: 'Completadas' },
];

function NewOrderDialog({ open, onOpenChange, onSave, saving }) {
  const [form, setForm] = useState({ title: '', type: 'mantenimiento_correctivo', priority: 'media', status: 'pendiente' });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nueva Orden de Trabajo</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase">Título *</label>
            <Input className="mt-1" placeholder="Ej: Revisión sistema eléctrico" value={form.title} onChange={e => set('title', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase">Tipo</label>
              <Select value={form.type} onValueChange={v => set('type', v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(typeLabels).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase">Prioridad</label>
              <Select value={form.priority} onValueChange={v => set('priority', v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['baja','media','alta','urgente'].map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase">Activo / Equipo</label>
              <Input className="mt-1" placeholder="Nombre del activo" value={form.asset_name || ''} onChange={e => set('asset_name', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase">Ubicación</label>
              <Input className="mt-1" placeholder="Ej: Planta Norte" value={form.location || ''} onChange={e => set('location', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase">Asignado a</label>
              <Input className="mt-1" placeholder="Técnico" value={form.assigned_name || ''} onChange={e => set('assigned_name', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase">Fecha Programada</label>
              <Input type="date" className="mt-1" value={form.scheduled_date || ''} onChange={e => set('scheduled_date', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase">Descripción</label>
            <textarea
              className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm min-h-[70px] resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Descripción de la tarea..."
              value={form.description || ''}
              onChange={e => set('description', e.target.value)}
            />
          </div>
          <Button className="w-full" onClick={() => onSave(form)} disabled={!form.title.trim() || saving}>
            {saving ? 'Guardando...' : 'Crear Orden'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WorkOrderCard({ order, onOpen, onDelete }) {
  const sc = statusConfig[order.status] || statusConfig.pendiente;
  const pc = priorityConfig[order.priority] || priorityConfig.media;
  const TypeIcon = typeIcons[order.type] || Wrench;
  const isOverdue = order.scheduled_date && isPast(parseISO(order.scheduled_date)) && !['completada','cancelada'].includes(order.status);
  const checklistTotal = order.checklist?.length || 0;
  const checklistDone = order.checklist?.filter(t => t.completed).length || 0;

  return (
    <div
      className={`group bg-card border rounded-xl p-4 hover:shadow-md transition-all cursor-pointer ${isOverdue ? 'border-red-300 bg-red-50/30' : 'border-border'}`}
      onClick={() => onOpen(order)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${pc.bg}`}>
            <TypeIcon className={`h-4 w-4 ${pc.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {order.code && <span className="text-[10px] font-mono text-muted-foreground">{order.code}</span>}
              {isOverdue && <span className="text-[10px] font-medium text-red-600 bg-red-100 px-1.5 py-0.5 rounded">VENCIDA</span>}
            </div>
            <h3 className="text-sm font-semibold mt-0.5 leading-tight">{order.title}</h3>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {order.asset_name && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Wrench className="h-3 w-3" />{order.asset_name}
                </span>
              )}
              {order.location && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />{order.location}
                </span>
              )}
              {order.assigned_name && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" />{order.assigned_name}
                </span>
              )}
              {order.scheduled_date && (
                <span className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                  <Calendar className="h-3 w-3" />{format(parseISO(order.scheduled_date), 'd MMM', { locale: es })}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${sc.color}`}>
            {sc.label}
          </span>
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${pc.bg} ${pc.color} capitalize`}>
            {order.priority}
          </span>
        </div>
      </div>

      {checklistTotal > 0 && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Checklist</span>
            <span>{checklistDone}/{checklistTotal}</span>
          </div>
          <div className="w-full bg-muted rounded-full h-1">
            <div
              className="bg-primary h-1 rounded-full transition-all"
              style={{ width: `${checklistTotal > 0 ? (checklistDone / checklistTotal) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {(order.photos?.length > 0 || order.signature_url) && (
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          {order.photos?.length > 0 && <span>📷 {order.photos.length} foto{order.photos.length > 1 ? 's' : ''}</span>}
          {order.signature_url && <span>✍️ Firmada</span>}
        </div>
      )}
    </div>
  );
}

export default function WorkOrders() {
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['workorders'],
    queryFn: () => base44.entities.WorkOrder.list('-created_date')
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.WorkOrder.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['workorders'] }); setNewDialogOpen(false); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.WorkOrder.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['workorders'] }); setSelectedOrder(null); }
  });

  const filtered = orders.filter(o => {
    const matchSearch = !search || o.title?.toLowerCase().includes(search.toLowerCase()) || o.assigned_name?.toLowerCase().includes(search.toLowerCase()) || o.asset_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusTab === 'all' || o.status === statusTab;
    const matchPriority = priorityFilter === 'all' || o.priority === priorityFilter;
    return matchSearch && matchStatus && matchPriority;
  });

  // Stats
  const stats = {
    total: orders.length,
    pendientes: orders.filter(o => o.status === 'pendiente').length,
    en_progreso: orders.filter(o => o.status === 'en_progreso').length,
    urgentes: orders.filter(o => o.priority === 'urgente' && !['completada','cancelada'].includes(o.status)).length,
    completadas: orders.filter(o => o.status === 'completada').length,
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Órdenes de Trabajo</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{orders.length} órdenes en total</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50" onClick={() => exportOTsPDF(filtered, null, null)}>
            <FileText className="h-3.5 w-3.5" /> PDF
          </Button>
          <Button className="gap-2 shadow-sm" onClick={() => setNewDialogOpen(true)}>
            <Plus className="h-4 w-4" /> Nueva OT
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Pendientes', value: stats.pendientes, color: 'text-slate-600', bg: 'bg-slate-50' },
          { label: 'En Progreso', value: stats.en_progreso, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Urgentes', value: stats.urgentes, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Completadas', value: stats.completadas, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-3 border border-border/40`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar OT, técnico, activo..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setStatusTab(tab.value)}
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all ${statusTab === tab.value ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Prioridad" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="urgente">Urgente</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="media">Media</SelectItem>
            <SelectItem value="baja">Baja</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Cards grid */}
      {filtered.length === 0 && !isLoading ? (
        <EmptyState icon={ClipboardList} title="No hay órdenes" description="Creá una nueva orden de trabajo" actionLabel="Nueva OT" onAction={() => setNewDialogOpen(true)} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(order => (
            <WorkOrderCard key={order.id} order={order} onOpen={setSelectedOrder} onDelete={deleteMutation.mutate} />
          ))}
        </div>
      )}

      {/* New order dialog */}
      <NewOrderDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        onSave={createMutation.mutate}
        saving={createMutation.isPending}
      />

      {/* Detail panel */}
      {selectedOrder && (
        <WorkOrderDetailPanel
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
}