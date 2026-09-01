import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { History, Search, CheckCircle2, Clock, Archive, FileClock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useResolveCreator } from '@/hooks/useResolveCreator';

const statusColors = {
  pendiente: 'bg-yellow-100 text-yellow-700',
  asignada: 'bg-blue-100 text-blue-700',
  en_progreso: 'bg-purple-100 text-purple-700',
  completada: 'bg-emerald-100 text-emerald-700',
  cancelada: 'bg-gray-100 text-gray-500',
};

// Pestaña "Por Establecimiento": historial clásico (todas las OTs agrupadas
// por establecimiento). Pestaña "Archivadas": OTs que pasaron a completada y
// a los 30 días se archivaron automáticamente (archivada=true). Se visualizan
// normalmente y al hacer clic abren el panel de detalle (onOpenOrder).
export default function HistorialEstablecimiento({ open, onOpenChange, onOpenOrder }) {
  const [tab, setTab] = useState('establecimiento');
  const [search, setSearch] = useState('');
  const [selectedEstab, setSelectedEstab] = useState('');
  const [selectedJefe, setSelectedJefe] = useState('');
  const { resolveCreator } = useResolveCreator();

  // Historial por establecimiento (todas las OTs).
  const { data: orders = [] } = useQuery({
    queryKey: ['workorders-all'],
    queryFn: () => base44.entities.WorkOrder.list('-created_date', 900),
    enabled: open && tab === 'establecimiento',
  });

  // Historial de archivadas (archivada=true). Respeta RLS — cada sector ve
  // las suyas. Ordenadas por fecha_archivado descendente.
  const { data: archivadas = [] } = useQuery({
    queryKey: ['workorders-archivadas'],
    queryFn: () => base44.entities.WorkOrder.filter({ archivada: true }, '-fecha_archivado', 900),
    enabled: open && tab === 'archivadas',
  });

  const establecimientos = useMemo(() => {
    const set = new Set();
    orders.forEach(o => { if (o.location) set.add(o.location); });
    return [...set].sort();
  }, [orders]);

  // Jefes de sitio únicos presentes en las OTs archivadas — para el dropdown de
  // filtro. Se arma desde las archivadas cargadas (no de Employees) para no
  // listar jefes que no tienen nada archivado.
  const jefes = useMemo(() => {
    const set = new Set();
    archivadas.forEach(o => { if (o.jefe_sitio) set.add(o.jefe_sitio); });
    return [...set].sort();
  }, [archivadas]);

  const filtered = useMemo(() => {
    if (tab === 'archivadas') {
      // Normalización NFD + strip acentos: "sophia" matchea "Sofía Aguilera"
      // aunque el usuario escriba sin acentos/mayúsculas. Incluye jefe_sitio,
      // jefe_sitio_email y el creador (resuelto a nombre) — antes el 82% de
      // las OTs de escuela con assigned_name vacío no se encontraban.
      const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const q = norm(search);
      return archivadas.filter(o => {
        const matchJefe = !selectedJefe || o.jefe_sitio === selectedJefe;
        const creador = resolveCreator(o.created_by_id, '');
        const matchSearch = !q ||
          norm(o.title).includes(q) ||
          norm(o.location).includes(q) ||
          norm(o.assigned_name).includes(q) ||
          norm(o.jefe_sitio).includes(q) ||
          norm(o.jefe_sitio_email).includes(q) ||
          norm(creador).includes(q);
        return matchJefe && matchSearch;
      });
    }
    return orders.filter(o => {
      const matchSearch = !search || o.title?.toLowerCase().includes(search.toLowerCase()) || o.location?.toLowerCase().includes(search.toLowerCase());
      const matchEstab = !selectedEstab || o.location === selectedEstab;
      return matchSearch && matchEstab;
    });
  }, [orders, archivadas, search, selectedEstab, tab]);

  const stats = useMemo(() => {
    if (tab === 'archivadas') {
      return { total: archivadas.length, completadas: archivadas.length, pendientes: 0 };
    }
    const base = selectedEstab ? orders.filter(o => o.location === selectedEstab) : orders;
    return {
      total: base.length,
      completadas: base.filter(o => o.status === 'completada').length,
      pendientes: base.filter(o => o.status === 'pendiente').length,
    };
  }, [orders, archivadas, selectedEstab, tab]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" /> Historial
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 flex-shrink-0">
          <button
            onClick={() => setTab('establecimiento')}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium transition-all ${tab === 'establecimiento' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <History className="h-3.5 w-3.5" /> Por Establecimiento
          </button>
          <button
            onClick={() => setTab('archivadas')}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium transition-all ${tab === 'archivadas' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Archive className="h-3.5 w-3.5" /> Archivadas
            {archivadas.length > 0 && (
              <Badge className="text-[10px] h-4 px-1.5">{archivadas.length}</Badge>
            )}
          </button>
        </div>

        <div className="space-y-3 flex-shrink-0">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total', value: stats.total, icon: tab === 'archivadas' ? Archive : History, color: 'text-primary' },
              { label: 'Completadas', value: stats.completadas, icon: CheckCircle2, color: 'text-emerald-600' },
              { label: 'Pendientes', value: stats.pendientes, icon: tab === 'archivadas' ? FileClock : Clock, color: 'text-amber-600' },
            ].map((s, i) => (
              <div key={i} className="rounded-lg border bg-card p-3 text-center">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            {tab === 'establecimiento' && (
              <Select value={selectedEstab} onValueChange={setSelectedEstab}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Todos los establecimientos..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Todos</SelectItem>
                  {establecimientos.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {tab === 'archivadas' && (
              <Select value={selectedJefe || null} onValueChange={(v) => setSelectedJefe(v || '')}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Todos los jefes..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Todos</SelectItem>
                  {jefes.map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={tab === 'archivadas' ? "Buscar archivadas..." : "Buscar..."} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 mt-1">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              {tab === 'archivadas'
                ? 'Sin OTs archivadas. Las OTs completadas se archivan automáticamente a los 30 días.'
                : 'Sin órdenes para mostrar'}
            </p>
          ) : (
            filtered.map(o => (
              <div
                key={o.id}
                className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/30 transition-colors cursor-pointer"
                onClick={() => onOpenOrder && onOpenOrder(o)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold truncate">{o.title}</p>
                    <Badge className={`text-[10px] ${statusColors[o.status] || 'bg-gray-100 text-gray-600'}`}>
                      {o.status?.replace(/_/g, ' ')}
                    </Badge>
                    {tab === 'archivadas' && (
                      <Badge className="text-[10px] bg-slate-200 text-slate-600 flex items-center gap-1">
                        <Archive className="h-3 w-3" /> Archivada
                      </Badge>
                    )}
                    {o.priority === 'urgente' && <Badge className="text-[10px] bg-red-100 text-red-700">Urgente</Badge>}
                  </div>
                  <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    {o.location && <span>📍 {o.location}</span>}
                    {o.assigned_name && <span>👤 {o.assigned_name}</span>}
                    {tab === 'archivadas' && o.jefe_sitio && <span>🧑‍💼 {o.jefe_sitio}</span>}
                    {tab === 'archivadas' && (() => { const c = resolveCreator(o.created_by_id, ''); return c ? <span>✍️ {c}</span> : null; })()}
                    {o.created_date && <span>📅 {format(parseISO(o.created_date), "dd/MM/yyyy", { locale: es })}</span>}
                    {o.completed_date && <span className="text-emerald-600">✅ {format(parseISO(o.completed_date), "dd/MM/yyyy", { locale: es })}</span>}
                    {tab === 'archivadas' && o.fecha_archivado && (
                      <span className="text-slate-500">🗄️ {format(parseISO(o.fecha_archivado), "dd/MM/yyyy", { locale: es })}</span>
                    )}
                  </div>
                  {o.description && <p className="text-xs text-muted-foreground mt-1 truncate">{o.description}</p>}
                </div>
              </div>
            ))
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center flex-shrink-0">{filtered.length} órdenes</p>
      </DialogContent>
    </Dialog>
  );
}