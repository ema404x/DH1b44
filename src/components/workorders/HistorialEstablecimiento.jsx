import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { History, Search, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const statusColors = {
  pendiente: 'bg-yellow-100 text-yellow-700',
  asignada: 'bg-blue-100 text-blue-700',
  en_progreso: 'bg-purple-100 text-purple-700',
  completada: 'bg-emerald-100 text-emerald-700',
  cancelada: 'bg-gray-100 text-gray-500',
};

export default function HistorialEstablecimiento({ open, onOpenChange }) {
  const [search, setSearch] = useState('');
  const [selectedEstab, setSelectedEstab] = useState('');

  const { data: orders = [] } = useQuery({
    queryKey: ['workorders-all'],
    queryFn: () => base44.entities.WorkOrder.list('-created_date', 500),
    enabled: open,
  });

  const establecimientos = useMemo(() => {
    const set = new Set();
    orders.forEach(o => { if (o.location) set.add(o.location); });
    return [...set].sort();
  }, [orders]);

  const filtered = useMemo(() => {
    return orders.filter(o => {
      const matchSearch = !search || o.title?.toLowerCase().includes(search.toLowerCase()) || o.location?.toLowerCase().includes(search.toLowerCase());
      const matchEstab = !selectedEstab || o.location === selectedEstab;
      return matchSearch && matchEstab;
    });
  }, [orders, search, selectedEstab]);

  const stats = useMemo(() => {
    const base = selectedEstab ? orders.filter(o => o.location === selectedEstab) : orders;
    return {
      total: base.length,
      completadas: base.filter(o => o.status === 'completada').length,
      pendientes: base.filter(o => o.status === 'pendiente').length,
    };
  }, [orders, selectedEstab]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" /> Historial por Establecimiento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 flex-shrink-0">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total', value: stats.total, icon: History, color: 'text-primary' },
              { label: 'Completadas', value: stats.completadas, icon: CheckCircle2, color: 'text-emerald-600' },
              { label: 'Pendientes', value: stats.pendientes, icon: Clock, color: 'text-amber-600' },
            ].map((s, i) => (
              <div key={i} className="rounded-lg border bg-card p-3 text-center">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Select value={selectedEstab} onValueChange={setSelectedEstab}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Todos los establecimientos..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Todos</SelectItem>
                {establecimientos.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 mt-1">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Sin órdenes para mostrar</p>
          ) : (
            filtered.map(o => (
              <div key={o.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold truncate">{o.title}</p>
                    <Badge className={`text-[10px] ${statusColors[o.status] || 'bg-gray-100 text-gray-600'}`}>
                      {o.status?.replace(/_/g, ' ')}
                    </Badge>
                    {o.priority === 'urgente' && <Badge className="text-[10px] bg-red-100 text-red-700">Urgente</Badge>}
                  </div>
                  <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    {o.location && <span>📍 {o.location}</span>}
                    {o.assigned_name && <span>👤 {o.assigned_name}</span>}
                    {o.created_date && <span>📅 {format(parseISO(o.created_date), "dd/MM/yyyy", { locale: es })}</span>}
                    {o.completed_date && <span className="text-emerald-600">✅ {format(parseISO(o.completed_date), "dd/MM/yyyy", { locale: es })}</span>}
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