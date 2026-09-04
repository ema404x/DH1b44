/**
 * Portal público para operarios — acceso vía QR del establecimiento
 * Flujo: Escanear QR → Ingresar clave → Ver lista de OTs → Ejecutar
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import {
  CheckCircle2, Loader2, AlertTriangle, Lock, ArrowLeft,
  MapPin, ClipboardList, ChevronRight, Wrench, ShieldCheck, Building2, WifiOff, User
} from 'lucide-react';
import EjecutarOTEnPortal from '@/components/workorders/EjecutarOTEnPortal';
import { setClave, setNombre, getNombre } from '@/lib/operarioClave';
import { usePortalOfflineActions } from '@/hooks/usePortalOfflineActions';
import { canActOn } from '@/lib/workOrderActions';

const callFn = async (payload) => {
  const res = await base44.functions.invoke('publicFichar', payload);
  return res.data;
};

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

// ── Pantalla de clave ───────────────────────────────────────────────────────
function PantallaClave({ locationName, onSuccess, onError }) {
  const [clave, setClaveInput] = useState('');
  const [nombre, setNombreInput] = useState(getNombre() || '');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!clave.trim()) return;
    if (!nombre.trim()) {
      setError('Ingresá tu nombre para registrar tu trabajo.');
      return;
    }
    setChecking(true);
    setError('');
    const res = await callFn({ action: 'verifyOperarioPassword', password: clave.trim() });
    setChecking(false);
    if (res?.valid) {
      setClave(clave.trim()); // cachea la clave para transicionEstadoOT (modo portal)
      setNombre(nombre.trim()); // cachea el nombre como operario_sesion
      onSuccess();
    } else {
      setError('Clave incorrecta. Consultá con tu supervisor.');
      setClaveInput('');
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
            <Lock className="h-8 w-8 text-white" />
          </div>
          <h1 className="font-bold text-2xl text-foreground">Portal Operarios</h1>
          {locationName && (
            <p className="text-muted-foreground text-sm mt-1.5 flex items-center justify-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> {locationName}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-muted-foreground mb-2">Tu nombre</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={nombre}
                onChange={e => setNombreInput(e.target.value)}
                placeholder="Ej: Juan Pérez"
                className="w-full h-14 rounded-2xl border-2 border-border bg-background/60 pl-12 pr-4 text-base font-medium text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <p className="text-xs text-muted-foreground/60 mt-1.5">Se registra en cada OT que toqués para trazabilidad.</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-muted-foreground mb-2">Clave de acceso</label>
            <input
              type="password"
              value={clave}
              onChange={e => setClaveInput(e.target.value)}
              placeholder="••••••••"
              inputMode="numeric"
              className="w-full h-14 rounded-2xl border-2 border-border bg-background/60 px-4 text-xl font-bold text-center tracking-[0.3em] text-foreground placeholder:tracking-[0.3em] placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary transition-colors"
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
            disabled={checking || !clave.trim() || !nombre.trim()}
            className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-bold text-lg flex items-center justify-center gap-3 disabled:opacity-40 active:scale-[0.98] transition-all shadow-lg shadow-primary/25"
          >
            {checking ? <Loader2 className="h-5 w-5 animate-spin" /> : <><ShieldCheck className="h-5 w-5" /> Ingresar</>}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

// ── Lista de OTs ────────────────────────────────────────────────────────────
function ListaOTs({ orders, locationName, locationAddress, onSelect, resolveAction }) {
  const activas = orders.filter(o => !['completada', 'cancelada', 'pendiente_validacion'].includes(o.status));
  const enValidacion = orders.filter(o => o.status === 'pendiente_validacion');
  const completadas = orders.filter(o => o.status === 'completada');

  const total = activas.length + enValidacion.length + completadas.length;
  const progress = total === 0 ? 100 : Math.round(((completadas.length + enValidacion.length) / total) * 100);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-indigo-600 px-5 pb-6 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-indigo-400/20 blur-2xl" />
        <div className="relative max-w-md mx-auto"
          style={{ paddingTop: 'max(2.5rem, env(safe-area-inset-top))' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-11 w-11 bg-white/15 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/20">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-white font-bold text-lg leading-tight truncate">{locationName}</h1>
              {locationAddress && <p className="text-white/60 text-xs truncate flex items-center gap-1"><MapPin className="h-3 w-3 shrink-0" />{locationAddress}</p>}
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

        {activas.length === 0 && enValidacion.length === 0 && completadas.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <div className="h-20 w-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            </div>
            <p className="font-bold text-foreground text-lg">¡Todo al día!</p>
            <p className="text-muted-foreground text-sm mt-1">No hay órdenes pendientes para este establecimiento.</p>
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
                const action = resolveAction ? resolveAction(order) : { canAct: true };
                const locked = !action.canAct;
                return (
                  <motion.button
                    key={order.id} variants={cardVariants}
                    onClick={() => !locked && onSelect(order)}
                    disabled={locked}
                    className={`w-full bg-card rounded-2xl p-4 border text-left flex items-center gap-4 transition-all shadow-sm relative overflow-hidden ${
                      locked ? 'border-border/40 opacity-60 cursor-not-allowed' : 'border-border active:scale-[0.98]'
                    }`}
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-1.5">
                      <span className={`block h-full ${pr.ring}`} />
                    </div>
                    <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0 ml-1">
                      <Wrench className={`h-6 w-6 ${locked ? 'text-muted-foreground/50' : 'text-primary'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground text-sm leading-tight">{order.title}</p>
                      <p className="text-muted-foreground text-xs mt-0.5">{TYPE_LABEL[order.type] || order.type}</p>
                      {locked ? (
                        <span className="inline-flex items-center gap-1.5 mt-2 px-2 py-0.5 rounded-full text-xs font-semibold border bg-muted/30 text-muted-foreground border-border/50">
                          <Lock className="h-3 w-3" /> {action.reason || 'No disponible'}
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1.5 mt-2 px-2 py-0.5 rounded-full text-xs font-semibold border ${pr.chip}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${pr.ring}`} />
                          {pr.label}
                        </span>
                      )}
                    </div>
                    {locked
                      ? <Lock className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                      : <ChevronRight className="h-5 w-5 text-muted-foreground/60 shrink-0" />}
                  </motion.button>
                );
              })}
            </motion.div>
          </div>
        )}

        {enValidacion.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">En validación ({enValidacion.length})</p>
            </div>
            <div className="space-y-2">
              {enValidacion.map(order => (
                <div key={order.id} className="bg-amber-500/10 rounded-2xl p-4 border border-amber-500/20 flex items-center gap-3">
                  <ClipboardList className="h-6 w-6 text-amber-400 shrink-0" />
                  <p className="text-amber-200 text-sm font-medium">{order.title}</p>
                </div>
              ))}
            </div>
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
                  <p className="text-muted-foreground text-sm font-medium line-through">{order.title}</p>
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
export default function PortalOperario() {
  const params = new URLSearchParams(window.location.search);
  const locationId = params.get('loc');
  const assetId = params.get('asset');

  const [phase, setPhase] = useState('loading'); // loading | pin | list | execute | done | error
  const [locationData, setLocationData] = useState(null);
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Cache de OTs por ubicación/activo para reingreso offline.
  const CACHE_PREFIX = assetId ? `portal-asset-${assetId}` : `portal-loc-${locationId}`;
  const cacheOrders = useCallback((ords) => {
    try { localStorage.setItem(CACHE_PREFIX, JSON.stringify({ orders: ords, cachedAt: Date.now() })); } catch {}
  }, [CACHE_PREFIX]);
  const loadCachedOrders = useCallback(() => {
    try {
      const c = JSON.parse(localStorage.getItem(CACHE_PREFIX));
      return c?.orders || [];
    } catch { return []; }
  }, [CACHE_PREFIX]);

  // Upsert optimista: actualiza una OT en la lista visible (cuando vuelve del
  // offline o de una transición) sin recargar todo.
  const handleOptimisticUpdate = useCallback((updatedOT) => {
    setOrders(prev => prev.map(o => o.id === updatedOT.id ? { ...o, ...updatedOT } : o));
  }, []);

  const { pendingCount, syncing, queueTransition } = usePortalOfflineActions({
    onOptimisticUpdate: handleOptimisticUpdate,
    onSyncComplete: ({ conflicts }) => {
      // Tras conflictos la UI optimista quedó inconsistente: recargar el estado real.
      if (conflicts > 0) reloadOrders();
    },
  });

  // Cargar datos del establecimiento (ubicación) o del activo según el parámetro.
  // ?loc=<id>   → OTs de una ubicación (escuelas).
  // ?asset=<id> → OTs de un activo (mismo flujo: clave → lista → ejecutar).
  useEffect(() => {
    const loadOrders = async () => {
      if (assetId) {
        try {
          const res = await callFn({ action: 'getWorkOrdersForAsset', assetId });
          setLocationData({ name: res.assetName || 'Activo', address: res.assetSede || '' });
          setOrders(res.workOrders || []);
          cacheOrders(res.workOrders || []);
          setPhase('pin');
        } catch {
          // Offline fallback: cargar cache si existe
          const cached = loadCachedOrders();
          if (cached.length > 0) {
            setLocationData({ name: 'Activo', address: '' });
            setOrders(cached);
          }
          setPhase('pin');
        }
        return;
      }
      if (!locationId) { setPhase('error'); return; }
      try {
        const res = await callFn({ action: 'getWorkOrderForLocation', locationId });
        setLocationData({ name: res.locationName, address: res.locationAddress });
        setOrders(res.workOrders || []);
        cacheOrders(res.workOrders || []);
        setPhase('pin');
      } catch {
        // Offline fallback: cargar cache si existe
        const cached = loadCachedOrders();
        if (cached.length > 0) {
          setLocationData({ name: 'Ubicación', address: '' });
          setOrders(cached);
        }
        setPhase('pin');
      }
    };
    loadOrders();
  }, [locationId, assetId, cacheOrders, loadCachedOrders]);

  const handleAuthSuccess = () => setPhase('list');

  const handleSelectOrder = (order) => {
    setSelectedOrder(order);
    setPhase('execute');
  };

  const handleOrderCompleted = (updatedOrder) => {
    setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    setPhase('list');
    setSelectedOrder(null);
  };

  const reloadOrders = async () => {
    if (assetId) {
      const res = await callFn({ action: 'getWorkOrdersForAsset', assetId });
      setOrders(res.workOrders || []);
      return;
    }
    const res = await callFn({ action: 'getWorkOrderForLocation', locationId });
    setOrders(res.workOrders || []);
  };

  // ── Loading ──
  if (phase === 'loading') return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-12 w-12 text-primary/40 animate-spin" />
    </div>
  );

  // ── Error / no encontrado ──
  if (phase === 'error') return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-3xl p-8 max-w-xs w-full text-center"
      >
        <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="font-bold text-xl text-foreground mb-1">QR no válido</h2>
        <p className="text-muted-foreground text-sm">No se encontró este establecimiento.</p>
      </motion.div>
    </div>
  );

  // ── Clave ──
  if (phase === 'pin') return (
    <PantallaClave
      locationName={locationData?.name}
      onSuccess={handleAuthSuccess}
    />
  );

  const resolveAction = (ot) => {
    const operarioSesion = getNombre();
    return canActOn(ot, { operarioSesion });
  };

  // ── Lista ──
  if (phase === 'list') return (
    <>
      {(!isOnline || pendingCount > 0) && (
        <div className="fixed top-0 inset-x-0 z-50 flex items-center gap-2 bg-amber-500/15 border-b border-amber-500/30 text-amber-300 text-xs font-medium px-4 py-2"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          {syncing ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <WifiOff className="h-4 w-4 shrink-0" />}
          {syncing
            ? `Sincronizando ${pendingCount} acción(es) pendiente(s)...`
            : !isOnline
              ? `Sin conexión — tus OTs se guardan y se envían al volver online.`
              : `${pendingCount} acción(es) pendiente(s) de sincronizar.`}
        </div>
      )}
      <ListaOTs
        orders={orders}
        locationName={locationData?.name}
        locationAddress={locationData?.address}
        onSelect={handleSelectOrder}
        resolveAction={resolveAction}
      />
    </>
  );

  // ── Ejecutar OT individual ──
  if (phase === 'execute' && selectedOrder) return (
    <EjecutarOTEnPortal
      order={selectedOrder}
      locationName={locationData?.name}
      onBack={() => { setPhase('list'); reloadOrders(); }}
      onCompleted={handleOrderCompleted}
      isOnline={isOnline}
      onQueueOffline={queueTransition}
    />
  );

  return null;
}