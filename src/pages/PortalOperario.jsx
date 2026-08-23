/**
 * Portal público para operarios — acceso vía QR del establecimiento
 * Flujo: Escanear QR → Ingresar clave → Ver lista de OTs → Ejecutar
 */
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import {
  CheckCircle2, Loader2, AlertTriangle, Lock, ArrowLeft,
  MapPin, ClipboardList, ChevronRight, Wrench, ShieldCheck, Building2
} from 'lucide-react';
import EjecutarOTEnPortal from '@/components/workorders/EjecutarOTEnPortal';
import { setClave } from '@/lib/operarioClave';

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
  const [clave, setClave] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!clave.trim()) return;
    setChecking(true);
    setError('');
    const res = await callFn({ action: 'verifyOperarioPassword', password: clave.trim() });
    setChecking(false);
    if (res?.valid) {
      setClave(clave.trim()); // cachea la clave para reenviarla en updateWorkOrder
      onSuccess();
    } else {
      setError('Clave incorrecta. Consultá con tu supervisor.');
      setClave('');
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
            <label className="block text-sm font-semibold text-muted-foreground mb-2">Clave de acceso</label>
            <input
              type="password"
              value={clave}
              onChange={e => setClave(e.target.value)}
              placeholder="••••••••"
              autoFocus
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
            disabled={checking || !clave.trim()}
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
function ListaOTs({ orders, locationName, locationAddress, onSelect }) {
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

  // Cargar datos del establecimiento (ubicación) o del activo según el parámetro.
  // ?loc=<id>   → OTs de una ubicación (escuelas).
  // ?asset=<id> → OTs de un activo (mismo flujo: clave → lista → ejecutar).
  useEffect(() => {
    if (assetId) {
      callFn({ action: 'getWorkOrdersForAsset', assetId })
        .then(res => {
          setLocationData({ name: res.assetName || 'Activo', address: res.assetSede || '' });
          setOrders(res.workOrders || []);
          setPhase('pin');
        })
        .catch(() => setPhase('error'));
      return;
    }
    if (!locationId) { setPhase('error'); return; }
    callFn({ action: 'getWorkOrderForLocation', locationId })
      .then(res => {
        setLocationData({ name: res.locationName, address: res.locationAddress });
        setOrders(res.workOrders || []);
        setPhase('pin');
      })
      .catch(() => setPhase('error'));
  }, [locationId, assetId]);

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

  // ── Lista ──
  if (phase === 'list') return (
    <ListaOTs
      orders={orders}
      locationName={locationData?.name}
      locationAddress={locationData?.address}
      onSelect={handleSelectOrder}
    />
  );

  // ── Ejecutar OT individual ──
  if (phase === 'execute' && selectedOrder) return (
    <EjecutarOTEnPortal
      order={selectedOrder}
      locationName={locationData?.name}
      onBack={() => { setPhase('list'); reloadOrders(); }}
      onCompleted={handleOrderCompleted}
    />
  );

  return null;
}