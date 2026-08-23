/**
 * Portal Tablet — acceso para operarios en tablet vinculada a un jefe de sitio
 * Flujo: Activar (código) → Ver OTs del jefe → Ejecutar
 *
 * Cada tablet se vincula a un único jefe de sitio mediante un código de activación.
 * Solo muestra las OTs cuyo jefe_sitio coincide con el de la tablet.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import {
  CheckCircle2, Loader2, AlertTriangle, Lock, ChevronRight,
  Wrench, LogOut, RefreshCw, Tablet as TabletIcon, User, Link2, MapPin
} from 'lucide-react';
import EjecutarOTEnPortal from '@/components/workorders/EjecutarOTEnPortal';

const callFn = async (payload) => {
  const res = await base44.functions.invoke('publicFichar', payload);
  return res.data;
};

const STORAGE_KEY = 'tablet_session_v1';

const PRIORITY_STYLE = {
  baja:    { ring: 'bg-slate-400',   chip: 'bg-slate-500/15 text-slate-300 border-slate-500/25', label: 'Baja' },
  media:   { ring: 'bg-blue-400',    chip: 'bg-blue-500/15 text-blue-300 border-blue-500/25',   label: 'Media' },
  alta:    { ring: 'bg-orange-400',   chip: 'bg-orange-500/15 text-orange-300 border-orange-500/25', label: 'Alta' },
  urgente: { ring: 'bg-red-500',     chip: 'bg-red-500/15 text-red-300 border-red-500/25',     label: 'Urgente' },
};

const TYPE_LABEL = {
  mantenimiento_preventivo: 'Mant. Preventivo',
  mantenimiento_correctivo: 'Mant. Correctivo',
  instalacion: 'Instalación',
  inspeccion: 'Inspección',
  reparacion: 'Reparación',
  emergencia: '🚨 Emergencia',
};

const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

// ── Pantalla de activación ──────────────────────────────────────────────────
function PantallaActivacion({ onSuccess }) {
  const [codigo, setCodigo] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!codigo.trim()) return;
    setChecking(true);
    setError('');
    try {
      const res = await callFn({ action: 'activateTablet', codigo: codigo.trim() });
      if (res?.valid && res.tablet) {
        onSuccess(res.tablet);
      } else {
        setError('Código inválido. Verificá con tu supervisor.');
        setCodigo('');
      }
    } catch (err) {
      setError('Error de conexión. Verificá tu red e intentá nuevamente.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-5"
      style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top))', paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="bg-card border border-border/60 rounded-3xl p-8 w-full max-w-sm shadow-2xl"
      >
        <div className="text-center mb-7">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-indigo-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/25">
            <TabletIcon className="h-8 w-8 text-white" />
          </div>
          <h1 className="font-bold text-2xl text-foreground">Activar Tablet</h1>
          <p className="text-muted-foreground text-sm mt-1.5">Ingresá el código que te dio tu jefe de sitio</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-muted-foreground mb-2">Código de activación</label>
            <input
              type="text"
              value={codigo}
              onChange={e => setCodigo(e.target.value)}
              placeholder="Ej: NOLBERTO-T1"
              autoFocus
              autoCapitalize="characters"
              className="w-full h-14 rounded-2xl border-2 border-border bg-background/60 px-4 text-lg font-bold text-center tracking-wide text-foreground placeholder:text-muted-foreground/40 placeholder:font-normal placeholder:tracking-normal focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          {error && (
            <motion.div
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
            </motion.div>
          )}
          <button
            type="submit"
            disabled={checking || !codigo.trim()}
            className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-bold text-lg flex items-center justify-center gap-3 disabled:opacity-40 active:scale-[0.98] transition-all shadow-lg shadow-primary/25"
          >
            {checking ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Link2 className="h-5 w-5" /> Vincular tablet</>}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

// ── Lista de OTs ────────────────────────────────────────────────────────────
function ListaOTs({ orders, jefe, tabletNombre, onSelect, onRefresh, onUnlink, refreshing }) {
  const activas = orders.filter(o => !['completada', 'cancelada'].includes(o.status));
  const completadas = orders.filter(o => o.status === 'completada');

  const total = activas.length + completadas.length;
  const progress = total === 0 ? 100 : Math.round((completadas.length / total) * 100);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-indigo-600 px-5 pb-6 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-indigo-400/20 blur-2xl" />
        <div className="relative max-w-md mx-auto"
          style={{ paddingTop: 'max(2.5rem, env(safe-area-inset-top))' }}>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-11 w-11 bg-white/15 rounded-2xl flex items-center justify-center shrink-0 backdrop-blur-sm border border-white/20">
                <TabletIcon className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-white font-bold text-lg leading-tight truncate">{tabletNombre}</h1>
                <p className="text-white/60 text-xs flex items-center gap-1 truncate">
                  <User className="h-3 w-3 shrink-0" /> {jefe}
                </p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={onRefresh}
                disabled={refreshing}
                className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center text-white active:scale-95 transition disabled:opacity-50 border border-white/20 backdrop-blur-sm"
                title="Actualizar"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onUnlink}
                className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center text-white active:scale-95 transition border border-white/20 backdrop-blur-sm"
                title="Desvincular tablet"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
          {/* Progress bar del día */}
          {total > 0 && (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full bg-white/15 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }} animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className="h-full rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]"
                />
              </div>
              <span className="text-white/80 text-xs font-semibold tabular-nums shrink-0">{progress}%</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 px-4 py-5 max-w-md mx-auto w-full space-y-6"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>

        {activas.length === 0 && completadas.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <div className="h-20 w-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            </div>
            <p className="font-bold text-foreground text-lg">¡Todo al día!</p>
            <p className="text-muted-foreground text-sm mt-1">No hay órdenes pendientes para tu cuadrilla.</p>
          </motion.div>
        )}

        {activas.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              <p className="text-xs font-bold text-foreground uppercase tracking-wider">
                {activas.length} orden{activas.length !== 1 ? 'es' : ''} pendiente{activas.length !== 1 ? 's' : ''}
              </p>
            </div>
            <motion.div
              className="space-y-3"
              initial="hidden" animate="show" variants={stagger}
            >
              {activas.map(order => {
                const pr = PRIORITY_STYLE[order.priority] || PRIORITY_STYLE.media;
                return (
                  <motion.button
                    key={order.id} variants={cardVariants}
                    onClick={() => onSelect(order)}
                    className="w-full bg-card rounded-2xl p-4 border border-border text-left flex items-center gap-4 active:scale-[0.98] transition-all shadow-sm relative overflow-hidden"
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-1.5">
                      <span className={`block h-full ${pr.ring}`} />
                    </div>
                    <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0 ml-1">
                      <Wrench className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground text-sm leading-tight">{order.title}</p>
                      <p className="text-muted-foreground text-xs mt-0.5">{TYPE_LABEL[order.type] || order.type}</p>
                      {order.assigned_name && (
                        <p className="text-muted-foreground/80 text-xs mt-0.5 truncate flex items-center gap-1">
                          <User className="h-3 w-3" /> {order.assigned_name}
                        </p>
                      )}
                      {order.location && (
                        <p className="text-muted-foreground/70 text-xs mt-0.5 truncate flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {order.location}
                        </p>
                      )}
                      <span className={`inline-flex items-center gap-1.5 mt-2 px-2 py-0.5 rounded-full text-xs font-semibold border ${pr.chip}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${pr.ring}`} />
                        {pr.label}
                      </span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground/60 shrink-0" />
                  </motion.button>
                );
              })}
            </motion.div>
          </div>
        )}

        {completadas.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Completadas ({completadas.length})</p>
            </div>
            <div className="space-y-2">
              {completadas.map(order => (
                <div key={order.id} className="bg-card/40 rounded-2xl p-4 border border-border/50 flex items-center gap-3 opacity-60">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
                  <p className="text-muted-foreground text-sm font-medium line-through truncate">{order.title}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Componente principal ────────────────────────────────────────────────────
export default function PortalTablet() {
  const [phase, setPhase] = useState('loading'); // loading | activate | list | execute
  const [session, setSession] = useState(null);   // { tablet_id, nombre, jefe_sitio }
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadOrders = useCallback(async (sess) => {
    setRefreshing(true);
    try {
      const res = await callFn({ action: 'getOTsForTablet', tablet_id: sess.tablet_id });
      setOrders(res.workOrders || []);
    } catch {
      setOrders([]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Restaurar sesión guardada al montar
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSession(parsed);
        setPhase('list');
        loadOrders(parsed);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
        setPhase('activate');
      }
    } else {
      setPhase('activate');
    }
  }, [loadOrders]);

  const handleActivated = (tablet) => {
    const sess = { tablet_id: tablet.id, nombre: tablet.nombre, jefe_sitio: tablet.jefe_sitio };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sess));
    setSession(sess);
    setPhase('list');
    loadOrders(sess);
  };

  const handleUnlink = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setOrders([]);
    setPhase('activate');
  };

  const handleSelectOrder = (order) => {
    setSelectedOrder(order);
    setPhase('execute');
  };

  const handleOrderCompleted = (updatedOrder) => {
    setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    setPhase('list');
    setSelectedOrder(null);
  };

  // ── Loading ──
  if (phase === 'loading') return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-12 w-12 text-primary/40 animate-spin" />
    </div>
  );

  // ── Activación ──
  if (phase === 'activate') return <PantallaActivacion onSuccess={handleActivated} />;

  // ── Lista ──
  if (phase === 'list') return (
    <ListaOTs
      orders={orders}
      jefe={session?.jefe_sitio}
      tabletNombre={session?.nombre}
      onSelect={handleSelectOrder}
      onRefresh={() => loadOrders(session)}
      onUnlink={handleUnlink}
      refreshing={refreshing}
    />
  );

  // ── Ejecutar OT ──
  if (phase === 'execute' && selectedOrder) return (
    <EjecutarOTEnPortal
      order={selectedOrder}
      locationName={selectedOrder.location || session?.nombre}
      onBack={() => { setPhase('list'); loadOrders(session); }}
      onCompleted={handleOrderCompleted}
    />
  );

  return null;
}