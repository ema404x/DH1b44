import React, { useState, useMemo, useCallback } from 'react';
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
  Layers, History, Smartphone, LayoutGrid, Kanban, User, SlidersHorizontal, CheckCircle2
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import KanbanBoard from '@/components/workorders/KanbanBoard';
import WorkOrderCard from '@/components/workorders/WorkOrderCard';
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
import PullToRefresh from '@/components/shared/PullToRefresh';
import { usePermission } from '@/hooks/usePermission';
import { getTransitionAction } from '@/lib/workorder-transitions';
import AdvancedFilters from '@/components/workorders/AdvancedFilters';
import { useResolveCreator } from '@/hooks/useResolveCreator';
import { isJefeSitioRole } from '@/lib/roles';
import { esOtVencida } from '@/lib/otVencimiento';




const STATUS_LABELS = {
  pendiente: 'Pendiente',
  asignada: 'Asignada',
  en_progreso: 'En Progreso',
  obra: 'Obra',
  pendiente_validacion: 'Validación',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

export default function WorkOrders() {
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState('all');
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'grid'
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [qrOrder, setQrOrder] = useState(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [historialOpen, setHistorialOpen] = useState(false);
  const [modoCampo, setModoCampo] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advFilters, setAdvFilters] = useState({
    priority: '', type: '', assigned_to: '', jefe_sitio: '',
    date_from: '', date_to: '', overdue_only: false,
  });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { currentUser, isAdmin, isSuperAdmin, employeeRole } = useCurrentUser();
  const isGerente = isAdmin || currentUser?.role === 'gerente';
  const isJefeSitio = isJefeSitioRole(employeeRole);
  const canCompleteOT = isGerente || isJefeSitio;

  // Estabilizadas con useCallback para que las cards memoizadas (React.memo)
  // no se re-rendericen cuando cambia una referencia de callback. queryClient
  // es estable → estas funciones son estables de por vida del componente.
  const handleComplete = useCallback(async (id) => {
    try {
      const res = await base44.functions.invoke('transicionEstadoOT', { ot_id: id, accion: 'completar' });
      toast.success(res.data.mensaje || 'OT completada');
      queryClient.invalidateQueries({ queryKey: ['workorders'] });
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Error al completar la OT';
      toast.error(msg);
    }
  }, [queryClient]);

  const handleStart = useCallback(async (id) => {
    try {
      const res = await base44.functions.invoke('transicionEstadoOT', { ot_id: id, accion: 'iniciar' });
      toast.success(res.data.mensaje || 'OT iniciada');
      queryClient.invalidateQueries({ queryKey: ['workorders'] });
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Error al iniciar la OT';
      toast.error(msg);
    }
  }, [queryClient]);
  const { allowed: canCreate } = usePermission('WorkOrder', 'create');
  const { allowed: canDelete } = usePermission('WorkOrder', 'delete');
  const { resolveCreator } = useResolveCreator();

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['workorders'] });
  };

  const { isOnline, pendingCount } = useOfflineQueue((count) => {
    toast.success(`${count} OT${count !== 1 ? 's' : ''} sincronizada${count !== 1 ? 's' : ''}`);
    queryClient.invalidateQueries({ queryKey: ['workorders'] });
  });

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['workorders'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getWorkOrdersForUser', {});
      return res.data.orders || [];
    },
    // Esta lista es la fuente del total visible — forzar datos frescos al montar
    // y al volver a la pestaña, sin servir cache stale (evita totales desactualizados).
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Direcciones — fuente canónica de jefes de sitio.
  // Se usa para resolver el jefe_sitio de OTs que no lo tienen poblado,
  // cruzando la dirección de la OT contra la dirección de la Direccion.
  const { data: direcciones = [] } = useQuery({
    queryKey: ['direcciones-jefes'],
    queryFn: () => base44.entities.Direccion.list('-created_date', 500),
    staleTime: 5 * 60 * 1000,
  });

  // Empleados — para resolver email y user_id al filtrar por jefe_sitio u operario
  const { data: employees = [] } = useQuery({
    queryKey: ['employees-filter-lookup'],
    queryFn: () => base44.entities.Employee.list('-updated_date', 500),
    staleTime: 5 * 60 * 1000,
  });

  // Lookup: nombre normalizado → { email, user_id }
  const employeeLookup = useMemo(() => {
    const map = {};
    const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ');
    employees.forEach(e => {
      if (e.full_name) {
        map[norm(e.full_name)] = { email: (e.email || '').toLowerCase().trim(), user_id: e.user_id || '' };
      }
    });
    return { map, norm };
  }, [employees]);

  // Mapa normalizado: dirección → jefe_sitio
  const addrToJefe = useMemo(() => {
    const map = {};
    const norm = (s) => (s || '').toUpperCase().trim().replace(/\s+/g, ' ').replace(/,\s*CABA\s*$/, '').replace(/,\s*$/, '').trim();
    direcciones.forEach(d => {
      if (d.direccion && d.jefe_sitio) {
        map[norm(d.direccion)] = d.jefe_sitio.trim();
      }
    });
    return { map, norm };
  }, [direcciones]);

  // Resuelve el jefe_sitio de una OT: directo si lo tiene, sino por cruce de dirección.
  const resolveJefe = useMemo(() => (o) => {
    if (o.jefe_sitio) return o.jefe_sitio;
    const { map, norm } = addrToJefe;
    const locNorm = norm(o.location);
    if (!locNorm) return null;
    // Match exacto tras normalización
    if (map[locNorm]) return map[locNorm];
    // Match por contenido — solo para ubicaciones con longitud razonable (≥10 chars)
    // para evitar falsos positivos como "SUM" matcheando cualquier dirección que contenga "SUM"
    if (locNorm.length >= 10) {
      for (const addr of Object.keys(map)) {
        if (addr.length >= 10 && (locNorm.includes(addr) || addr.includes(locNorm))) return map[addr];
      }
    }
    return null;
  }, [addrToJefe]);

  const createMutation = useMutation({
    mutationFn: async (data) => base44.entities.WorkOrder.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workorders'] });
      queryClient.invalidateQueries({ queryKey: ['workorders-campo'] });
    },
  });

  // Delete ruteado por función backend (eliminarOT): el SDK directo fallaba con
  // 403 cuando user.data.sector_id quedaba desfasado. La función valida sector con
  // la ficha de Empleado como fuente canónica y usa asServiceRole.
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await base44.functions.invoke('eliminarOT', { ot_id: id });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workorders'] });
      setSelectedOrder(null);
      toast.success('OT eliminada correctamente');
    },
    onError: (err) => {
      toast.error(err.message || 'Error al eliminar la OT');
    },
  });

  const handleStatusChange = async (id, newStatus) => {
    const order = visibleOrders.find(o => o.id === id);
    if (!order || order.status === newStatus) return;
    const action = getTransitionAction(order.status, newStatus);
    if (!action) {
      toast.error('Esa transición de estado no está permitida');
      queryClient.invalidateQueries({ queryKey: ['workorders'] });
      return;
    }
    try {
      // Toda transición de estado pasa por la máquina (transicionEstadoOT) —
      // preserva permisos, validaciones y efectos secundarios (GPS, fechas, validador).
      const res = await base44.functions.invoke('transicionEstadoOT', { ot_id: id, accion: action });
      toast.success(res.data.mensaje);
      queryClient.invalidateQueries({ queryKey: ['workorders'] });
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Error al cambiar el estado';
      toast.error(msg);
      queryClient.invalidateQueries({ queryKey: ['workorders'] });
    }
  };

  // Las OTs ya vienen filtradas por la función backend getWorkOrdersForUser
  // (única fuente de verdad — no se re-filtra en el frontend)
  const visibleOrders = orders;

  // Pre-normaliza los campos buscables UNA vez por cambio de visibleOrders (no por
  // cada tecla). NFD + strip de acentos sobre los campos de texto era el costo hot
  // del filtro en cada keystroke de búsqueda.
  const searchableOrders = useMemo(() => {
    const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return visibleOrders.map(o => ({
      o,
      fields: [
        norm(o.title), norm(o.location), norm(o.location_qr_name), norm(o.project_name),
        norm(o.asset_name), norm(o.assigned_name), norm(o.code), norm(o.jefe_sitio),
      ],
    }));
  }, [visibleOrders]);

  const filtered = useMemo(() => {
    const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const q = norm(search);
    return searchableOrders.filter(({ o, fields }) => {
      const creador = norm(resolveCreator(o.created_by_id, ''));
    const matchSearch = !q || 
      fields.some(f => f.includes(q)) ||
      creador.includes(q);
    const matchStatus = statusTab === 'all' || o.status === statusTab;

    // Filtros avanzados (gerentes/admin)
    const matchPriority = !advFilters.priority || o.priority === advFilters.priority;
    const matchType = !advFilters.type || o.type === advFilters.type;
    const normCI = (s) => (s || '').trim().replace(/\s+/g, ' ').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Operario: verifica assigned_name y assigned_to (puede ser email)
    const { map: empMap, norm: normEmp } = employeeLookup;
    const matchOperario = !advFilters.assigned_to || (() => {
      const filterVal = normCI(advFilters.assigned_to);
      if (normCI(o.assigned_name) === filterVal) return true;
      if (normCI(o.assigned_to) === filterVal) return true;
      // Si assigned_to es un email, matchear contra el email del empleado seleccionado
      const empInfo = empMap[normEmp(advFilters.assigned_to)];
      if (empInfo?.email && (o.assigned_to || '').toLowerCase().trim() === empInfo.email) return true;
      return false;
    })();

    // Jefe de sitio: verifica jefe_sitio, jefe_sitio_email, created_by_id, y resolveJefe
    const selectedJefeInfo = advFilters.jefe_sitio ? empMap[normEmp(advFilters.jefe_sitio)] : null;
    const matchJefe = !advFilters.jefe_sitio || (() => {
      const filterVal = normCI(advFilters.jefe_sitio);
      // 1. jefe_sitio directo (name match)
      if (o.jefe_sitio && normCI(o.jefe_sitio) === filterVal) return true;
      // 2. jefe_sitio_email match contra el email del jefe seleccionado
      if (selectedJefeInfo?.email && (o.jefe_sitio_email || '').toLowerCase().trim() === selectedJefeInfo.email) return true;
      // 3. created_by_id match contra el user_id del jefe seleccionado
      if (selectedJefeInfo?.user_id && o.created_by_id === selectedJefeInfo.user_id) return true;
      // 4. resolveJefe como fallback
      const resolved = resolveJefe(o);
      if (resolved && normCI(resolved) === filterVal) return true;
      return false;
    })();
    const matchDateFrom = !advFilters.date_from || (o.scheduled_date && o.scheduled_date >= advFilters.date_from);
    const matchDateTo = !advFilters.date_to || (o.scheduled_date && o.scheduled_date <= advFilters.date_to);
    const matchOverdue = !advFilters.overdue_only || esOtVencida(o);

    return matchSearch && matchStatus && matchPriority && matchType && matchOperario && matchJefe && matchDateFrom && matchDateTo && matchOverdue;
    }).map(({ o }) => o);
  }, [searchableOrders, search, statusTab, advFilters, resolveJefe, resolveCreator]);

  const stats = useMemo(() => ({
    total: filtered.length,
    pendientes: filtered.filter(o => o.status === 'pendiente').length,
    asignadas: filtered.filter(o => o.status === 'asignada').length,
    en_progreso: filtered.filter(o => o.status === 'en_progreso').length,
    validacion: filtered.filter(o => o.status === 'pendiente_validacion').length,
    obra: filtered.filter(o => o.status === 'obra').length,
    completadas: filtered.filter(o => o.status === 'completada').length,
    canceladas: filtered.filter(o => o.status === 'cancelada').length,
  }), [filtered]);

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: Math.min(0.05, 2 / Math.max(filtered.length, 1)) } }
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
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
          {isGerente && (
            <Button variant="outline" size="sm" onClick={() => setShowAdvanced(v => !v)} className={`gap-1 text-xs px-2 ${showAdvanced ? 'bg-primary/20 border-primary/50 text-primary' : 'border-slate-700 text-slate-300 hover:text-white'}`}>
              <SlidersHorizontal className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Filtros</span>
            </Button>
          )}
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
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-8 gap-3">
          {[
            { label: 'Total', value: stats.total, color: 'from-slate-400' },
            { label: 'Pendientes', value: stats.pendientes, color: 'from-yellow-500' },
            { label: 'Asignadas', value: stats.asignadas, color: 'from-blue-500' },
            { label: 'En Progreso', value: stats.en_progreso, color: 'from-purple-500' },
            { label: 'Validación', value: stats.validacion, color: 'from-amber-400' },
            { label: 'Obra', value: stats.obra, color: 'from-pink-400' },
            { label: 'Completadas', value: stats.completadas, color: 'from-emerald-500' },
            { label: 'Canceladas', value: stats.canceladas, color: 'from-red-500' },
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

      {/* Filtros Avanzados (gerentes) */}
      {isGerente && showAdvanced && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <AdvancedFilters
            filters={advFilters}
            onChange={setAdvFilters}
            onReset={() => setAdvFilters({ priority: '', type: '', assigned_to: '', jefe_sitio: '', date_from: '', date_to: '', overdue_only: false })}
            orders={visibleOrders}
            direcciones={direcciones}
          />
        </motion.div>
      )}

      {/* Modo Campo */}
      {modoCampo && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur border border-slate-700/50 rounded-xl p-5">
          <ModoCampo currentUser={currentUser} onOpenOrder={setSelectedOrder} />
        </motion.div>
      )}

      {/* Search (ambas vistas) + Filtros de estado (solo grilla) */}
      {!modoCampo && (
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
          {viewMode === 'grid' && (
            <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1 border border-slate-700/50 overflow-x-auto">
              {['all', 'pendiente', 'asignada', 'en_progreso', 'obra', 'pendiente_validacion', 'completada', 'cancelada'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setStatusTab(tab)}
                  className={`text-xs px-3 py-1.5 rounded font-medium transition-all whitespace-nowrap ${statusTab === tab ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  {tab === 'all' ? 'Todas' : STATUS_LABELS[tab] || tab.replace('_', ' ')}
                </button>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Kanban */}
      {!modoCampo && viewMode === 'kanban' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {filtered.length === 0 && !isLoading ? (
            <EmptyState icon={ClipboardList} title="No hay órdenes" description="Creá una nueva orden de trabajo" actionLabel="Nueva OT" onAction={() => navigate('/crear-ot')} />
          ) : (
            <KanbanBoard
              orders={filtered}
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
            <WorkOrderCard
              key={order.id}
              order={order}
              onOpen={setSelectedOrder}
              onShowQR={setQrOrder}
              onComplete={handleComplete}
              onStart={handleStart}
              canComplete={canCompleteOT}
            />
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
    </PullToRefresh>
  );
}