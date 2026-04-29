import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion } from 'framer-motion';
import { Search, Plus, ShoppingCart, AlertTriangle, Clock, Package, Calendar } from 'lucide-react';
import RequerimientoForm from './RequerimientoForm';
import RequerimientoDetalle from './RequerimientoDetalle';
import EmptyState from '@/components/shared/EmptyState';
import { format } from 'date-fns';

const ESTADOS = [
  { value: 'borrador', label: 'Borrador', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  { value: 'enviado', label: 'Enviado', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { value: 'en_revision', label: 'En Revisión', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  { value: 'aprobado', label: 'Aprobado', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  { value: 'en_compra', label: 'En Compra', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  { value: 'recibido', label: 'Recibido ✓', color: 'bg-green-500/20 text-green-300 border-green-500/30' },
  { value: 'rechazado', label: 'Rechazado', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
];

const PRIORIDAD_COLORS = {
  baja: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  normal: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  alta: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  urgente: 'bg-red-500/20 text-red-300 border-red-500/30',
};

export default function RequerimientosList({ user }) {
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState(null);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const { data: requerimientos = [], isLoading } = useQuery({
    queryKey: ['requerimientos'],
    queryFn: () => base44.entities.RequerimientoCompra.list('-created_date'),
  });

  const stats = useMemo(() => ({
    pendientes: requerimientos.filter(r => ['enviado', 'en_revision'].includes(r.estado)).length,
    enCompra: requerimientos.filter(r => r.estado === 'en_compra').length,
    conAlerta: requerimientos.filter(r => r.historial?.some(h => h.tiene_alerta)).length,
  }), [requerimientos]);

  const filtered = requerimientos.filter(r => {
    const matchSearch = !search ||
      r.titulo?.toLowerCase().includes(search.toLowerCase()) ||
      r.jefe_sitio?.toLowerCase().includes(search.toLowerCase()) ||
      r.numero?.toLowerCase().includes(search.toLowerCase());
    const matchEstado = estadoFilter === 'all' || r.estado === estadoFilter;
    return matchSearch && matchEstado;
  });

  const handleSave = async (data) => {
    setSaving(true);
    const numero = `REQ-${String(requerimientos.length + 1).padStart(3, '0')}`;
    const historialInicial = [{
      fecha: new Date().toISOString(),
      estado: 'enviado',
      usuario: user?.full_name || user?.email || 'Sistema',
      observacion: 'Requerimiento creado y enviado al sector de compras',
      tiene_alerta: false,
    }];
    await base44.entities.RequerimientoCompra.create({
      ...data,
      numero,
      estado: 'enviado',
      historial: historialInicial,
    });
    queryClient.invalidateQueries({ queryKey: ['requerimientos'] });
    setSaving(false);
    setFormOpen(false);
  };

  const hasAlerta = (req) => req.historial?.slice(-1)[0]?.tiene_alerta;

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pendientes', value: stats.pendientes, color: 'from-blue-500', icon: Clock },
          { label: 'En Compra', value: stats.enCompra, color: 'from-purple-500', icon: ShoppingCart },
          { label: 'Con Alerta', value: stats.conAlerta, color: 'from-amber-500', icon: AlertTriangle },
        ].map((s, i) => (
          <div key={i} className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 flex items-center gap-3">
            <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${s.color} to-transparent flex items-center justify-center flex-shrink-0`}>
              <s.icon className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-slate-400">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por título, jefe de sitio, número..."
            className="pl-9 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500" />
        </div>
        <Select value={estadoFilter} onValueChange={setEstadoFilter}>
          <SelectTrigger className="w-full sm:w-44 bg-slate-800/50 border-slate-700/50 text-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {ESTADOS.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => setFormOpen(true)} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white flex-shrink-0">
          <Plus className="h-4 w-4" /> Nuevo Requerimiento
        </Button>
      </div>

      {/* List */}
      {filtered.length === 0 && !isLoading ? (
        <EmptyState icon={ShoppingCart} title="Sin requerimientos" description="Los jefes de sitio pueden solicitar materiales al sector de compras" actionLabel="Nuevo Requerimiento" onAction={() => setFormOpen(true)} />
      ) : (
        <div className="space-y-3">
          {filtered.map((req, i) => {
            const estadoInfo = ESTADOS.find(e => e.value === req.estado);
            const ultimaObs = req.historial?.slice(-1)[0];
            const tieneAlerta = ultimaObs?.tiene_alerta;
            return (
              <motion.div key={req.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <button onClick={() => setSelectedReq(req)}
                  className={`w-full text-left p-4 rounded-xl border backdrop-blur transition-all hover:scale-[1.01] ${
                    tieneAlerta
                      ? 'border-amber-500/40 bg-amber-950/20 hover:border-amber-400/60'
                      : 'border-slate-700/50 bg-slate-800/40 hover:border-slate-600/70'
                  }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {tieneAlerta && <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />}
                        <p className="font-semibold text-white truncate">{req.titulo}</p>
                        <span className="text-xs text-slate-500 font-mono">{req.numero}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-xs text-slate-400">👤 {req.jefe_sitio}</span>
                        {req.establecimiento && <span className="text-xs text-slate-400">🏫 {req.establecimiento}</span>}
                        {req.fecha_necesidad && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> {req.fecha_necesidad}
                          </span>
                        )}
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Package className="h-3 w-3" /> {(req.items || []).length} ítem{(req.items || []).length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {ultimaObs?.observacion && (
                        <p className="text-xs text-slate-400 mt-1.5 truncate">💬 {ultimaObs.observacion}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <Badge className={`border text-xs ${estadoInfo?.color}`}>{estadoInfo?.label}</Badge>
                      <Badge className={`border text-xs ${PRIORIDAD_COLORS[req.prioridad]}`}>{req.prioridad}</Badge>
                      {req.total_estimado > 0 && (
                        <p className="text-xs text-slate-300 font-semibold">${req.total_estimado?.toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                </button>
              </motion.div>
            );
          })}
        </div>
      )}

      <RequerimientoForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSave={handleSave}
        saving={saving}
        user={user}
      />

      {selectedReq && (
        <RequerimientoDetalle
          req={requerimientos.find(r => r.id === selectedReq.id) || selectedReq}
          onClose={() => setSelectedReq(null)}
          user={user}
        />
      )}
    </div>
  );
}