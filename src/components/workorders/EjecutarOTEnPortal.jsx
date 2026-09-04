/**
 * Pantalla de ejecución de una OT dentro del portal operario.
 * Reutilizable: recibe order + callbacks, sin routing propio.
 *
 * Flujo híbrido (decideSteps):
 *  - 1 paso (sin checklist ni fotos obligatorias): "Finalizar y Enviar" hace
 *    iniciar+finalizar en secuencia (el operario ve una sola acción).
 *  - 2 pasos (con checklist o require_photos): "Iniciar" primero (GPS +
 *    operario_sesion), luego "Finalizar y Reportar" (valida propiedad).
 *
 * Toda mutación pasa por transicionEstadoOT con auth_mode='portal' — mismo
 * motor de estados y validaciones que el módulo autenticado.
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import {
  CheckCircle2, Loader2, Camera, X, ChevronDown, ChevronUp, ArrowLeft,
  MapPin, FileText, Image as ImageIcon, AlertTriangle, Play, Flag
} from 'lucide-react';
import { useGeolocalizacion } from '@/hooks/useGeolocalizacion';
import { useOperarioClave } from '@/hooks/useOperarioClave';
import OperarioClavePrompt from '@/components/operario/OperarioClavePrompt';
import { decideSteps } from '@/lib/workOrderActions';
import { getClave, getNombre } from '@/lib/operarioClave';

const callFn = async (payload) => {
  const res = await base44.functions.invoke('publicFichar', payload);
  return res.data;
};

const PRIORITY_STYLE = {
  baja:    { chip: 'bg-slate-500/15 text-slate-300 border-slate-500/25', label: 'Baja' },
  media:   { chip: 'bg-blue-500/15 text-blue-300 border-blue-500/25',   label: 'Media' },
  alta:    { chip: 'bg-orange-500/15 text-orange-300 border-orange-500/25', label: 'Alta' },
  urgente: { chip: 'bg-red-500/15 text-red-300 border-red-500/25',     label: '🚨 URGENTE' },
};

function FotoUploader({ photos, onAdd, onRemove }) {
  const fileRef = React.useRef();
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const reader = new FileReader();
      await new Promise((resolve) => {
        reader.onloadend = async () => {
          const base64 = reader.result.split(',')[1];
          const res = await callFn({ action: 'uploadFile', fileBase64: base64, fileName: file.name, mimeType: file.type });
          onAdd(res.file_url);
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }
    setUploading(false);
  };

  return (
    <div className="space-y-3">
      {photos.length > 0 && (
        <motion.div
          className="grid grid-cols-3 gap-2"
          initial="hidden" animate="show"
          variants={{ show: { transition: { staggerChildren: 0.04 } } }}
        >
          {photos.map((url, idx) => (
            <motion.div
              key={idx}
              variants={{ hidden: { opacity: 0, scale: 0.9 }, show: { opacity: 1, scale: 1 } }}
              className="relative aspect-square rounded-xl overflow-hidden border-2 border-border group"
            >
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => onRemove(idx)}
                className="absolute top-1 right-1 h-7 w-7 rounded-full bg-black/70 text-white flex items-center justify-center backdrop-blur-sm active:scale-90 transition"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </motion.div>
      )}
      <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={e => handleFiles(e.target.files)} />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="w-full h-16 rounded-2xl border-2 border-dashed border-border bg-card/40 active:bg-card/60 flex items-center justify-center gap-3 text-foreground font-bold text-base transition-colors disabled:opacity-50"
      >
        {uploading
          ? <><Loader2 className="h-5 w-5 animate-spin text-primary" /> Subiendo...</>
          : <><Camera className="h-6 w-6 text-primary" /> {photos.length > 0 ? 'Agregar otra foto' : 'Sacar foto'}</>
        }
      </button>
    </div>
  );
}

export default function EjecutarOTEnPortal({ order, locationName, onBack, onCompleted, isOnline = true, onQueueOffline }) {
  const [photos, setPhotos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showDesc, setShowDesc] = useState(true);
  const [gpsStatus, setGpsStatus] = useState(null);
  const [otStarted, setOtStarted] = useState(order.status === 'en_progreso');
  const { capturar } = useGeolocalizacion();
  const { promptOpen: clavePromptOpen, requireClave, onPromptSuccess, onPromptClose } = useOperarioClave();
  const offline = !isOnline;

  const steps = decideSteps(order);
  const isAlreadyInProgress = order.status === 'en_progreso';
  // 2-pasos: necesita iniciar primero si no está en_progreso.
  const needsStart = (steps === 'two' || isAlreadyInProgress === false) && !isAlreadyInProgress;
  // Si la OT está en_progreso, siempre va a "Finalizar" sin importar steps.
  const showStartButton = needsStart && !otStarted && steps === 'two';

  const runTransition = async (accion, extraData = {}) => {
    const clave = getClave();
    const operario_sesion = getNombre();
    const res = await base44.functions.invoke('transicionEstadoOT', {
      ot_id: order.id,
      accion,
      extra_data: extraData,
      auth_mode: 'portal',
      operario_password: clave,
      operario_sesion,
    });
    return res.data;
  };

  const handleIniciar = () => {
    requireClave(async (clave) => {
      setSaving(true);
      setGpsStatus('capturando');
      try {
        const gpsData = await capturar();
        setGpsStatus(gpsData.gps_status);
        const operario_sesion = getNombre();
        const extraData = { operario_sesion };
        if (gpsData.gps_status === 'capturado') {
          extraData.gps = { latitude: gpsData.gps_latitude, longitude: gpsData.gps_longitude, accuracy: gpsData.gps_accuracy };
        } else {
          extraData.gps_status = gpsData.gps_status;
        }

        if (offline && onQueueOffline) {
          const optimistic = { ...order, status: 'en_progreso', operario_sesion, assigned_name: operario_sesion, fecha_inicio_real: new Date().toISOString(), _pending_sync: true };
          onQueueOffline(order, 'iniciar', extraData, optimistic);
          setOtStarted(true);
          if (onCompleted) onCompleted(optimistic);
          return;
        }

        const res = await runTransition('iniciar', extraData);
        if (res.error) { setGpsStatus(null); return; }
        setOtStarted(true);
        if (onCompleted && res.ot) onCompleted(res.ot);
      } catch (err) {
        setGpsStatus('no_disponible');
      } finally {
        setSaving(false);
      }
    });
  };

  const handleFinalizar = () => {
    requireClave(async (clave) => {
      setSaving(true);
      setGpsStatus('capturando');
      try {
        const gpsData = await capturar();
        setGpsStatus(gpsData.gps_status);
        const extraData = {};
        if (gpsData.gps_status === 'capturado') {
          extraData.gps = { latitude: gpsData.gps_latitude, longitude: gpsData.gps_longitude, accuracy: gpsData.gps_accuracy };
        } else {
          extraData.gps_status = gpsData.gps_status;
        }
        if (photos.length > 0) {
          extraData.photos = [...(order.photos || []), ...photos];
        }

        // 1-paso: si la OT no fue iniciada todavía, iniciar+finalizar en secuencia.
        if (!otStarted && !isAlreadyInProgress) {
          if (offline && onQueueOffline) {
            const optimisticInit = { ...order, status: 'en_progreso', operario_sesion: getNombre(), assigned_name: getNombre(), fecha_inicio_real: new Date().toISOString(), _pending_sync: true };
            onQueueOffline(order, 'iniciar', { ...extraData, operario_sesion: getNombre() }, optimisticInit);
          } else {
            const initRes = await runTransition('iniciar', { ...extraData, operario_sesion: getNombre() });
            if (initRes.error) { setGpsStatus(null); return; }
          }
        }

        if (offline && onQueueOffline) {
          const optimistic = { ...order, status: 'pendiente_validacion', ...extraData, _pending_sync: true };
          onQueueOffline(order, 'finalizar', extraData, optimistic);
          if (onCompleted) onCompleted(optimistic);
          return;
        }

        const res = await runTransition('finalizar', extraData);
        if (res.error) { setGpsStatus(null); return; }
        if (onCompleted && res.ot) onCompleted(res.ot);
      } catch (err) {
        setGpsStatus('no_disponible');
      } finally {
        setSaving(false);
      }
    });
  };

  const pr = PRIORITY_STYLE[order.priority] || PRIORITY_STYLE.media;
  const isUrgente = order.priority === 'urgente';
  const needsPhoto = order.require_photos && photos.length === 0;
  const hasDesc = !!order.description;
  const hasRefPhotos = order.photos?.length > 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className={`${isUrgente ? 'bg-gradient-to-br from-red-600 to-rose-600' : 'bg-gradient-to-br from-primary to-indigo-600'} px-5 pb-6 relative overflow-hidden`}>
        <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
        <div className="relative max-w-md mx-auto"
          style={{ paddingTop: 'max(2.5rem, env(safe-area-inset-top))' }}>
          <button onClick={onBack} className="flex items-center gap-2 text-white/70 text-sm mb-4 active:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" /> Volver a la lista
          </button>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold mb-3 border bg-white/15 border-white/20 text-white backdrop-blur-sm`}>
            {pr.label}
          </span>
          <h1 className="text-white font-bold text-2xl leading-snug">{order.title}</h1>
          {locationName && <p className="text-white/70 text-sm mt-1.5 flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {locationName}</p>}
          {otStarted && (
            <span className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> En progreso
            </span>
          )}
        </div>
      </div>

      {/* Cuerpo */}
      <div className="flex-1 px-4 py-5 max-w-md mx-auto w-full space-y-4">
        {hasDesc && (
          <div className="rounded-2xl border border-border overflow-hidden bg-card">
            <button
              onClick={() => setShowDesc(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3.5 font-bold text-sm text-foreground active:bg-card/60 transition-colors"
            >
              <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Instrucciones</span>
              {showDesc ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {showDesc && (
              <div className="px-4 pb-4 pt-1 border-t border-border/50">
                <p className="text-muted-foreground text-base leading-relaxed whitespace-pre-wrap">{order.description}</p>
              </div>
            )}
          </div>
        )}

        {hasRefPhotos && (
          <div className="rounded-2xl border border-border p-4 bg-card">
            <p className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-primary" /> Fotos de referencia
            </p>
            <div className="grid grid-cols-2 gap-2">
              {order.photos.map((url, idx) => (
                <div key={idx} className="aspect-video rounded-xl overflow-hidden border border-border/50">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Checklist display (2-pasos con checklist) */}
        {order.checklist?.length > 0 && (
          <div className="rounded-2xl border border-border p-4 bg-card">
            <p className="font-bold text-sm text-foreground mb-3">Tareas del checklist</p>
            <div className="space-y-2">
              {order.checklist.map((task, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className={`h-4 w-4 mt-0.5 shrink-0 ${task.completed ? 'text-emerald-400' : 'text-muted-foreground/40'}`} />
                  <span className={task.completed ? 'text-muted-foreground line-through' : 'text-foreground'}>{task.task}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-border p-4 bg-card">
          <p className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
            <Camera className="h-4 w-4 text-primary" />
            Fotos del trabajo realizado{order.require_photos ? ' *' : ' (opcional)'}
          </p>
          <FotoUploader
            photos={photos}
            onAdd={url => setPhotos(prev => [...prev, url])}
            onRemove={idx => setPhotos(prev => prev.filter((_, i) => i !== idx))}
          />
        </div>
      </div>

      {/* Botón fijo */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border px-4 py-4"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <div className="max-w-md mx-auto">
          {needsPhoto && (
            <motion.p
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="text-center text-sm text-orange-400 font-medium mb-3 flex items-center justify-center gap-1.5"
            >
              <AlertTriangle className="h-4 w-4" /> Esta OT requiere al menos una foto
            </motion.p>
          )}
          {gpsStatus === 'capturando' && (
            <p className="text-center text-sm text-primary font-medium mb-3 flex items-center justify-center gap-1.5">
              <MapPin className="h-4 w-4 animate-pulse" /> Obteniendo ubicación GPS...
            </p>
          )}
          {gpsStatus === 'denegado' && (
            <p className="text-center text-xs text-muted-foreground mb-2 flex items-center justify-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> Sin GPS — se guardará sin ubicación
            </p>
          )}
          {gpsStatus === 'capturado' && (
            <p className="text-center text-xs text-emerald-400 mb-2 flex items-center justify-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> Ubicación capturada
            </p>
          )}

          {/* Botón según fase del flujo híbrido */}
          {showStartButton ? (
            <button
              onClick={handleIniciar}
              disabled={saving}
              className="w-full h-16 rounded-2xl bg-blue-600 disabled:bg-muted disabled:text-muted-foreground text-white font-bold text-xl flex items-center justify-center gap-3 shadow-lg shadow-blue-600/30 active:scale-[0.98] transition-all"
            >
              {saving
                ? <><Loader2 className="h-6 w-6 animate-spin" /> Iniciando...</>
                : <><Play className="h-7 w-7" /> Iniciar Orden</>
              }
            </button>
          ) : (
            <button
              onClick={handleFinalizar}
              disabled={saving || needsPhoto}
              className="w-full h-16 rounded-2xl bg-emerald-500 disabled:bg-muted disabled:text-muted-foreground text-white font-bold text-xl flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/30 active:scale-[0.98] transition-all"
            >
              {saving
                ? <><Loader2 className="h-6 w-6 animate-spin" /> {gpsStatus === 'capturando' ? 'Localizando...' : 'Guardando...'}</>
                : <><Flag className="h-7 w-7" /> {otStarted || isAlreadyInProgress ? 'Finalizar y Enviar' : 'Finalizar y Enviar al Jefe'}</>
              }
            </button>
          )}
        </div>
      </div>

      {clavePromptOpen && (
        <OperarioClavePrompt onSuccess={onPromptSuccess} onClose={onPromptClose} />
      )}
    </div>
  );
}