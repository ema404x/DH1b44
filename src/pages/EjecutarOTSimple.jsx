/**
 * Interfaz ultra-simple para operarios — acceso vía QR
 * Flujo: Ver instrucciones → Sacar fotos → Marcar completada
 */
import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, Loader2, AlertTriangle, Camera, X, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { useGeolocalizacion } from '@/hooks/useGeolocalizacion';

const callFn = async (payload) => {
  const res = await base44.functions.invoke('publicFichar', payload);
  return res.data;
};

const PRIORITY_STYLE = {
  baja:    { bg: 'bg-slate-100',  text: 'text-slate-700',  label: 'Baja' },
  media:   { bg: 'bg-blue-100',   text: 'text-blue-800',   label: 'Media' },
  alta:    { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Alta' },
  urgente: { bg: 'bg-red-100',    text: 'text-red-800',    label: '🚨 URGENTE' },
};

// ── Subcomponente: subir foto ───────────────────────────────────────────────

function FotoUploader({ photos, onAdd, onRemove }) {
  const fileRef = useRef();
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
        <div className="grid grid-cols-3 gap-2">
          {photos.map((url, idx) => (
            <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border-2 border-slate-200">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => onRemove(idx)}
                className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/70 text-white flex items-center justify-center"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={e => handleFiles(e.target.files)} />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="w-full h-16 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 active:bg-slate-100 flex items-center justify-center gap-3 text-slate-600 font-bold text-base transition-colors disabled:opacity-50"
      >
        {uploading
          ? <><Loader2 className="h-5 w-5 animate-spin" /> Subiendo...</>
          : <><Camera className="h-6 w-6" /> Sacar foto</>
        }
      </button>
    </div>
  );
}

// ── Componente principal ────────────────────────────────────────────────────

export default function EjecutarOTSimple() {
  const params = new URLSearchParams(window.location.search);
  const otId = params.get('ot');

  const [phase, setPhase] = useState('loading');
  const [order, setOrder] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showDesc, setShowDesc] = useState(true);
  const [gpsStatus, setGpsStatus] = useState(null); // null | 'capturando' | 'capturado' | 'denegado' | 'no_disponible'
  const { capturar } = useGeolocalizacion();

  useEffect(() => {
    if (!otId) { setPhase('not_found'); return; }
    callFn({ action: 'getWorkOrder', workOrderId: otId })
      .then(res => {
        const ot = res?.workOrder;
        if (!ot) { setPhase('not_found'); return; }
        if (['completada', 'cancelada'].includes(ot.status)) { setOrder(ot); setPhase('done'); return; }
        setOrder(ot);
        setPhase('work');
      })
      .catch(() => setPhase('not_found'));
  }, [otId]);

  const handleCompletar = async () => {
    setSaving(true);
    setGpsStatus('capturando');
    const gpsData = await capturar();
    setGpsStatus(gpsData.gps_status);
    await callFn({
      action: 'updateWorkOrder',
      workOrderId: otId,
      updates: {
        status: 'completada',
        completed_date: new Date().toISOString().split('T')[0],
        ...(photos.length > 0 && { photos }),
        ...gpsData,
      },
    });
    setPhase('done');
    setSaving(false);
  };

  // ── Loading ──
  if (phase === 'loading') return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <Loader2 className="h-12 w-12 text-white/30 animate-spin" />
    </div>
  );

  // ── No encontrada ──
  if (phase === 'not_found') return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-6">
      <div className="bg-white rounded-3xl p-8 max-w-xs w-full text-center">
        <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-8 w-8 text-red-500" />
        </div>
        <h2 className="font-bold text-xl mb-1">QR no válido</h2>
        <p className="text-slate-500 text-sm">No se encontró esta orden.</p>
      </div>
    </div>
  );

  // ── Completada ──
  if (phase === 'done') return (
    <div className="min-h-screen flex items-center justify-center bg-emerald-700 p-6">
      <div className="bg-white rounded-3xl p-8 max-w-xs w-full text-center">
        <div className="h-24 w-24 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="h-14 w-14 text-emerald-600" />
        </div>
        <h2 className="font-bold text-2xl mb-2">¡Listo!</h2>
        {order && <p className="font-semibold text-slate-700 text-sm mb-3">{order.title}</p>}
        <p className="text-slate-500 text-sm">La orden fue marcada como completada.</p>
        <p className="text-slate-400 text-xs mt-3">Podés cerrar esta pantalla.</p>
      </div>
    </div>
  );

  // ── Vista de trabajo ──
  const pr = PRIORITY_STYLE[order.priority] || PRIORITY_STYLE.media;
  const isUrgente = order.priority === 'urgente';
  const needsPhoto = order.require_photos && photos.length === 0;

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* Banda superior de color según urgencia */}
      <div className={`${isUrgente ? 'bg-red-600' : 'bg-slate-800'} pt-safe px-5 pt-8 pb-6`}>
        <div className="max-w-md mx-auto">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold mb-3 ${pr.bg} ${pr.text}`}>
            {pr.label}
          </span>
          <h1 className="text-white font-bold text-2xl leading-snug">{order.title}</h1>
          {(order.location_qr_name || order.location) && (
            <p className="text-white/60 text-sm mt-2">📍 {order.location_qr_name || order.location}</p>
          )}
        </div>
      </div>

      {/* Cuerpo */}
      <div className="flex-1 px-4 py-5 max-w-md mx-auto w-full space-y-4">

        {/* Instrucciones */}
        {order.description && (
          <div className="rounded-2xl border border-slate-200 overflow-hidden">
            <button
              onClick={() => setShowDesc(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 font-bold text-sm text-slate-700"
            >
              <span>📋 Instrucciones</span>
              {showDesc ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </button>
            {showDesc && (
              <div className="px-4 py-3">
                <p className="text-slate-700 text-base leading-relaxed whitespace-pre-wrap">{order.description}</p>
              </div>
            )}
          </div>
        )}

        {/* Fotos de referencia */}
        {order.photos?.length > 0 && (
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="font-bold text-sm text-slate-600 mb-3">📸 Fotos de referencia</p>
            <div className="grid grid-cols-2 gap-2">
              {order.photos.map((url, idx) => (
                <div key={idx} className="aspect-video rounded-xl overflow-hidden">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fotos del operario */}
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="font-bold text-sm text-slate-600 mb-3">
            📷 Fotos del trabajo realizado{order.require_photos ? ' *' : ' (opcional)'}
          </p>
          <FotoUploader
            photos={photos}
            onAdd={url => setPhotos(prev => [...prev, url])}
            onRemove={idx => setPhotos(prev => prev.filter((_, i) => i !== idx))}
          />
        </div>

      </div>

      {/* Botón fijo abajo */}
      <div className="sticky bottom-0 bg-white border-t border-slate-100 px-4 py-4 pb-safe">
        <div className="max-w-md mx-auto">
          {needsPhoto && (
            <p className="text-center text-sm text-orange-600 font-medium mb-3">
              ⚠️ Esta OT requiere al menos una foto
            </p>
          )}
          {gpsStatus === 'capturando' && (
            <p className="text-center text-sm text-blue-600 font-medium mb-3 flex items-center justify-center gap-1.5">
              <MapPin className="h-4 w-4 animate-pulse" /> Obteniendo ubicación GPS...
            </p>
          )}
          {gpsStatus === 'denegado' && (
            <p className="text-center text-xs text-slate-400 mb-2">📍 Sin GPS — se guardará sin ubicación</p>
          )}
          {gpsStatus === 'capturado' && (
            <p className="text-center text-xs text-emerald-600 mb-2 flex items-center justify-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> Ubicación capturada
            </p>
          )}
          <button
            onClick={handleCompletar}
            disabled={saving || needsPhoto}
            className="w-full h-16 rounded-2xl bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xl flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/30 active:scale-[0.98] transition-all"
          >
            {saving
              ? <><Loader2 className="h-6 w-6 animate-spin" /> {gpsStatus === 'capturando' ? 'Localizando...' : 'Guardando...'}</>
              : <><CheckCircle2 className="h-7 w-7" /> Marcar como Completada</>
            }
          </button>
        </div>
      </div>

    </div>
  );
}