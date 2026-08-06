import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useGeolocalizacion } from '@/hooks/useGeolocalizacion';
import { Loader2, ClipboardList, MapPin, Play, Flag, Lock, Clock, CheckCircle2, ArrowRight, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import ReporteForm from '@/components/operario/ReporteForm';
import QRScannerModal from '@/components/operario/QRScannerModal';
import LocationOTListModal from '@/components/operario/LocationOTListModal';

export default function PortalOperarioApp() {
  const { currentUser, displayName } = useCurrentUser();
  const [reporteOT, setReporteOT] = useState(null);
  const [processing, setProcessing] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // { ot, accion }
  const [scannerOpen, setScannerOpen] = useState(false);
  const [locOTs, setLocOTs] = useState(null); // { orders, name } cuando se escanea un QR de ubicación
  const { capturar } = useGeolocalizacion();
  const queryClient = useQueryClient();

  const { data: allOTs = [], isLoading } = useQuery({
    queryKey: ['workorders-operario'],
    queryFn: () => base44.functions.invoke('getWorkOrdersForUser', {})
              .then(r => r.data?.orders || []),
    staleTime: 1000 * 60 * 5,
  });

  const misOTs = useMemo(() => {
    // La identidad la resuelve el backend (getWorkOrdersForUser, service-role).
    // Acá solo descartamos estados terminales.
    return allOTs.filter(ot => ot.status !== 'cancelada' && ot.status !== 'completada');
  }, [allOTs]);

  // Separar por fase del flujo
  const { porIniciar, enProgreso, enValidacion } = useMemo(() => {
    const ini = [], prog = [], val = [];
    for (const ot of misOTs) {
      if (ot.status === 'pendiente_validacion') val.push(ot);
      else       if (ot.status === 'en_progreso') prog.push(ot);
      else ini.push(ot); // pendiente, asignada
    }
    return { porIniciar: ini, enProgreso: prog, enValidacion: val };
  }, [misOTs]);

  const ejecutarTransicion = async (ot, accion, extraData = {}) => {
    setProcessing(ot.id);
    try {
      const res = await base44.functions.invoke('transicionEstadoOT', {
        ot_id: ot.id,
        accion,
        extra_data: extraData,
      });
      toast.success(res.data.mensaje);
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
    // Capturar GPS antes de enviar
    const gps = await capturar();
    const extraData = {};
    if (gps.gps_status === 'capturado') {
      extraData.gps = { latitude: gps.gps_latitude, longitude: gps.gps_longitude, accuracy: gps.gps_accuracy };
    } else {
      extraData.gps_status = gps.gps_status;
    }
    await ejecutarTransicion(ot, 'iniciar', extraData);
  };

  const handleReporteSaved = async (ot, reporteData) => {
    // El reporte ya guardó materiales; ahora transicionar a pendiente_validacion
    const ok = await ejecutarTransicion(ot, 'finalizar', reporteData);
    if (ok) setReporteOT(null);
  };

  const handleQRScan = async (result) => {
    // Nota: NO cerramos el scanner acá — el scanner se cierra solo tras 350ms
    // (mostrando el flash verde de "código detectado"). Si lo cerramos acá,
    // el flash nunca se ve y el feedback visual se pierde.

    // Tipo 'loc' — buscar OTs de la ubicación via backend (service role, sin RLS)
    if (result.type === 'loc') {
      setLocOTs({ orders: [], name: 'Cargando…', loading: true });
      try {
        const res = await base44.functions.invoke('publicFichar', {
          action: 'getWorkOrderForLocation',
          locationId: result.value,
        });
        const data = res.data || {};
        const orders = data.workOrders || [];
        if (orders.length === 0) {
          setLocOTs(null);
          toast.error('No hay OTs activas para esta ubicación');
        } else {
          setLocOTs({ orders, name: data.locationName || 'Ubicación escaneada' });
        }
      } catch {
        setLocOTs(null);
        toast.error('Error al buscar OTs de la ubicación');
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

  const actOnOT = (foundOT) => {
    if (foundOT.status === 'pendiente' || foundOT.status === 'asignada') {
      setConfirmAction({ ot: foundOT, accion: 'iniciar' });
    } else if (foundOT.status === 'en_progreso') {
      setReporteOT(foundOT);
    } else if (foundOT.status === 'pendiente_validacion') {
      toast.info('Esta OT ya está enviada al jefe para validación');
    } else {
      toast.info(`La OT "${foundOT.title}" está ${foundOT.status}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
          <ClipboardList className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-white">Mis Órdenes de Trabajo</h1>
          <p className="text-xs text-slate-400">{displayName} · {misOTs.length} activa{misOTs.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setScannerOpen(true)}
          className="h-11 w-11 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center hover:bg-primary/25 transition-colors shrink-0"
          title="Escanear QR"
        >
          <ScanLine className="h-5 w-5 text-primary" />
        </button>
      </div>

      {/* Stepper visual del flujo */}
      <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-900/40 rounded-lg p-2.5 border border-slate-800">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-400" /> Asignada</span>
        <ArrowRight className="h-3 w-3" />
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-400" /> En Progreso</span>
        <ArrowRight className="h-3 w-3" />
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" /> Validación</span>
        <ArrowRight className="h-3 w-3" />
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Completada</span>
      </div>

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
      {misOTs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-500">
          <CheckCircle2 className="h-12 w-12 text-slate-700" />
          <p className="text-sm font-medium">No tenés órdenes asignadas</p>
        </div>
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
        />
      )}

      {/* Escáner QR */}
      <QRScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onResult={handleQRScan}
      />

      {/* Lista de OTs de una ubicación escaneada */}
      {locOTs && (
        <LocationOTListModal
          open={!!locOTs}
          onClose={() => setLocOTs(null)}
          orders={locOTs.orders}
          locationName={locOTs.name}
          loading={locOTs.loading}
          onSelect={(ot) => { setLocOTs(null); actOnOT(ot); }}
        />
      )}
    </div>
  );
}

function Seccion({ titulo, subtitulo, icon: Icon, color, children }) {
  const colorMap = {
    blue:  'text-blue-400 border-blue-400/20',
    sky:   'text-sky-400 border-sky-400/20',
    amber: 'text-amber-400 border-amber-400/20',
  };
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${colorMap[color].split(' ')[0]}`} />
        <h2 className="text-sm font-bold text-white">{titulo}</h2>
        <span className="text-xs text-slate-500">· {subtitulo}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </div>
    </div>
  );
}

const STATUS_BADGE = {
  pendiente:   { label: 'Pendiente',   cls: 'bg-amber-400/10 text-amber-400 border-amber-400/20' },
  asignada:    { label: 'Asignada',    cls: 'bg-blue-400/10 text-blue-400 border-blue-400/20' },
  en_progreso: { label: 'En Progreso', cls: 'bg-sky-400/10 text-sky-400 border-sky-400/20' },
  pendiente_validacion: { label: 'En Validación', cls: 'bg-amber-400/10 text-amber-400 border-amber-400/20' },
};

function OTCard({ ot, onIniciar, onFinalizar, processing, locked }) {
  const badge = STATUS_BADGE[ot.status] || STATUS_BADGE.pendiente;

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
      <div>
        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.cls} mb-2`}>
          {badge.label}
        </span>
        <h3 className="text-sm font-semibold text-white leading-snug">{ot.title}</h3>
        {ot.location && (
          <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
            <MapPin className="h-3 w-3" />
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

      {/* Botón único grande según el estado */}
      <div className="mt-auto">
        {locked ? (
          <div className="flex items-center justify-center gap-2 h-12 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-500 text-sm font-medium">
            <Lock className="h-4 w-4" />
            Esperando validación
          </div>
        ) : onIniciar ? (
          <button
            onClick={onIniciar}
            disabled={processing}
            className="w-full h-12 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {processing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
            Iniciar
          </button>
        ) : onFinalizar ? (
          <button
            onClick={onFinalizar}
            disabled={processing}
            className="w-full h-12 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {processing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Flag className="h-5 w-5" />}
            Finalizar y Reportar
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ConfirmDialog({ ot, accion, onConfirm, onCancel, processing }) {
  const textos = {
    iniciar: {
      titulo: '¿Iniciar orden de trabajo?',
      cuerpo: 'Se registrará tu ubicación GPS y la hora de inicio. No podrás deshacer esta acción.',
      boton: 'Sí, Iniciar',
    },
  };
  const t = textos[accion] || textos.iniciar;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-5">
        <h3 className="text-base font-bold text-white mb-2">{t.titulo}</h3>
        <p className="text-sm text-slate-400 mb-1">{t.cuerpo}</p>
        <p className="text-sm font-medium text-white mb-4 truncate">"{ot.title}"</p>
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
  );
}