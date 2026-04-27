/**
 * Página pública de ejecución de OT — accedida via QR fijo en el establecimiento
 * URL: /ejecutar-ot?loc=<locationId>  o  /ejecutar-ot?ot=<workOrderId>
 *
 * El operario escanea el QR → ve la OT activa del establecimiento →
 * puede completar checklist, subir fotos y firmar → guarda directo.
 */
import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import {
  CheckCircle2, Clock, MapPin, Loader2, AlertTriangle,
  Wrench, Zap, Eye, ClipboardList, User, Calendar,
  Camera, PenTool, ChevronDown, ChevronUp, Upload,
  RotateCcw, Check, X, Sparkles, Info, ListChecks
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

// ── Helper: llamar funciones públicas via SDK (no requiere auth) ─────────────
const callPublicFn = async (fnName, payload) => {
  const res = await base44.functions.invoke(fnName, payload);
  return res.data;
};

// ── Configuraciones visuales ─────────────────────────────────────────────────
const typeConfig = {
  mantenimiento_preventivo: { label: 'Mantenimiento Preventivo', icon: Wrench, color: 'bg-blue-100 text-blue-700' },
  mantenimiento_correctivo: { label: 'Mantenimiento Correctivo', icon: Wrench, color: 'bg-orange-100 text-orange-700' },
  instalacion:   { label: 'Instalación',  icon: Zap,          color: 'bg-purple-100 text-purple-700' },
  inspeccion:    { label: 'Inspección',   icon: Eye,           color: 'bg-teal-100 text-teal-700' },
  reparacion:    { label: 'Reparación',   icon: Wrench,        color: 'bg-amber-100 text-amber-700' },
  emergencia:    { label: 'EMERGENCIA',   icon: AlertTriangle, color: 'bg-red-100 text-red-700' },
};

const statusConfig = {
  pendiente:   { label: 'Pendiente',   dot: 'bg-slate-400',   text: 'text-slate-600',   bg: 'bg-slate-50',  border: 'border-slate-200' },
  asignada:    { label: 'Asignada',    dot: 'bg-blue-500',    text: 'text-blue-700',    bg: 'bg-blue-50',   border: 'border-blue-200' },
  en_progreso: { label: 'En Progreso', dot: 'bg-indigo-500',  text: 'text-indigo-700',  bg: 'bg-indigo-50', border: 'border-indigo-200' },
  en_espera:   { label: 'En Espera',   dot: 'bg-yellow-500',  text: 'text-yellow-700',  bg: 'bg-yellow-50', border: 'border-yellow-200' },
  completada:  { label: 'Completada',  dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50',border: 'border-emerald-200' },
  cancelada:   { label: 'Cancelada',   dot: 'bg-red-400',     text: 'text-red-600',     bg: 'bg-red-50',    border: 'border-red-200' },
};

// ── Sub-componente: Firma táctil grande ──────────────────────────────────────
function FirmaGrande({ onFirmado }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);
  const [nombre, setNombre] = useState('');
  const [saving, setSaving] = useState(false);
  const lastPos = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const src = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - rect.left) * scaleX, y: (src.clientY - rect.top) * scaleY };
  };

  const startDraw = (e) => { e.preventDefault(); setDrawing(true); lastPos.current = getPos(e, canvasRef.current); };
  const draw = (e) => {
    e.preventDefault();
    if (!drawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
    setHasStrokes(true);
  };
  const endDraw = (e) => { e?.preventDefault(); setDrawing(false); };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
  };

  const guardarFirma = async () => {
  if (!hasStrokes || !nombre.trim()) return;
  setSaving(true);
  const canvas = canvasRef.current;
  canvas.toBlob(async (blob) => {
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result.split(',')[1];
        const res = await callPublicFn('publicFichar', { action: 'uploadFile', fileBase64: base64, fileName: 'firma.png', mimeType: 'image/png' });
        onFirmado({ signatureUrl: res.file_url, signatureName: nombre.trim() });
        setSaving(false);
      };
      reader.readAsDataURL(blob);
    } catch {
      toast.error('Error al guardar la firma');
      setSaving(false);
    }
  });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Tu nombre completo</label>
        <Input
          placeholder="Ej: Juan García"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          className="h-14 text-lg font-medium"
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Firma</label>
          <button onClick={clear} className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700 transition-colors">
            <RotateCcw className="h-4 w-4" /> Borrar
          </button>
        </div>
        <div className="relative border-2 border-dashed border-slate-300 rounded-2xl overflow-hidden bg-slate-50 shadow-inner" style={{ touchAction: 'none' }}>
          <canvas
            ref={canvasRef}
            width={600}
            height={200}
            className="w-full block cursor-crosshair"
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={endDraw}
          />
          {!hasStrokes && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-slate-300 text-lg">✍️ Dibujá tu firma aquí</p>
            </div>
          )}
        </div>
      </div>
      <Button
        className="w-full h-14 text-base font-bold gap-2 bg-slate-800 hover:bg-slate-700"
        disabled={!hasStrokes || !nombre.trim() || saving}
        onClick={guardarFirma}
      >
        {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
        Confirmar Firma
      </Button>
    </div>
  );
}

// ── Sub-componente: Subida de fotos táctil ───────────────────────────────────
function FotosGrandes({ label, photos, onAdd, onRemove }) {
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
          const res = await callPublicFn('publicFichar', { action: 'uploadFile', fileBase64: base64, fileName: file.name, mimeType: file.type });
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
      <label className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
        <Camera className="h-4 w-4 text-slate-500" /> {label}
        <span className="text-slate-400 font-normal normal-case">({photos.length} foto{photos.length !== 1 ? 's' : ''})</span>
      </label>
      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {photos.map((url, idx) => (
            <div key={idx} className="relative rounded-xl overflow-hidden aspect-video border border-slate-200 shadow-sm">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => onRemove(idx)}
                className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/60 text-white flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="w-full h-14 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 flex items-center justify-center gap-2 text-slate-600 font-semibold text-base transition-colors disabled:opacity-50"
      >
        {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
        {uploading ? 'Subiendo...' : 'Sacar / Subir Foto'}
      </button>
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function EjecutarOrdenPublica() {
  const params = new URLSearchParams(window.location.search);
  const locId = params.get('loc');
  const otId = params.get('ot');

  const [phase, setPhase] = useState('loading'); // loading | not_found | no_ot | select_ot | work | done
  const [order, setOrder] = useState(null);
  const [availableOrders, setAvailableOrders] = useState([]);
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [checklist, setChecklist] = useState([]);
  const [fotosAntes, setFotosAntes] = useState([]);
  const [fotosDespues, setFotosDespues] = useState([]);
  const [firma, setFirma] = useState(null); // { signatureUrl, signatureName }
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('checklist');
  const [gpsData, setGpsData] = useState(null); // { lat, lng, accuracy, timestamp } | 'denied' | 'unavailable'
  const [gpsLoading, setGpsLoading] = useState(false);

  const loadOrder = (ot, locName) => {
    if (['completada', 'cancelada'].includes(ot.status)) {
      setOrder(ot);
      setLocationName(ot.location || locName);
      setPhase('done');
      return;
    }
    setOrder(ot);
    setLocationName(ot.location_qr_name || ot.location || locName);
    setChecklist(ot.checklist || []);
    setFotosAntes([]);
    setFotosDespues([]);
    setFirma(null);
    setPhase('work');
  };

  useEffect(() => {
    const load = async () => {
      try {
        let ot = null;
        let locName = '';

        if (otId) {
          // QR directo a una OT específica
          const res = await callPublicFn('publicFichar', { action: 'getWorkOrder', workOrderId: otId });
          ot = res.workOrder || null;
          locName = ot?.location_qr_name || ot?.location || 'Establecimiento';
          if (!ot) { setPhase('not_found'); return; }
          loadOrder(ot, locName);
          return;
        }

        if (locId) {
          // QR del establecimiento → buscar OTs activas
          const res = await callPublicFn('publicFichar', { action: 'getWorkOrderForLocation', locationId: locId });
          locName = res.locationName || 'Establecimiento';
          setLocationName(locName);
          setLocationAddress(res.locationAddress || '');

          const ots = res.workOrders || (res.workOrder ? [res.workOrder] : []);

          if (ots.length === 0) {
            setPhase('no_ot');
            return;
          }

          if (ots.length === 1) {
            loadOrder(ots[0], locName);
            return;
          }

          // Múltiples OTs → pantalla de selección
          setAvailableOrders(ots);
          setPhase('select_ot');
          return;
        }

        setPhase('not_found');
      } catch (e) {
        setPhase('not_found');
      }
    };
    load();
  }, [locId, otId]);

  const toggleTask = (id) => {
    setChecklist(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const checklistDone = checklist.filter(t => t.completed).length;
  const checklistTotal = checklist.length;
  const pct = checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 100;
  const allDone = checklistTotal === 0 || checklistDone === checklistTotal;

  const captureGPS = () => new Promise((resolve) => {
    if (!navigator.geolocation) { resolve({ status: 'no_disponible' }); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        status: 'capturado',
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: Math.round(pos.coords.accuracy),
        timestamp: new Date().toISOString(),
      }),
      () => resolve({ status: 'denegado' }),
      { timeout: 8000, maximumAge: 30000, enableHighAccuracy: true }
    );
  });

  const handleGuardar = async () => {
    if (!firma) { toast.error('Necesitás firmar antes de guardar'); return; }
    setSaving(true);
    setGpsLoading(true);

    // Capturar GPS antes de guardar
    const gps = await captureGPS();
    setGpsData(gps);
    setGpsLoading(false);

    try {
      const allPhotos = [...fotosAntes, ...fotosDespues];
      await callPublicFn('publicFichar', {
        action: 'updateWorkOrder',
        workOrderId: order.id,
        updates: {
          checklist,
          photos: allPhotos,
          signature_url: firma.signatureUrl,
          signature_name: firma.signatureName,
          status: allDone ? 'completada' : 'en_progreso',
          completed_date: allDone ? new Date().toISOString().split('T')[0] : undefined,
          // Datos GPS
          gps_latitude: gps.lat ?? null,
          gps_longitude: gps.lng ?? null,
          gps_accuracy: gps.accuracy ?? null,
          gps_timestamp: gps.timestamp ?? null,
          gps_status: gps.status,
        },
      });
      setPhase('done');
    } catch (e) {
      toast.error('Error al guardar: ' + e.message);
    }
    setSaving(false);
  };

  const tc = order ? (typeConfig[order.type] || typeConfig.mantenimiento_correctivo) : null;
  const sc = order ? (statusConfig[order.status] || statusConfig.pendiente) : null;
  const TypeIcon = tc?.icon || Wrench;

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (phase === 'loading') return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="text-center">
        <Loader2 className="h-12 w-12 text-white/40 animate-spin mx-auto mb-4" />
        <p className="text-white/40 text-base">Cargando orden de trabajo...</p>
      </div>
    </div>
  );

  // ── Not found ────────────────────────────────────────────────────────────────
  if (phase === 'not_found') return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
        <div className="h-20 w-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-5">
          <AlertTriangle className="h-10 w-10 text-red-500" />
        </div>
        <h2 className="font-bold text-2xl mb-2">QR no válido</h2>
        <p className="text-slate-500">El código QR escaneado no es válido o expiró.</p>
      </div>
    </div>
  );

  // ── Selección de OT (múltiples OTs activas) ─────────────────────────────────
  if (phase === 'select_ot') {
    const priorityColors = {
      urgente: 'border-l-red-500 bg-red-50',
      alta: 'border-l-orange-500 bg-orange-50',
      media: 'border-l-blue-500 bg-blue-50',
      baja: 'border-l-slate-400 bg-slate-50',
    };
    const priorityBadge = {
      urgente: 'bg-red-100 text-red-700',
      alta: 'bg-orange-100 text-orange-700',
      media: 'bg-blue-100 text-blue-700',
      baja: 'bg-slate-100 text-slate-600',
    };
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-800 to-slate-900 px-5 pt-8 pb-10">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-6">
            <img
              src="https://media.base44.com/images/public/69bc7d2a6f0e7ed160c90003/7a2959dd1_image.png"
              alt="DH1"
              className="h-8 object-contain mix-blend-screen mx-auto mb-4 opacity-70"
            />
            <div className="inline-flex items-center gap-2 bg-white/10 text-white/70 px-3 py-1.5 rounded-full text-sm mb-3">
              <MapPin className="h-3.5 w-3.5" /> {locationName}
            </div>
            {locationAddress && <p className="text-white/40 text-xs">{locationAddress}</p>}
            <h1 className="text-white font-bold text-2xl mt-3">Seleccioná una orden</h1>
            <p className="text-white/50 text-sm mt-1">Hay {availableOrders.length} órdenes activas en este establecimiento</p>
          </div>

          <div className="space-y-3">
            {availableOrders.map(ot => {
              const tc = typeConfig[ot.type] || typeConfig.mantenimiento_correctivo;
              const TypeIcon = tc.icon;
              return (
                <button
                  key={ot.id}
                  onClick={() => loadOrder(ot, locationName)}
                  className={`w-full bg-white rounded-2xl p-4 text-left shadow-lg border-l-4 ${priorityColors[ot.priority] || priorityColors.media} hover:shadow-xl transition-all active:scale-[0.98]`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${tc.color}`}>
                      <TypeIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${priorityBadge[ot.priority] || priorityBadge.media}`}>
                          {ot.priority?.toUpperCase()}
                        </span>
                        <span className="text-[10px] text-slate-400">{tc.label}</span>
                      </div>
                      <p className="font-bold text-slate-800 text-base leading-tight">{ot.title}</p>
                      {ot.assigned_name && (
                        <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                          <User className="h-3.5 w-3.5" /> {ot.assigned_name}
                        </p>
                      )}
                      {ot.description && (
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{ot.description}</p>
                      )}
                    </div>
                    <ChevronDown className="h-5 w-5 text-slate-400 flex-shrink-0 rotate-[-90deg]" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Sin OT asignada ──────────────────────────────────────────────────────────
  if (phase === 'no_ot') return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 p-6">
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
        <div className="h-20 w-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-5">
          <Info className="h-10 w-10 text-blue-500" />
        </div>
        <h2 className="font-bold text-2xl mb-2">Sin órdenes activas</h2>
        {locationName && <p className="font-semibold text-slate-800 mb-2">{locationName}</p>}
        <p className="text-slate-500 text-sm">No hay órdenes de trabajo asignadas a este establecimiento por el momento.</p>
        <p className="text-slate-400 text-xs mt-4">Consultá con tu jefe de sitio.</p>
      </div>
    </div>
  );

  // ── Completada ───────────────────────────────────────────────────────────────
  if (phase === 'done') return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-700 to-emerald-900 p-6">
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
        <div className="h-24 w-24 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="h-12 w-12 text-emerald-600" />
        </div>
        <h2 className="font-bold text-2xl mb-2">¡Orden completada!</h2>
        {order && <p className="font-semibold text-slate-800 mb-2">{order.title}</p>}
        <p className="text-slate-500 text-sm">La orden fue guardada correctamente.</p>
        {firma?.signatureName && (
          <p className="text-slate-400 text-sm mt-3">Firmado por: <strong>{firma.signatureName}</strong></p>
        )}
        <p className="text-slate-400 text-xs mt-4">Podés cerrar esta ventana.</p>
      </div>
    </div>
  );

  // ── Formulario de trabajo ────────────────────────────────────────────────────
  const isEmergencia = order.priority === 'urgente' || order.type === 'emergencia';

  return (
    <div className={`min-h-screen ${isEmergencia ? 'bg-gradient-to-b from-red-700 to-red-900' : 'bg-gradient-to-b from-slate-800 to-slate-900'}`}>

      {/* Header */}
      <div className="text-center pt-8 pb-6 px-5">
        <img
          src="https://media.base44.com/images/public/69bc7d2a6f0e7ed160c90003/7a2959dd1_image.png"
          alt="DH1"
          className="h-8 object-contain mix-blend-screen mx-auto mb-4 opacity-70"
        />
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-3 ${tc.color}`}>
          <TypeIcon className="h-4 w-4" />
          {tc.label}
        </div>
        <h1 className="text-white font-bold text-2xl leading-tight">{order.title}</h1>
        <p className="text-white/50 text-sm mt-1 flex items-center justify-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" /> {locationName || order.location}
        </p>
        {order.assigned_name && (
          <p className="text-white/40 text-xs mt-1 flex items-center justify-center gap-1">
            <User className="h-3 w-3" /> Para: {order.assigned_name}
          </p>
        )}
      </div>

      {/* Progress bar global */}
      <div className="px-5 mb-4">
        <div className="bg-white/10 rounded-2xl p-4">
          <div className="flex justify-between text-white text-sm mb-2">
            <span className="font-semibold">Progreso del checklist</span>
            <span className="font-bold">{checklistDone}/{checklistTotal} — {pct}%</span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-3">
            <div
              className="bg-emerald-400 h-3 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Section tabs */}
      <div className="px-5 mb-4">
        <div className="flex gap-2">
          {[
            { key: 'checklist', label: 'Tareas', icon: ClipboardList },
            { key: 'fotos', label: 'Fotos', icon: Camera },
            { key: 'firma', label: 'Firma', icon: PenTool },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveSection(tab.key)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-2xl text-sm font-bold transition-all ${
                activeSection === tab.key
                  ? 'bg-white text-slate-800 shadow-lg'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              <tab.icon className="h-5 w-5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pb-8 max-w-lg mx-auto">

        {/* ── CHECKLIST ─────────────────────────────────────────────────────── */}
        {activeSection === 'checklist' && (
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
            {order.description && (
              <div className="px-5 pt-5 pb-4 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Descripción</p>
                <p className="text-slate-700 text-base leading-relaxed">{order.description}</p>
              </div>
            )}

            {checklist.length === 0 ? (
              <div className="py-12 text-center">
                <ClipboardList className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-400 font-medium">Sin lista de tareas</p>
                <p className="text-slate-300 text-sm mt-1">El jefe de sitio no agregó un checklist para esta orden.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {checklist.map((task, idx) => (
                  <button
                    key={task.id || idx}
                    onClick={() => toggleTask(task.id)}
                    className={`w-full flex items-start gap-4 px-5 py-5 text-left transition-colors ${task.completed ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
                  >
                    <div className={`h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 transition-all ${
                      task.completed ? 'bg-emerald-500 shadow-md shadow-emerald-200' : 'border-2 border-slate-300'
                    }`}>
                      {task.completed && <Check className="h-4 w-4 text-white" />}
                    </div>
                    <div className="flex-1">
                      <p className={`font-semibold text-base leading-tight ${task.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                        {task.task}
                      </p>
                      {task.notes && <p className="text-sm text-slate-400 mt-0.5">{task.notes}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {allDone && checklist.length > 0 && (
              <div className="bg-emerald-50 border-t border-emerald-100 px-5 py-4 flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-500 flex-shrink-0" />
                <p className="text-emerald-700 font-semibold text-base">¡Todas las tareas completadas!</p>
              </div>
            )}
          </div>
        )}

        {/* ── FOTOS ─────────────────────────────────────────────────────────── */}
        {activeSection === 'fotos' && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl shadow-xl p-5">
              <FotosGrandes
                label="Fotos ANTES"
                photos={fotosAntes}
                onAdd={url => setFotosAntes(prev => [...prev, url])}
                onRemove={idx => setFotosAntes(prev => prev.filter((_, i) => i !== idx))}
              />
            </div>
            <div className="bg-white rounded-3xl shadow-xl p-5">
              <FotosGrandes
                label="Fotos DESPUÉS"
                photos={fotosDespues}
                onAdd={url => setFotosDespues(prev => [...prev, url])}
                onRemove={idx => setFotosDespues(prev => prev.filter((_, i) => i !== idx))}
              />
            </div>
          </div>
        )}

        {/* ── FIRMA ─────────────────────────────────────────────────────────── */}
        {activeSection === 'firma' && (
          <div className="bg-white rounded-3xl shadow-xl p-5">
            {firma ? (
              <div className="text-center space-y-4">
                <div className="h-20 w-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                </div>
                <div>
                  <p className="font-bold text-xl text-slate-800">{firma.signatureName}</p>
                  <p className="text-slate-400 text-sm">Firma registrada correctamente</p>
                </div>
                <img src={firma.signatureUrl} alt="Firma" className="max-h-24 object-contain mx-auto border border-slate-200 rounded-xl p-2 bg-slate-50" />
                <button
                  onClick={() => setFirma(null)}
                  className="text-sm text-slate-400 hover:text-slate-600 flex items-center gap-1 mx-auto"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Volver a firmar
                </button>
              </div>
            ) : (
              <FirmaGrande onFirmado={setFirma} />
            )}
          </div>
        )}

        {/* ── BOTÓN GUARDAR ─────────────────────────────────────────────────── */}
        <div className="mt-5 space-y-3">
          {/* Estado de completitud */}
          <div className="bg-white/10 rounded-2xl px-4 py-3 flex items-center gap-3">
            <div className={`h-5 w-5 rounded-full flex-shrink-0 flex items-center justify-center ${allDone ? 'bg-emerald-400' : 'bg-white/20'}`}>
              {allDone && <Check className="h-3 w-3 text-white" />}
            </div>
            <span className={`text-sm font-medium ${allDone ? 'text-emerald-300' : 'text-white/50'}`}>
              Checklist {allDone ? 'completo' : `(${checklistDone}/${checklistTotal})`}
            </span>

            <div className={`h-5 w-5 rounded-full flex-shrink-0 flex items-center justify-center ml-auto ${firma ? 'bg-emerald-400' : 'bg-white/20'}`}>
              {firma && <Check className="h-3 w-3 text-white" />}
            </div>
            <span className={`text-sm font-medium ${firma ? 'text-emerald-300' : 'text-white/50'}`}>
              {firma ? 'Firmado' : 'Sin firmar'}
            </span>
          </div>

          <button
            onClick={handleGuardar}
            disabled={!firma || saving}
            className="w-full h-16 rounded-2xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-white/20 disabled:text-white/30 text-white font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-lg shadow-emerald-900/30"
          >
            {gpsLoading
              ? <><Loader2 className="h-6 w-6 animate-spin" /> Obteniendo ubicación...</>
              : saving
              ? <><Loader2 className="h-6 w-6 animate-spin" /> Guardando...</>
              : <><Sparkles className="h-6 w-6" /> Guardar y Finalizar</>
            }
          </button>
          {!firma && (
            <p className="text-center text-white/40 text-sm">Necesitás firmar para poder guardar</p>
          )}
          {/* Info GPS */}
          {gpsData && gpsData.status === 'capturado' && (
            <p className="text-center text-emerald-300 text-xs flex items-center justify-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> Ubicación capturada — precisión {gpsData.accuracy}m
            </p>
          )}
          {gpsData && gpsData.status === 'denegado' && (
            <p className="text-center text-amber-300 text-xs flex items-center justify-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Ubicación no disponible (permiso denegado)
            </p>
          )}
        </div>
      </div>
    </div>
  );
}