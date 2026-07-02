/**
 * Portal Tablet — acceso para operarios en tablet vinculada a un jefe de sitio
 * Flujo: Activar (código) → Ver OTs del jefe → Ejecutar
 *
 * Cada tablet se vincula a un único jefe de sitio mediante un código de activación.
 * Solo muestra las OTs cuyo jefe_sitio coincide con el de la tablet.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import {
  CheckCircle2, Loader2, AlertTriangle, Lock, ChevronRight,
  Wrench, LogOut, RefreshCw, Tablet as TabletIcon, User
} from 'lucide-react';
import EjecutarOTEnPortal from '@/components/workorders/EjecutarOTEnPortal';

const callFn = async (payload) => {
  const res = await base44.functions.invoke('publicFichar', payload);
  return res.data;
};

const STORAGE_KEY = 'tablet_session_v1';

const PRIORITY_STYLE = {
  baja:    { bg: 'bg-slate-100',  text: 'text-slate-600',  dot: 'bg-slate-400',  label: 'Baja' },
  media:   { bg: 'bg-blue-50',    text: 'text-blue-700',   dot: 'bg-blue-400',   label: 'Media' },
  alta:    { bg: 'bg-orange-50',  text: 'text-orange-700', dot: 'bg-orange-500', label: 'Alta' },
  urgente: { bg: 'bg-red-50',     text: 'text-red-700',    dot: 'bg-red-500',    label: 'Urgente' },
};

const TYPE_LABEL = {
  mantenimiento_preventivo: 'Mant. Preventivo',
  mantenimiento_correctivo: 'Mant. Correctivo',
  instalacion: 'Instalación',
  inspeccion: 'Inspección',
  reparacion: 'Reparación',
  emergencia: '🚨 Emergencia',
};

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
    const res = await callFn({ action: 'activateTablet', codigo: codigo.trim() });
    setChecking(false);
    if (res?.valid && res.tablet) {
      onSuccess(res.tablet);
    } else {
      setError('Código inválido. Verificá con tu supervisor.');
      setCodigo('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-5">
      <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl">
        <div className="text-center mb-7">
          <div className="h-16 w-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <TabletIcon className="h-8 w-8 text-white" />
          </div>
          <h1 className="font-bold text-2xl text-slate-800">Activar Tablet</h1>
          <p className="text-slate-500 text-sm mt-1">Ingresá el código que te dio tu jefe de sitio</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-2">Código de activación</label>
            <input
              type="text"
              value={codigo}
              onChange={e => setCodigo(e.target.value)}
              placeholder="Ej: NOLBERTO-T1"
              autoFocus
              autoCapitalize="characters"
              className="w-full h-14 rounded-2xl border-2 border-slate-200 px-4 text-lg font-bold text-center tracking-wide focus:outline-none focus:border-slate-500 transition-colors"
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-xl px-4 py-3">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}
          <button
            type="submit"
            disabled={checking || !codigo.trim()}
            className="w-full h-14 rounded-2xl bg-slate-800 text-white font-bold text-lg flex items-center justify-center gap-3 disabled:opacity-40 active:scale-[0.98] transition-all"
          >
            {checking ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Lock className="h-5 w-5" /> Vincular tablet</>}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Lista de OTs ────────────────────────────────────────────────────────────
function ListaOTs({ orders, jefe, tabletNombre, onSelect, onRefresh, onUnlink, refreshing }) {
  const activas = orders.filter(o => !['completada', 'cancelada'].includes(o.status));
  const completadas = orders.filter(o => o.status === 'completada');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-slate-800 px-5 pt-10 pb-6">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                <TabletIcon className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-white font-bold text-lg leading-tight truncate">{tabletNombre}</h1>
                <p className="text-white/50 text-xs flex items-center gap-1 truncate">
                  <User className="h-3 w-3 shrink-0" /> {jefe}
                </p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={onRefresh}
                disabled={refreshing}
                className="h-9 w-9 rounded-lg bg-white/10 flex items-center justify-center text-white/80 active:scale-95 transition disabled:opacity-50"
                title="Actualizar"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onUnlink}
                className="h-9 w-9 rounded-lg bg-white/10 flex items-center justify-center text-white/80 active:scale-95 transition"
                title="Desvincular tablet"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-5 max-w-md mx-auto w-full space-y-5">
        {activas.length === 0 && (
          <div className="text-center py-12">
            <CheckCircle2 className="h-16 w-16 text-emerald-400 mx-auto mb-3" />
            <p className="font-bold text-slate-700 text-lg">¡Todo al día!</p>
            <p className="text-slate-400 text-sm">No hay órdenes pendientes para tu cuadrilla.</p>
          </div>
        )}

        {activas.length > 0 && (
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              {activas.length} orden{activas.length !== 1 ? 'es' : ''} pendiente{activas.length !== 1 ? 's' : ''}
            </p>
            <div className="space-y-3">
              {activas.map(order => {
                const pr = PRIORITY_STYLE[order.priority] || PRIORITY_STYLE.media;
                return (
                  <button
                    key={order.id}
                    onClick={() => onSelect(order)}
                    className="w-full bg-white rounded-2xl p-4 border border-slate-200 text-left flex items-center gap-4 active:scale-[0.98] transition-all shadow-sm"
                  >
                    <div className="h-12 w-12 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                      <Wrench className="h-6 w-6 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 text-sm leading-tight">{order.title}</p>
                      <p className="text-slate-400 text-xs mt-0.5">{TYPE_LABEL[order.type] || order.type}</p>
                      {order.assigned_name && (
                        <p className="text-slate-500 text-xs mt-0.5 truncate">👤 {order.assigned_name}</p>
                      )}
                      {order.location && (
                        <p className="text-slate-400 text-xs mt-0.5 truncate">📍 {order.location}</p>
                      )}
                      <span className={`inline-flex items-center gap-1.5 mt-2 px-2 py-0.5 rounded-full text-xs font-semibold ${pr.bg} ${pr.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${pr.dot}`} />
                        {pr.label}
                      </span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-300 shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {completadas.length > 0 && (
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Completadas ({completadas.length})</p>
            <div className="space-y-2">
              {completadas.map(order => (
                <div key={order.id} className="bg-white/60 rounded-2xl p-4 border border-slate-200 flex items-center gap-3 opacity-60">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
                  <p className="text-slate-600 text-sm font-medium line-through truncate">{order.title}</p>
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
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <Loader2 className="h-12 w-12 text-white/30 animate-spin" />
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