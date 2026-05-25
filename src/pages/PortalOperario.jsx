/**
 * Portal público para operarios — acceso vía QR del establecimiento
 * Flujo: Escanear QR → Ingresar clave → Ver lista de OTs → Ejecutar
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  CheckCircle2, Loader2, AlertTriangle, Lock, ArrowLeft,
  MapPin, ClipboardList, ChevronRight, Wrench
} from 'lucide-react';
import EjecutarOTEnPortal from '@/components/workorders/EjecutarOTEnPortal';

const callFn = async (payload) => {
  const res = await base44.functions.invoke('publicFichar', payload);
  return res.data;
};

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
      onSuccess();
    } else {
      setError('Clave incorrecta. Consultá con tu supervisor.');
      setClave('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-5">
      <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl">
        <div className="text-center mb-7">
          <div className="h-16 w-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <h1 className="font-bold text-2xl text-slate-800">Portal Operarios</h1>
          {locationName && (
            <p className="text-slate-500 text-sm mt-1 flex items-center justify-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {locationName}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-2">Clave de acceso</label>
            <input
              type="password"
              value={clave}
              onChange={e => setClave(e.target.value)}
              placeholder="••••••••"
              autoFocus
              className="w-full h-14 rounded-2xl border-2 border-slate-200 px-4 text-xl font-bold text-center tracking-widest focus:outline-none focus:border-slate-500 transition-colors"
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-xl px-4 py-3">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}
          <button
            type="submit"
            disabled={checking || !clave.trim()}
            className="w-full h-14 rounded-2xl bg-slate-800 text-white font-bold text-lg flex items-center justify-center gap-3 disabled:opacity-40 active:scale-[0.98] transition-all"
          >
            {checking ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Lista de OTs ────────────────────────────────────────────────────────────
function ListaOTs({ orders, locationName, locationAddress, onSelect }) {
  const activas = orders.filter(o => !['completada', 'cancelada'].includes(o.status));
  const completadas = orders.filter(o => o.status === 'completada');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-slate-800 px-5 pt-10 pb-6">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 bg-white/10 rounded-xl flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-xl leading-tight">{locationName}</h1>
              {locationAddress && <p className="text-white/50 text-xs">{locationAddress}</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-5 max-w-md mx-auto w-full space-y-5">
        {activas.length === 0 && (
          <div className="text-center py-12">
            <CheckCircle2 className="h-16 w-16 text-emerald-400 mx-auto mb-3" />
            <p className="font-bold text-slate-700 text-lg">¡Todo al día!</p>
            <p className="text-slate-400 text-sm">No hay órdenes pendientes para este establecimiento.</p>
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
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Completadas hoy ({completadas.length})</p>
            <div className="space-y-2">
              {completadas.map(order => (
                <div key={order.id} className="bg-white/60 rounded-2xl p-4 border border-slate-200 flex items-center gap-3 opacity-60">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
                  <p className="text-slate-600 text-sm font-medium line-through">{order.title}</p>
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

  const [phase, setPhase] = useState('loading'); // loading | pin | list | execute | done | error
  const [locationData, setLocationData] = useState(null);
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Cargar datos del establecimiento
  useEffect(() => {
    if (!locationId) { setPhase('error'); return; }
    callFn({ action: 'getWorkOrderForLocation', locationId })
      .then(res => {
        setLocationData({ name: res.locationName, address: res.locationAddress });
        setOrders(res.workOrders || []);
        setPhase('pin');
      })
      .catch(() => setPhase('error'));
  }, [locationId]);

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
    const res = await callFn({ action: 'getWorkOrderForLocation', locationId });
    setOrders(res.workOrders || []);
  };

  // ── Loading ──
  if (phase === 'loading') return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <Loader2 className="h-12 w-12 text-white/30 animate-spin" />
    </div>
  );

  // ── Error / no encontrado ──
  if (phase === 'error') return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-6">
      <div className="bg-white rounded-3xl p-8 max-w-xs w-full text-center">
        <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-8 w-8 text-red-500" />
        </div>
        <h2 className="font-bold text-xl mb-1">QR no válido</h2>
        <p className="text-slate-500 text-sm">No se encontró este establecimiento.</p>
      </div>
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