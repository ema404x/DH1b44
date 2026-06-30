import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Search, Plus, ClipboardList, MapPin,
  Zap, Wrench, TrendingUp,
  Layers, History, Smartphone, LayoutGrid, Kanban, User
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import KanbanBoard from '@/components/workorders/KanbanBoard';
import WorkOrderQRButton from '@/components/workorders/WorkOrderQRButton';
import QRCodeModal from '@/components/shared/QRCodeModal';
import { exportOTsPDF } from '@/utils/exportPDF';
import { format, isPast, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import EmptyState from '@/components/shared/EmptyState';
import WorkOrderDetailPanel from '@/components/workorders/WorkOrderDetailPanel';
import OTTemplateSelector from '@/components/workorders/OTTemplateSelector';
import HistorialEstablecimiento from '@/components/workorders/HistorialEstablecimiento';
import ModoCampo from '@/components/workorders/ModosCampo';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { usePermission } from '@/hooks/usePermission';
import { getTransitionAction } from '@/lib/workorder-transitions';




function WorkOrderCard({ order, onOpen, onShowQR }) {
  const isOverdue = (() => { try { return order.scheduled_date && isPast(parseISO(order.scheduled_date)) && !['completada','cancelada'].includes(order.status); } catch { return false; } })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group relative bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur border rounded-lg p-4 cursor-pointer transition-all hover:-translate-y-1 ${isOverdue ? 'border-red-500/30 bg-red-500/5' : 'border-slate-700/50'}`}
      onClick={() => onOpen(order)}
    >
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
        <WorkOrderQRButton order={order} onShowQR={onShowQR} />
      </div>

      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center flex-shrink-0">
          <Wrench className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white">{order.title}</h3>
          <div className="flex items-center gap-2 mt-2 flex-wrap text-xs text-slate-400">
            {order.asset_name && <span className="flex items-center gap-1"><Zap className="h-3 w-3" />{order.asset_name}</span>}
            {order.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{order.location}</span>}
            {order.assigned_name && <span className="flex items-center gap-1"><User className="h-3 w-3" />{order.assigned_name}</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-700/50">
        <Badge className="text-xs bg-slate-700 text-slate-200">{order.status}</Badge>
        <Badge variant="secondary" className="text-xs">{order.priority}</Badge>
        {isOverdue && <Badge className="bg-red-500/20 text-red-300 text-xs">VENCIDA</Badge>}
      </div>
    </motion.div>
  );
}

export default function WorkOrders() {
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState('all');
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'grid'
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [qrOrder, setQrOrder] = useState(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [historialOpen, setHistorialOpen] = useState(false);
  const [modoCampo, setModoCampo] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { currentUser, isAdmin, filterByUser } = useCurrentUser();
  const { allowed: canCreate } = usePermission('WorkOrder', 'create');
  const { allowed: canDelete } = usePermission('WorkOrder', 'delete');

  const { isOnline, pendingCount } = useOfflineQueue((count) => {
    toast.success(`${count} OT${count !== 1 ? 's' : ''} sincronizada${count !== 1 ? 's' : ''}`);
    queryClient.invalidateQueries({ queryKey: ['workorders'] });
  });

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['workorders'],
    queryFn: () => base44.entities.WorkOrder.list('-created_date', 500)
  });

  const createMutation = useMutation({
    mutationFn: async (data) => base44.entities.WorkOrder.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workorders'] });
      queryClient.invalidateQueries({ queryKey: ['workorders-campo'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.WorkOrder.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['workorders'] }); setSelectedOrder(null); }
  });

  const handleStatusChange = async (id, newStatus) => {
    const order = visibleOrders.find(o => o.id === id);
    if (!order) return;
    const action = getTransitionAction(order.status, newStatus);
    if (!action) {
      toast.error(`Transición no válida: "${order.status}" → "${newStatus}"`);
      queryClient.invalidateQueries({ queryKey: ['workorders'] });
      return;
    }
    try {
      const res = await base44.functions.invoke('transicionEstadoOT', { ot_id: id, accion: action });
      toast.success(res.data.mensaje);
      queryClient.invalidateQueries({ queryKey: ['workorders'] });
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Error al cambiar el estado';
      toast.error(msg);
      queryClient.invalidateQueries({ queryKey: ['workorders'] });
    }
  };

  const visibleOrders = useMemo(() =>
    filterByUser(orders, ['assigned_name', 'assigned_to', 'created_by'])
  , [orders, filterByUser]);

  const filtered = useMemo(() => visibleOrders.filter(o => {
    const q = search.toLowerCase();
    const matchSearch = !q || 
      o.title?.toLowerCase().includes(q) ||
      o.location?.toLowerCase().includes(q) ||
      o.location_qr_name?.toLowerCase().includes(q) ||
      o.project_name?.toLowerCase().includes(q) ||
      o.asset_name?.toLowerCase().includes(q) ||
      o.assigned_name?.toLowerCase().includes(q) ||
      o.code?.toLowerCase().includes(q);
    const matchStatus = statusTab === 'all' || o.status === statusTab;
    return matchSearch && matchStatus;
  }), [visibleOrders, search, statusTab]);

  const stats = useMemo(() => ({
    total: visibleOrders.length,
    pendientes: visibleOrders.filter(o => o.status === 'pendiente').length,
    en_progreso: visibleOrders.filter(o => o.status === 'en_progreso').length,
    completadas: visibleOrders.filter(o => o.status === 'completada').length,
  }), [visibleOrders]);

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: Math.min(0.05, 2 / Math.max(filtered.length, 1)) } }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 space-y-6">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl opacity-20 animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shrink-0">
              <ClipboardList className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-3xl font-bold text-white truncate">Órdenes de Trabajo</h1>
              <p className="text-slate-400 text-xs sm:text-sm">{stats.total} órdenes en total {!isOnline && '• Offline'}</p>
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
          {/* Toggle Kanban / Grilla */}
          <div className="flex items-center bg-slate-800/50 border border-slate-700/50 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'kanban' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <Kanban className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'grid' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Grilla</span>
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setModoCampo(v => !v)} className={`gap-1 border-slate-700 text-slate-300 hover:text-white text-xs px-2 ${modoCampo ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300' : ''}`}>
            <Smartphone className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{modoCampo ? 'Escritorio' : 'Campo'}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setHistorialOpen(true)} className="gap-1 border-slate-700 text-slate-300 hover:text-white text-xs px-2">
            <History className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Historial</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setTemplateOpen(true)} className="gap-1 border-slate-700 text-slate-300 hover:text-white text-xs px-2">
            <Layers className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Plantillas</span>
          </Button>
          {canCreate && (
            <Link to="/crear-ot">
              <Button size="sm" className="gap-1 bg-gradient-to-r from-purple-500 to-pink-600 hover:shadow-lg shadow-purple-500/50 transition-all text-xs px-2">
                <Plus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Nueva OT</span><span className="sm:hidden">Nueva</span>
              </Button>
            </Link>
          )}
          </div>
        </div>

        {/* Stats */}
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Pendientes', value: stats.pendientes, color: 'from-yellow-500' },
            { label: 'En Progreso', value: stats.en_progreso, color: 'from-purple-500' },
            { label: 'Completadas', value: stats.completadas, color: 'from-emerald-500' },
          ].map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur border border-slate-700/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-slate-400 uppercase">{stat.label}</p>
                  <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${stat.color} to-transparent flex items-center justify-center`}>
                    <TrendingUp className="h-4 w-4 text-white" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      {/* Modo Campo */}
      {modoCampo && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur border border-slate-700/50 rounded-xl p-5">
          <ModoCampo currentUser={currentUser} onOpenOrder={setSelectedOrder} />
        </motion.div>
      )}

      {/* Search (solo en vista grilla) */}
      {!modoCampo && viewMode === 'grid' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Buscar por establecimiento, ubicación, título..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500"
            />
          </div>
          <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg p-1 border border-slate-700/50">
            {['all', 'pendiente', 'en_progreso', 'completada'].map(tab => (
              <button
                key={tab}
                onClick={() => setStatusTab(tab)}
                className={`text-xs px-3 py-1.5 rounded font-medium transition-all ${statusTab === tab ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
              >
                {tab === 'all' ? 'Todas' : tab.replace('_', ' ')}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Kanban */}
      {!modoCampo && viewMode === 'kanban' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {visibleOrders.length === 0 && !isLoading ? (
            <EmptyState icon={ClipboardList} title="No hay órdenes" description="Creá una nueva orden de trabajo" actionLabel="Nueva OT" onAction={() => navigate('/crear-ot')} />
          ) : (
            <KanbanBoard
              orders={visibleOrders}
              onOpen={setSelectedOrder}
              onShowQR={setQrOrder}
              onStatusChange={handleStatusChange}
            />
          )}
        </motion.div>
      )}

      {/* Grid */}
      {!modoCampo && viewMode === 'grid' && (filtered.length === 0 && !isLoading ? (
        <EmptyState icon={ClipboardList} title="No hay órdenes" description="Creá una nueva orden de trabajo" actionLabel="Nueva OT" onAction={() => navigate('/crear-ot')} />
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(order => (
            <WorkOrderCard key={order.id} order={order} onOpen={setSelectedOrder} onShowQR={setQrOrder} />
          ))}
        </motion.div>
      ))}

      <OTTemplateSelector
        open={templateOpen}
        onOpenChange={setTemplateOpen}
        onSelect={(template) => {
          createMutation.mutate({
            title: template.title,
            type: template.type,
            priority: template.priority,
            description: template.description,
            estimated_hours: template.estimated_hours,
            checklist: (template.checklist || []).map(t => ({ ...t, completed: false })),
            status: 'pendiente',
          });
          setTemplateOpen(false);
        }}
      />

      <HistorialEstablecimiento open={historialOpen} onOpenChange={setHistorialOpen} />

      {selectedOrder && (() => {
        // Siempre pasar el objeto más fresco del cache — si la query se actualizó, el panel lo recibe
        const freshOrder = orders.find(o => o.id === selectedOrder.id) || selectedOrder;
        return (
          <WorkOrderDetailPanel
            order={freshOrder}
            onClose={() => setSelectedOrder(null)}
            onDelete={canDelete ? deleteMutation.mutate : undefined}
          />
        );
      })()}

      {qrOrder && (
        <QRCodeModal
          open={true}
          onClose={() => setQrOrder(null)}
          title={qrOrder.title}
          subtitle={qrOrder.location || `OT ${qrOrder.code || ''}`}
          value={qrOrder.location_qr_id
            ? `${window.location.origin}/portal-operario?loc=${qrOrder.location_qr_id}`
            : `${window.location.origin}/ejecutar-ot-simple?ot=${qrOrder.id}`
          }
        />
      )}
    </div>
  );
}