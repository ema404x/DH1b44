import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useGeolocalizacion } from '@/hooks/useGeolocalizacion';
import { Loader2, ClipboardList, MapPin, Play, Flag, Lock, Clock, CheckCircle2, ArrowRight, ScanLine, History, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import CountUp from '@/components/dashboard/CountUp';
import ReporteForm from '@/components/operario/ReporteForm';
import QRScannerModal from '@/components/operario/QRScannerModal';
import LocationOTListModal from '@/components/operario/LocationOTListModal';
import BodyPortal from '@/components/operario/BodyPortal';
import MisOrdenesFiltros from '@/components/operario/MisOrdenesFiltros';
import { useOperarioOfflineActions } from '@/hooks/useOperarioOfflineActions';
import { canActOn } from '@/lib/workOrderActions';

export default function PortalOperarioApp() {
  const { currentUser, displayName } = useCurrentUser();
  const [reporteOT, setReporteOT] = useState(null);
  const [processing, setProcessing] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // { ot, accion }
  const [scannerOpen, setScannerOpen] = useState(false);
  const [locOTs, setLocOTs] = useState(null); // { orders, name } cuando se escanea un QR de ubicación
  const [filtros, setFiltros] = useState({ texto: '', tipo: 'todos', prioridad: 'todos' });
  const [vista, setVista] = useState('activas'); // 'activas' | 'historial'
  const { capturar } = useGeolocalizacion();
  const queryClient = useQueryClient();

  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const CACHE_KEY = `mis-ots-cache-${currentUser?.id || 'anon'}`;

  // initialData desde localStorage: en la primera carga (incluso sin conexión)
  // el operario ve sus OTs guardadas. Es la base offline no-destructiva.
  const leerCacheOTs = () => {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
      if (cached?.orders) return cached.orders;
    } catch {}
    return [];
  };

  const { data: allOTs = [], isFetching } = useQuery({
    queryKey: ['workorders-operario'],
    initialData: leerCacheOTs,
    queryFn: async () => {
      // Source of truth = servidor. NO capturar+devolver cache acá: al pisar el
      // data en un error de refetch, se perdía el dato optimista de la mutación
      // (la OT que el operario acababa de iniciar) → "se sale todo". Lanzamos y
      // dejamos que React Query preserve el data anterior en error de refetch.
      // El cache viejo solo se usa como initialData en la primera carga.
      const res = await base44.functions.invoke('getWorkOrdersForUser');
      const orders = res.data?.orders || [];
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ orders, cachedAt: Date.now() })); } catch {}
      return orders;
    },
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  // Cola de transiciones offline (iniciar/finalizar sin conexión).
  // Aplica el cambio al cache de inmediato (UX) y lo sincroniza al volver online.
  const { pendingCount, syncing, pendingOtIds, queueTransition } = useOperarioOfflineActions({
    queryClient,
    cacheKey: CACHE_KEY,
  });

  const misOTs = useMemo(() => {
    // La identidad la resuelve el backend (getWorkOrdersForUser, service-role).
    // Acá solo descartamos estados terminales.
    return allOTs.filter(ot => ot.status !== 'cancelada' && ot.status !== 'completada');
  }, [allOTs]);

  // Historial: OTs terminales (completadas / canceladas) que el operario trabajó.
  const historial = useMemo(() =>
    allOTs.filter(ot => ot.status === 'cancelada' || ot.status === 'completada'),
  [allOTs]);

  const aplicarFiltros = useCallback((lista) => {
    const q = filtros.texto
      ? filtros.texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      : '';
    return lista.filter(ot => {
      if (q) {
        const blob = [ot.title, ot.location, ot.code, ot.asset_name, ot.project_name]
          .filter(Boolean).join(' ')
          .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (!blob.includes(q)) return false;
      }
      if (filtros.tipo !== 'todos' && ot.type !== filtros.tipo) return false;
      if (filtros.prioridad !== 'todos' && ot.priority !== filtros.prioridad) return false;
      return true;
    });
  }, [filtros]);

  const misOTsFiltradas = useMemo(() => aplicarFiltros(misOTs), [misOTs, aplicarFiltros]);
  const historialFiltrado = useMemo(() => aplicarFiltros(historial), [historial, aplicarFiltros]);

  const limpiarFiltros = () => {
    setFiltros({ texto: '', tipo: 'todos', prioridad: 'todos' });
    setVista('activas');
  };

  // Separar por fase del flujo
  const { porIniciar, enProgreso, enValidacion } = useMemo(() => {
    const ini = [], prog = [], val = [];
    for (const ot of misOTsFiltradas) {
      if (ot.status === 'pendiente_validacion') val.push(ot);
      else       if (ot.status === 'en_progreso') prog.push(ot);
      else ini.push(ot); // pendiente, asignada
    }
    return { porIniciar: ini, enProgreso: prog, enValidacion: val };
  }, [misOTsFiltradas]);

  const ejecutarTransicion = async (ot, accion, extraData = {}) => {
    setProcessing(ot.id);
    try {
      const res = await base44.functions.invoke('transicionEstadoOT', {
        ot_id: ot.id,
        accion,
        extra_data: extraData,
      });
      // La función responde 200 con { error } en algunos casos (estado inválido,
      // falta de permiso, checklist incompleto). Hay que chequearlo explícitamente,
      // si no el toast de éxito pisa al error y parece que "no pasa nada".
      if (res.data?.error) {
        toast.error(res.data.error);
        return false;
      }
      toast.success(res.data.mensaje);
      // Upsert optimista de la OT actualizada (res.data.ot) al cache del operario.
      // NO invalidamos 'workorders-operario': en móvil con conexión inestable la
      // refetch falla y el queryFn cae al cache localStorage (lista VIEJA sin la OT
      // que el operario acaba de iniciar por QR, porque antes no estaba asignada a
      // él) → la OT "desaparece de la lista". Con el upsert, la OT queda en
      // "En Progreso" de inmediato; el staleTime (5min) y el pull-to-refresh
      // sincronizan después, con conexión estable.
      if (res.data.ot) {
        queryClient.setQueryData(['workorders-operario'], (old = []) => {
          const others = (old || []).filter(o => o.id !== res.data.ot.id);
          return [...others, res.data.ot];
        });
        // Persistir el snapshot optimista al cache offline: si el operario
        // recarga sin conexión antes de la próxima refetch, initialData lo levanta.
        try {
          const cur = queryClient.getQueryData(['workorders-operario']) || [];
          localStorage.setItem(CACHE_KEY, JSON.stringify({ orders: cur, cachedAt: Date.now() }));
        } catch {}
      }
      // Seguro re-invalidar: queryFn lanza en error, así React Query PRESERVA el
      // data optimista (la OT en En Progreso) en vez de pisarlo con cache viejo.
      queryClient.invalidateQueries({ queryKey: ['workorders-operario'] });
      queryClient.invalidateQueries({ queryKey: ['workorders'] });
      return true;
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'intente nuevamente';
      toast.error(msg);
      return false;
    } finally {
      setProcessing(null);
      setConfirmAction(null);
    }
  };

  const handleIniciar = async (ot) => {
    // Marcar processing antes del GPS para feedback inmediato (captura puede tardar hasta 8s)
    setProcessing(ot.id);
    const gps = await capturar();
    const extraData = { assigned_name: displayName, assigned_to: currentUser?.id };
    if (gps.gps_status === 'capturado') {
      extraData.gps = { latitude: gps.gps_latitude, longitude: gps.gps_longitude, accuracy: gps.gps_accuracy };
    } else {
      extraData.gps_status = gps.gps_status;
    }
    if (!isOnline) {
      // Offline: encolar la transición y aplicar el cambio al cache (UX inmediata).
      // El GPS se captura igual (offline); solo falla el envío al servidor.
      const optimistic = {
        ...ot,
        status: 'en_progreso',
        fecha_inicio_real: new Date().toISOString(),
        assigned_to: currentUser?.id,
        assigned_name: displayName,
        gps_latitude: gps.gps_status === 'capturado' ? gps.gps_latitude : ot.gps_latitude,
        gps_longitude: gps.gps_status === 'capturado' ? gps.gps_longitude : ot.gps_longitude,
        gps_accuracy: gps.gps_status === 'capturado' ? gps.gps_accuracy : ot.gps_accuracy,
        gps_status: gps.gps_status,
        _pending_sync: true,
      };
      queueTransition(ot, 'iniciar', extraData, optimistic);
      toast.success('OT iniciada (sin conexión). Se sincronizará al volver online.');
      setProcessing(null);
      setConfirmAction(null);
      return;
    }
    await ejecutarTransicion(ot, 'iniciar', extraData);
    // "Iniciar" solo arranca la OT. El reporte de cierre se completa después,
    // cuando el operario toque "Finalizar y Reportar" en la tarjeta de En Progreso.
    // Abrir el ReporteForm acá forzaba el cierre inmediato de una OT que recién
    // empezaba — el operario veía la lista cerrarse y aparecer el reporte ("se
    // sale todo y ya"). La query se invalida en ejecutarTransicion, así la OT
    // pasa a verse en "En Progreso" sin abrir ningún modal.
  };

  const handleReporteSaved = async (ot, reporteData) => {
    if (!isOnline) {
      // Offline: encolar el reporte y marcar la OT como enviada a validación.
      const optimistic = {
        ...ot,
        status: 'pendiente_validacion',
        materials_used: reporteData.materials_used,
        materiales_faltantes: reporteData.materiales_faltantes,
        notes: reporteData.notes,
        photos: reporteData.photos,
        _pending_sync: true,
      };
      queueTransition(ot, 'finalizar', reporteData, optimistic);
      toast.success('Reporte guardado (sin conexión). Se enviará al jefe al volver online.');
      setReporteOT(null);
      return;
    }
    // El reporte ya guardó materiales; ahora transicionar a pendiente_validacion
    const ok = await ejecutarTransicion(ot, 'finalizar', reporteData);
    if (ok) setReporteOT(null);
  };

  // OTs cacheadas para una ubicación (por id) — solo lectura offline
  const otsDesdeCacheParaUbicacion = (locId) => {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
      const orders = cached?.orders || [];
      const activas = orders.filter(o =>
        o.location_qr_id === locId && !['completada', 'cancelada'].includes(o.status)
      );
      const nombre = activas[0]?.location_qr_name || activas[0]?.location || 'Ubicación escaneada';
      return { orders: activas, name: nombre };
    } catch { return { orders: [], name: 'Ubicación escaneada' }; }
  };

  const handleQRScan = async (result) => {
    // Nota: NO cerramos el scanner acá — el scanner se cierra solo tras 350ms
    // (mostrando el flash verde de "código detectado"). Si lo cerramos acá,
    // el flash nunca se ve y el feedback visual se pierde.

    // Tipo 'loc' — buscar OTs de la ubicación via backend (service role, sin RLS)
    if (result.type === 'loc') {
      // Sin conexión: resolver desde el cache (solo lectura)
      if (!navigator.onLine) {
        const { orders, name } = otsDesdeCacheParaUbicacion(result.value);
        setLocOTs({ orders, name, loading: false, locId: result.value, error: false, offline: true });
        return;
      }
      setLocOTs({ orders: [], name: 'Cargando…', loading: true, locId: result.value, error: false });
      try {
        const res = await base44.functions.invoke('publicFichar', {
          action: 'getWorkOrderForLocation',
          locationId: result.value,
        });
        const data = res.data || {};
        const orders = data.workOrders || [];
        setLocOTs({ orders, name: data.locationName || 'Ubicación escaneada', loading: false, locId: result.value, error: false });
      } catch {
        // La red falló: caer al cache en vez de dejar la lista vacía
        const c = otsDesdeCacheParaUbicacion(result.value);
        setLocOTs({ orders: c.orders, name: c.name, loading: false, locId: result.value, error: false, offline: true });
      }
      return;
    }

    // Tipo 'asset' — buscar OTs del activo via backend (service role, sin RLS).
    // Reusa el mismo modal de lista que las ubicaciones (LocationOTListModal).
    if (result.type === 'asset') {
      setLocOTs({ orders: [], name: 'Cargando…', loading: true, locId: null, assetId: result.value, error: false });
      try {
        const res = await base44.functions.invoke('publicFichar', {
          action: 'getWorkOrdersForAsset',
          assetId: result.value,
        });
        const data = res.data || {};
        setLocOTs({ orders: data.workOrders || [], name: data.assetName || 'Activo', loading: false, assetId: result.value, error: false });
      } catch {
        setLocOTs({ orders: [], name: 'Activo', loading: false, assetId: result.value, error: true });
      }
      return;
    }

    // Tipo 'ot' o 'raw' (ID crudo) — buscar la OT via backend (service role) para evitar RLS
    const otId = result.value;
    if (!otId) {
      toast.error('Código QR no reconocido');
      return;
    }

    const loadingToast = toast.loading('Buscando orden de trabajo…');
    try {
      // 1) Intentar como OT por ID directo
      const res = await base44.functions.invoke('publicFichar', {
        action: 'getWorkOrder',
        workOrderId: otId,
      });
      const foundOT = res.data?.workOrder;
      if (foundOT) {
        toast.dismiss(loadingToast);
        actOnOT(foundOT);
        return;
      }

      // 2) No encontrada por ID — si era 'raw' o 'ot', intentar como ubicación
      const locRes = await base44.functions.invoke('publicFichar', {
        action: 'getWorkOrderForLocation',
        locationId: otId,
      });
      const orders = locRes.data?.workOrders || [];
      toast.dismiss(loadingToast);
      if (orders.length > 0) {
        setLocOTs({ orders, name: locRes.data.locationName || 'Ubicación escaneada' });
      } else {
        toast.error('No se encontró ninguna OT ni ubicación con ese código QR');
      }
    } catch {
      toast.dismiss(loadingToast);
      toast.error('Error al buscar la OT');
    }
  };

  const handleRetryLoc = async () => {
    if (locOTs?.assetId) {
      const assetId = locOTs.assetId;
      setLocOTs({ orders: [], name: 'Cargando…', loading: true, assetId, error: false });
      try {
        const res = await base44.functions.invoke('publicFichar', { action: 'getWorkOrdersForAsset', assetId });
        const data = res.data || {};
        setLocOTs({ orders: data.workOrders || [], name: data.assetName || 'Activo', loading: false, assetId, error: false });
      } catch {
        setLocOTs({ orders: [], name: 'Activo', loading: false, assetId, error: true });
      }
      return;
    }
    if (!locOTs?.locId) return;
    const locId = locOTs.locId;
    setLocOTs({ orders: [], name: 'Cargando…', loading: true, locId, error: false });
    try {
      const res = await base44.functions.invoke('publicFichar', { action: 'getWorkOrderForLocation', locationId: locId });
      const data = res.data || {};
      setLocOTs({ orders: data.workOrders || [], name: data.locationName || 'Ubicación escaneada', loading: false, locId, error: false });
    } catch {
      setLocOTs({ orders: [], name: 'Ubicación escaneada', loading: false, locId, error: true });
    }
  };

  // Lógica de decisión delegada a workOrderActions — single source of truth
  // compartida con el portal público. canActOn evalúa estado + propiedad.
  const resolveAction = (ot) =>
    canActOn(ot, { userId: currentUser?.id, displayName });

  // Devuelve true si abrió un diálogo (accionable), false si solo notificó.
  // El modal de ubicación se cierra solo si abrió algo — si no, queda abierto
  // con el toast visible explicando por qué, evitando el "se sale todo y ya".
  const actOnOT = (foundOT) => {
    const action = canActOn(foundOT, { userId: currentUser?.id, displayName });
    if (!action.canAct) {
      if (foundOT.status === 'pendiente_validacion') {
        toast.info('Esta OT ya está enviada al jefe para validación');
      } else if (foundOT.status === 'en_progreso') {
        toast.info('Esta OT la está trabajando otro operario');
      } else {
        toast.info(`La OT "${foundOT.title}" está ${foundOT.status}`);
      }
      return false;
    }
    if (foundOT.status === 'en_progreso') {
      setReporteOT(foundOT);
    } else {
      setConfirmAction({ ot: foundOT, accion: 'iniciar' });
    }
    return true;
  };

  // Skeleton shimmer solo en la primera carga real (sin data previa en cache).
  // Con initialData, las cargas siguientes muestran las OTs cacheadas de inmediato.
  if (isFetching && allOTs.length === 0) {
    return (
      <div className="min-h-screen flex flex-col gap-5 page-enter">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl skeleton" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-56 rounded skeleton" />
            <div className="h-3 w-40 rounded skeleton" />
          </div>
          <div className="h-11 w-11 rounded-xl skeleton" />
        </div>
        <div className="h-11 rounded-xl skeleton" />
        <div className="h-14 rounded-xl skeleton" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 rounded-xl skeleton" style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col gap-5 page-enter">

      {/* Banner offline / pendientes de sync */}
      {(!isOnline || pendingCount > 0) && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-medium px-3 py-2">
          {syncing ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <WifiOff className="h-4 w-4 shrink-0" />}
          {syncing
            ? `Sincronizando ${pendingCount} acción(es) pendiente(s)...`
            : !isOnline
              ? `Sin conexión — trabajando con cache. ${pendingCount > 0 ? `${pendingCount} acción(es) esperando sincronizar.` : 'Tus OTs se guardan y se envían al volver online.'}`
              : `${pendingCount} acción(es) pendiente(s) de sincronizar.`}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-[#3b82f6] to-[#6366f1] flex items-center justify-center shadow-lg shadow-blue-500/20">
          <ClipboardList className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-white">Mis Órdenes de Trabajo</h1>
          <p className="text-xs text-slate-400 tabular-nums">{displayName} · <CountUp value={misOTs.length} /> activa{misOTs.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setScannerOpen(true)}
          className="h-11 w-11 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] flex items-center justify-center transition-colors shrink-0 shadow-lg shadow-blue-500/20"
          title="Escanear QR"
        >
          <ScanLine className="h-5 w-5 text-white" />
        </button>
      </div>

      {/* Stepper — carril de fases */}
      <div className="flex items-center gap-1 bg-[#111827] rounded-xl p-2 border border-white/5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.key}>
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg shrink-0">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color, boxShadow: `0 0 8px ${s.color}80` }} />
              <span className="text-xs font-medium text-slate-300 whitespace-nowrap">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-slate-600 shrink-0" />}
          </React.Fragment>
        ))}
      </div>

      {/* Filtros + toggle Activas/Historial */}
      <MisOrdenesFiltros
        filtros={filtros}
        onChange={setFiltros}
        onLimpiar={limpiarFiltros}
        vista={vista}
        onVistaChange={setVista}
        counts={{ activas: misOTs.length, historial: historial.length }}
      />

      {vista === 'historial' ? (
        <div>
          {historialFiltrado.length > 0 ? (
            <motion.div
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.04 } } }}
            >
              {historialFiltrado.map(ot => (
                <motion.div key={ot.id} variants={cardVariants}>
                  <HistorialCard ot={ot} />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-500">
              <History className="h-12 w-12 text-slate-700" />
              <p className="text-sm font-medium">
                {historial.length === 0 ? 'Todavía no completaste ninguna orden' : 'Ninguna orden coincide con los filtros'}
              </p>
              {historial.length > 0 && (
                <button onClick={limpiarFiltros} className="text-xs text-primary hover:underline">
                  Limpiar filtros
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
      {/* SECCIÓN 1: En progreso (prioridad — el operario debe terminar lo que empezó) */}
      {enProgreso.length > 0 && (
        <Seccion titulo="En Progreso" subtitulo="Terminá estas antes de empezar nuevas" icon={Clock} color="sky">
          {enProgreso.map(ot => (
            <OTCard
              key={ot.id}
              ot={ot}
              processing={processing === ot.id}
              onIniciar={undefined}
              onFinalizar={() => setReporteOT(ot)}
              pendingSync={pendingOtIds.has(ot.id)}
            />
          ))}
        </Seccion>
      )}

      {/* SECCIÓN 2: Por iniciar */}
      {porIniciar.length > 0 && (
        <Seccion titulo="Para Empezar" subtitulo="Tocá Iniciar cuando llegues al sitio" icon={Play} color="blue">
          {porIniciar.map(ot => (
            <OTCard
              key={ot.id}
              ot={ot}
              processing={processing === ot.id}
              onIniciar={() => setConfirmAction({ ot, accion: 'iniciar' })}
              onFinalizar={undefined}
              pendingSync={pendingOtIds.has(ot.id)}
            />
          ))}
        </Seccion>
      )}

      {/* SECCIÓN 3: En validación (solo lectura) */}
      {enValidacion.length > 0 && (
        <Seccion titulo="Enviadas al Jefe" subtitulo="Esperando validación del Jefe de Sitio" icon={Lock} color="amber">
          {enValidacion.map(ot => (
            <OTCard key={ot.id} ot={ot} processing={false} locked />
          ))}
        </Seccion>
      )}

      {/* Empty state */}
      {misOTsFiltradas.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-500">
          <CheckCircle2 className="h-12 w-12 text-slate-700" />
          <p className="text-sm font-medium">
            {misOTs.length === 0 ? 'No tenés órdenes asignadas' : 'Ninguna orden coincide con los filtros'}
          </p>
          {misOTs.length > 0 && (
            <button onClick={limpiarFiltros} className="text-xs text-primary hover:underline">
              Limpiar filtros
            </button>
          )}
        </div>
      )}
      </>
      )}

      {/* Formulario de reporte */}
      {reporteOT && (
        <ReporteForm
          ot={reporteOT}
          onClose={() => setReporteOT(null)}
          onSaved={(reporteData) => handleReporteSaved(reporteOT, reporteData)}
        />
      )}

      {/* Confirmación de acción */}
      {confirmAction && (
        <ConfirmDialog
          ot={confirmAction.ot}
          accion={confirmAction.accion}
          onConfirm={() => {
            if (confirmAction.accion === 'iniciar') handleIniciar(confirmAction.ot);
          }}
          onCancel={() => setConfirmAction(null)}
          processing={processing === confirmAction.ot.id}
          offline={!isOnline}
        />
      )}

      {/* Lista de OTs de una ubicación escaneada */}
      {locOTs && (
        <LocationOTListModal
          open={!!locOTs}
          onClose={() => setLocOTs(null)}
          orders={locOTs.orders}
          locationName={locOTs.name}
          loading={locOTs.loading}
          error={locOTs.error}
          offline={locOTs.offline}
          onRetry={handleRetryLoc}
          onScanAnother={() => setScannerOpen(true)}
          onSelect={(ot) => { if (actOnOT(ot)) setLocOTs(null); }}
          resolveAction={resolveAction}
        />
      )}

      {/* Escáner QR — renderado después para que quede por encima del modal de ubicación */}
      <QRScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onResult={handleQRScan}
      />
    </div>
  );
}

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } },
};

function Seccion({ titulo, subtitulo, icon: Icon, color, children }) {
  const colorHex = { blue: '#3b82f6', sky: '#0ea5e9', amber: '#f59e0b' }[color] || '#3b82f6';
  const count = React.Children.count(children);
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-2.5">
        <span className="h-7 w-1 rounded-full" style={{ backgroundColor: colorHex }} />
        <Icon className="h-4 w-4" style={{ color: colorHex }} />
        <h2 className="text-sm font-bold text-white">{titulo}</h2>
        <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-white/5 text-slate-400 tabular-nums"><CountUp value={count} /></span>
        <span className="text-xs text-slate-500 truncate">· {subtitulo}</span>
      </div>
      <motion.div
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.05 } } }}
      >
        {React.Children.map(children, (child) => (
          <motion.div variants={cardVariants}>{child}</motion.div>
        ))}
      </motion.div>
    </div>
  );
}

const STATUS_BADGE = {
  pendiente:   { label: 'Pendiente',   cls: 'bg-blue-400/10 text-blue-400 border-blue-400/20' },
  asignada:    { label: 'Asignada',    cls: 'bg-blue-400/10 text-blue-400 border-blue-400/20' },
  en_progreso: { label: 'En Progreso', cls: 'bg-sky-400/10 text-sky-400 border-sky-400/20' },
  pendiente_validacion: { label: 'En Validación', cls: 'bg-amber-400/10 text-amber-400 border-amber-400/20' },
  completada: { label: 'Completada', cls: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' },
  cancelada:  { label: 'Cancelada',  cls: 'bg-red-400/10 text-red-400 border-red-400/20' },
};

// Riel de color por fase (Status Lane)
const LANE = {
  pendiente: '#3b82f6',
  asignada: '#3b82f6',
  en_progreso: '#0ea5e9',
  pendiente_validacion: '#f59e0b',
  completada: '#10b981',
  cancelada: '#ef4444',
};

const PRIORITY = {
  urgente: { label: 'Urgente', cls: 'bg-orange-500 text-white' },
  alta:    { label: 'Alta',    cls: 'bg-red-500/80 text-white' },
  media:   { label: 'Media',   cls: 'bg-slate-600 text-white' },
  baja:    { label: 'Baja',    cls: 'bg-slate-700 text-slate-300' },
};

const TYPE_LABEL = {
  mantenimiento_preventivo: 'Mant. Preventivo',
  mantenimiento_correctivo: 'Mant. Correctivo',
  instalacion: 'Instalación',
  inspeccion: 'Inspección',
  reparacion: 'Reparación',
  emergencia: 'Emergencia',
};

const STEPS = [
  { key: 'asignada', label: 'Asignada', color: '#3b82f6' },
  { key: 'en_progreso', label: 'En Progreso', color: '#0ea5e9' },
  { key: 'validacion', label: 'Validación', color: '#f59e0b' },
  { key: 'completada', label: 'Completada', color: '#10b981' },
];

function OTCard({ ot, onIniciar, onFinalizar, processing, locked, pendingSync }) {
  const badge = STATUS_BADGE[ot.status] || STATUS_BADGE.pendiente;
  const rail = LANE[ot.status] || '#3b82f6';
  const prio = PRIORITY[ot.priority];

  return (
    <div className="relative bg-[#1a2333] border border-white/5 rounded-xl pl-5 pr-4 py-4 flex flex-col gap-3 overflow-hidden card-lift">
      {/* Riel de color por fase */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: rail }} />

      {/* Badge de estado + chip de prioridad + pendiente de sync */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.cls}`}>
            {badge.label}
          </span>
          {pendingSync && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <WifiOff className="h-2.5 w-2.5" /> Pendiente sync
            </span>
          )}
        </div>
        {prio && (
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${prio.cls}`}>
            {prio.label}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-white leading-snug">{ot.title}</h3>
        {(TYPE_LABEL[ot.type] || ot.code) && (
          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
            {TYPE_LABEL[ot.type] && <span className="font-medium text-slate-400">{TYPE_LABEL[ot.type]}</span>}
            {ot.code && <span className="tabular-nums">· {ot.code}</span>}
          </div>
        )}
        {ot.location && (
          <div className="flex items-center gap-1 text-xs text-slate-400 mt-1.5">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{ot.location}</span>
          </div>
        )}
        {ot.rechazo_comentario && (
          <div className="mt-2 bg-red-500/10 border border-red-500/20 rounded-lg p-2">
            <p className="text-[10px] font-semibold text-red-400 uppercase">Rechazada por el Jefe:</p>
            <p className="text-xs text-red-300 mt-0.5">{ot.rechazo_comentario}</p>
          </div>
        )}
      </div>

      {/* Acción según el estado */}
      <div className="mt-auto">
        {locked ? (
          <div className="flex items-center justify-center gap-2 h-11 rounded-lg bg-white/5 border border-white/10 text-slate-500 text-sm font-medium">
            <Lock className="h-4 w-4" />
            Esperando validación
          </div>
        ) : onIniciar ? (
          <button
            onClick={onIniciar}
            disabled={processing}
            className="w-full h-11 rounded-lg bg-[#2563eb] text-white text-sm font-bold hover:bg-[#1d4ed8] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {processing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
            Iniciar
          </button>
        ) : onFinalizar ? (
          <button
            onClick={onFinalizar}
            disabled={processing}
            className="w-full h-11 rounded-lg bg-[#059669] text-white text-sm font-bold hover:bg-[#047857] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {processing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Flag className="h-5 w-5" />}
            Finalizar y Reportar
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ConfirmDialog({ ot, accion, onConfirm, onCancel, processing, offline }) {
  const textos = {
    iniciar: {
      titulo: '¿Iniciar orden de trabajo?',
      cuerpo: 'Se registrará tu ubicación GPS y la hora de inicio. No podrás deshacer esta acción.',
      boton: 'Sí, Iniciar',
    },
  };
  const t = textos[accion] || textos.iniciar;

  return (
    <BodyPortal>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-5">
        <h3 className="text-base font-bold text-white mb-2">{t.titulo}</h3>
        <p className="text-sm text-slate-400 mb-1">{t.cuerpo}</p>
        <p className="text-sm font-medium text-white mb-4 truncate">"{ot.title}"</p>
        {offline && (
          <p className="text-xs text-amber-400 mb-3 flex items-center gap-1.5">
            <WifiOff className="h-3.5 w-3.5" />
            Sin conexión: la acción se guardará y se sincronizará al volver online.
          </p>
        )}
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={processing}
            className="flex-1 h-11 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={processing}
            className="flex-1 h-11 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : t.boton}
          </button>
        </div>
      </div>
    </div>
    </BodyPortal>
  );
}

const formatFecha = (d) => {
  try {
    if (!d) return '';
    return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return d || '';
  }
};

function HistorialCard({ ot }) {
  const badge = STATUS_BADGE[ot.status] || STATUS_BADGE.completada;
  const rail = LANE[ot.status] || '#10b981';
  return (
    <div className="relative bg-[#1a2333] border border-white/5 rounded-xl pl-5 pr-4 py-4 flex flex-col gap-2 overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: rail }} />
      <div className="flex items-center justify-between gap-2">
        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.cls}`}>
          {badge.label}
        </span>
        {ot.completed_date && (
          <span className="text-[11px] text-slate-500 tabular-nums">{formatFecha(ot.completed_date)}</span>
        )}
      </div>
      <h3 className="text-sm font-semibold text-white leading-snug">{ot.title}</h3>
      {ot.location && (
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <MapPin className="h-3 w-3" />
          <span className="truncate">{ot.location}</span>
        </div>
      )}
      {ot.validado_por && (
        <p className="text-[11px] text-slate-500">Validado por {ot.validado_por}</p>
      )}
    </div>
  );
}