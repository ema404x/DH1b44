/**
 * Página pública simplificada para que el operario ejecute una OT
 * Flujo: Ver instrucciones + fotos → Marcar como completada
 * Acceso: /ejecutar-ot-simple?ot=<workOrderId>
 */
import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import {
  CheckCircle2, Loader2, AlertTriangle, Wrench,
  MapPin, ClipboardList, Camera, X, Check
} from 'lucide-react';
import { toast } from 'sonner';

const callPublicFn = async (fnName, payload) => {
  const res = await base44.functions.invoke(fnName, payload);
  return res.data;
};

const priorityConfig = {
  baja:    { label: 'Baja',       color: 'bg-slate-100 text-slate-700' },
  media:   { label: 'Media',      color: 'bg-blue-100 text-blue-700' },
  alta:    { label: 'Alta',       color: 'bg-orange-100 text-orange-700' },
  urgente: { label: '🚨 URGENTE', color: 'bg-red-100 text-red-700' },
};

function FotoSubir({ photos, onAdd, onRemove }) {
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
          const res = await callPublicFn('publicFichar', {
            action: 'uploadFile', fileBase64: base64, fileName: file.name, mimeType: file.type
          });
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
        <div className="grid grid-cols-2 gap-2">
          {photos.map((url, idx) => (
            <div key={idx} className="relative aspect-video rounded-xl overflow-hidden border border-slate-200">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => onRemove(idx)}
                className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full bg-black/60 text-white flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={e => handleFiles(e.target.files)} />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="w-full h-14 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 flex items-center justify-center gap-2 text-slate-600 font-semibold transition-colors disabled:opacity-50"
      >
        {uploading ? <><Loader2 className="h-5 w-5 animate-spin" /> Subiendo...</> : <><Camera className="h-5 w-5" /> Agregar foto</>}
      </button>
    </div>
  );
}

export default function EjecutarOTSimple() {
  const params = new URLSearchParams(window.location.search);
  const otId = params.get('ot');

  const [phase, setPhase] = useState('loading'); // loading | work | done | not_found
  const [order, setOrder] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!otId) { setPhase('not_found'); return; }
    const load = async () => {
      try {
        const res = await callPublicFn('publicFichar', { action: 'getWorkOrder', workOrderId: otId });
        const ot = res?.workOrder;
        if (!ot) { setPhase('not_found'); return; }
        if (['completada', 'cancelada'].includes(ot.status)) { setOrder(ot); setPhase('done'); return; }
        setOrder(ot);
        setPhase('work');
      } catch {
        setPhase('not_found');
      }
    };
    load();
  }, [otId]);

  const handleCompletar = async () => {
    setSaving(true);
    try {
      await callPublicFn('publicFichar', {
        action: 'updateWorkOrder',
        workOrderId: otId,
        updates: {
          status: 'completada',
          completed_date: new Date().toISOString().split('T')[0],
          photos: photos.length > 0 ? photos : undefined,
        },
      });
      setPhase('done');
    } catch {
      toast.error('Error al guardar. Intentá de nuevo.');
    }
    setSaving(false);
  };

  // ── Loading ──
  if (phase === 'loading') return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="text-center">
        <Loader2 className="h-12 w-12 text-white/40 animate-spin mx-auto mb-4" />
        <p className="text-white/40">Cargando orden...</p>
      </div>
    </div>
  );

  // ── No encontrada ──
  if (phase === 'not_found') return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
        <div className="h-20 w-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-10 w-10 text-red-500" />
        </div>
        <h2 className="font-bold text-2xl mb-2">QR no válido</h2>
        <p className="text-slate-500 text-sm">No se encontró esta orden de trabajo.</p>
      </div>
    </div>
  );

  // ── Completada ──
  if (phase === 'done') return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-700 to-emerald-900 p-6">
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
        <div className="h-24 w-24 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="h-12 w-12 text-emerald-600" />
        </div>
        <h2 className="font-bold text-2xl mb-2">¡Orden completada!</h2>
        {order && <p className="font-semibold text-slate-800 mb-2">{order.title}</p>}
        <p className="text-slate-500 text-sm">Gracias. La orden fue guardada correctamente.</p>
        <p className="text-slate-400 text-xs mt-4">Podés cerrar esta ventana.</p>
      </div>
    </div>
  );

  // ── Vista de trabajo ──
  const pc = priorityConfig[order.priority] || priorityConfig.media;
  const isUrgente = order.priority === 'urgente';

  return (
    <div className={`min-h-screen ${isUrgente ? 'bg-gradient-to-b from-red-800 to-red-950' : 'bg-gradient-to-b from-slate-800 to-slate-950'}`}>

      {/* Header */}
      <div className="text-center pt-8 pb-5 px-5">
        <img
          src="https://media.base44.com/images/public/69bc7d2a6f0e7ed160c90003/7a2959dd1_image.png"
          alt="DH1"
          className="h-7 object-contain mix-blend-screen mx-auto mb-5 opacity-70"
        />
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold mb-3 ${pc.color}`}>
          {pc.label}
        </span>
        <h1 className="text-white font-bold text-2xl leading-tight px-2">{order.title}</h1>
        {(order.location || order.location_qr_name) && (
          <p className="text-white/50 text-sm mt-2 flex items-center justify-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> {order.location_qr_name || order.location}
          </p>
        )}
      </div>

      {/* Contenido principal */}
      <div className="px-4 pb-10 max-w-md mx-auto space-y-4">

        {/* Instrucciones */}
        {order.description && (
          <div className="bg-white rounded-2xl p-5 shadow-lg">
            <p className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-2">
              <ClipboardList className="h-4 w-4" /> Instrucciones
            </p>
            <p className="text-slate-800 text-base leading-relaxed whitespace-pre-wrap">{order.description}</p>
          </div>
        )}

        {/* Fotos de referencia del jefe de sitio */}
        {order.photos?.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-lg">
            <p className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
              <Camera className="h-4 w-4" /> Fotos de referencia
            </p>
            <div className="grid grid-cols-2 gap-2">
              {order.photos.map((url, idx) => (
                <div key={idx} className="aspect-video rounded-xl overflow-hidden border border-slate-200">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fotos del operario (opcional) */}
        <div className="bg-white rounded-2xl p-5 shadow-lg">
          <p className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
            <Camera className="h-4 w-4" /> Fotos de lo realizado (opcional)
          </p>
          <FotoSubir
            photos={photos}
            onAdd={url => setPhotos(prev => [...prev, url])}
            onRemove={idx => setPhotos(prev => prev.filter((_, i) => i !== idx))}
          />
        </div>

        {/* Botón completar */}
        <div className="sticky bottom-4 pt-2">
          <button
            onClick={handleCompletar}
            disabled={saving}
            className="w-full h-16 rounded-2xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-bold text-lg flex items-center justify-center gap-3 shadow-xl shadow-emerald-900/40 transition-all active:scale-[0.98]"
          >
            {saving
              ? <><Loader2 className="h-6 w-6 animate-spin" /> Guardando...</>
              : <><Check className="h-6 w-6" /> Marcar como Completada</>
            }
          </button>
        </div>

      </div>
    </div>
  );
}