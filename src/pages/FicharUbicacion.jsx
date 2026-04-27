import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import {
  CheckCircle2, Clock, MapPin, Loader2, AlertTriangle,
  LogIn, LogOut, Building2, User, PenLine
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import SignaturePad from '@/components/fichar/SignaturePad';

const COLOR_MAP = {
  blue:   { bg: 'from-blue-600 to-blue-800',     icon: 'bg-blue-500/20 text-blue-200',  },
  green:  { bg: 'from-emerald-600 to-emerald-800', icon: 'bg-emerald-500/20 text-emerald-200' },
  purple: { bg: 'from-purple-600 to-purple-800', icon: 'bg-purple-500/20 text-purple-200' },
  orange: { bg: 'from-orange-600 to-orange-800', icon: 'bg-orange-500/20 text-orange-200' },
  red:    { bg: 'from-red-600 to-red-800',       icon: 'bg-red-500/20 text-red-200' },
};

export default function FicharUbicacion() {
  const params = new URLSearchParams(window.location.search);
  const locationId = params.get('loc');

  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [gps, setGps] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(true);

  // Form state
  const [fullName, setFullName] = useState('');
  const [eventType, setEventType] = useState('entrada');
  const [signatureData, setSignatureData] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!locationId) {
      setError('QR inválido. No se encontró la ubicación.');
      setLoading(false);
      return;
    }

    const init = async () => {
      try {
        const res = await base44.functions.invoke('publicFichar', {
          action: 'getLocationData',
          locationId,
        });
        const loc = res.data?.location;
        if (!loc) {
          setError('Punto de fichaje no encontrado.');
          setLoading(false);
          return;
        }
        if (!loc.is_active) {
          setError('Este punto de fichaje está desactivado.');
          setLoading(false);
          return;
        }
        setLocation(loc);
        if (loc.event_type !== 'ambos') setEventType(loc.event_type);
      } catch (e) {
        setError('Error al cargar datos. Intentá de nuevo.');
      }
      setLoading(false);
    };
    init();

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGpsLoading(false); },
        () => setGpsLoading(false),
        { timeout: 8000 }
      );
    } else {
      setGpsLoading(false);
    }
  }, [locationId]);

  const handleSubmit = async () => {
    if (!fullName.trim()) return;
    if (!signatureData) return;

    setSubmitting(true);
    const timestamp = new Date().toISOString();
    const deviceInfo = navigator.userAgent.slice(0, 120);

    // Upload signature
    let signatureUrl = null;
    try {
      const blob = await (await fetch(signatureData)).blob();
      const file = new File([blob], 'firma.png', { type: 'image/png' });
      const uploaded = await base44.integrations.Core.UploadFile({ file });
      signatureUrl = uploaded.file_url;
    } catch { /* continúa sin firma subida */ }

    let locationName = location.name;
    if (gps) {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${gps.lat}&lon=${gps.lng}&format=json`);
        const data = await res.json();
        locationName = `${location.name} · ${data.display_name?.split(',').slice(0, 2).join(', ') || ''}`;
      } catch { locationName = `${location.name} · ${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}`; }
    }

    // Create attendance log + update scan count via backend (service role)
    await base44.functions.invoke('publicFichar', {
      action: 'createAttendance',
      attendanceData: {
        location_qr_id: location.id,
        employee_name: fullName.trim(),
        type: eventType,
        timestamp,
        latitude: gps?.lat || null,
        longitude: gps?.lng || null,
        location_name: locationName,
        device_info: deviceInfo,
        signature_url: signatureUrl,
        notes: `QR Ubicación: ${location.name}`,
      },
    });

    setDone({ type: eventType, timestamp, locationName });
    setSubmitting(false);
  };

  const colors = COLOR_MAP[location?.color || 'blue'] || COLOR_MAP.blue;
  const canSubmit = fullName.trim().length > 2 && signatureData && !submitting;

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="text-center">
        <Loader2 className="h-8 w-8 text-white/60 animate-spin mx-auto mb-3" />
        <p className="text-white/40 text-sm">Cargando punto de fichaje...</p>
      </div>
    </div>
  );

  // ── Error ────────────────────────────────────────────────────────────────────
  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
        <div className="h-14 w-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-7 w-7 text-red-500" />
        </div>
        <h2 className="font-bold text-lg mb-2">Punto no válido</h2>
        <p className="text-muted-foreground text-sm">{error}</p>
      </div>
    </div>
  );

  // ── Done ─────────────────────────────────────────────────────────────────────
  if (done) return (
    <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br ${colors.bg} p-4`}>
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
        <div className="relative mb-6">
          <div className={`h-20 w-20 rounded-full flex items-center justify-center mx-auto ${done.type === 'entrada' ? 'bg-emerald-100' : 'bg-blue-100'}`}>
            {done.type === 'entrada'
              ? <LogIn className="h-10 w-10 text-emerald-600" />
              : <LogOut className="h-10 w-10 text-blue-600" />
            }
          </div>
          <div className="absolute bottom-0 right-1/2 translate-x-8 translate-y-1 h-7 w-7 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
            <CheckCircle2 className="h-4 w-4 text-white" />
          </div>
        </div>
        <h2 className="font-bold text-2xl mb-1">¡Registro exitoso!</h2>
        <p className="text-muted-foreground text-sm mb-5">
          {done.type === 'entrada' ? 'Entrada' : 'Salida'} registrada para{' '}
          <strong className="text-foreground">{fullName}</strong>
        </p>
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-left space-y-2.5 text-sm mb-5">
          <div className="flex items-center gap-2 text-slate-600">
            <Clock className="h-4 w-4 text-slate-400 flex-shrink-0" />
            <span>{format(new Date(done.timestamp), "EEEE d 'de' MMMM · HH:mm'hs'", { locale: es })}</span>
          </div>
          <div className="flex items-start gap-2 text-slate-600">
            <MapPin className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <span className="text-xs leading-relaxed">{done.locationName}</span>
          </div>
          {gps && (
            <div className="flex items-center gap-2 text-emerald-600 text-xs">
              <MapPin className="h-3.5 w-3.5" />
              <span>GPS: {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}</span>
            </div>
          )}
        </div>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            setFullName('');
            setSignatureData(null);
            setDone(null);
          }}
        >
          Nuevo registro
        </Button>
        <p className="text-xs text-muted-foreground mt-3">Podés cerrar esta ventana.</p>
      </div>
    </div>
  );

  // ── Main Form ────────────────────────────────────────────────────────────────
  return (
    <div className={`min-h-screen bg-gradient-to-br ${colors.bg} p-4 flex flex-col`}>
      {/* Header */}
      <div className="text-center pt-8 pb-6 text-white">
        <img
          src="https://media.base44.com/images/public/69bc7d2a6f0e7ed160c90003/7a2959dd1_image.png"
          alt="DH1 Software"
          className="h-10 object-contain mix-blend-screen mx-auto mb-4"
        />
        <div className={`h-16 w-16 rounded-2xl ${colors.icon} flex items-center justify-center mx-auto mb-4 backdrop-blur-sm`}>
          <Building2 className="h-8 w-8" />
        </div>
        <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-1">Punto de fichaje</p>
        <h1 className="font-bold text-2xl">{location.name}</h1>
        {location.address && <p className="text-white/50 text-sm mt-1">{location.address}</p>}
        <p className="text-white/40 text-xs mt-3 font-mono">{format(now, "HH:mm:ss · d MMM yyyy")}</p>
      </div>

      {/* Form Card */}
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-sm w-full mx-auto">
        <div className="p-6 space-y-5">
          {/* Nombre */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> Nombre y Apellido
            </label>
            <Input
              placeholder="Ej: Juan García"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="h-12 text-base"
              autoFocus
            />
          </div>

          {/* Tipo de evento */}
          {location.event_type === 'ambos' ? (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Tipo</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setEventType('entrada')}
                  className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${eventType === 'entrada' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                >
                  <LogIn className="h-4 w-4" /> Entrada
                </button>
                <button
                  onClick={() => setEventType('salida')}
                  className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${eventType === 'salida' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                >
                  <LogOut className="h-4 w-4" /> Salida
                </button>
              </div>
            </div>
          ) : (
            <div className={`py-3 rounded-xl text-sm font-semibold text-center ${eventType === 'entrada' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
              {eventType === 'entrada'
                ? <span className="flex items-center justify-center gap-2"><LogIn className="h-4 w-4" />Solo Entrada</span>
                : <span className="flex items-center justify-center gap-2"><LogOut className="h-4 w-4" />Solo Salida</span>
              }
            </div>
          )}

          {/* GPS status */}
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2.5">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
            {gpsLoading
              ? <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Obteniendo GPS...</span>
              : gps
                ? <span className="text-emerald-600 font-semibold">GPS capturado ✓ ({gps.lat.toFixed(4)}, {gps.lng.toFixed(4)})</span>
                : <span className="text-amber-600">Sin GPS disponible</span>
            }
          </div>

          {/* Firma */}
          <SignaturePad onSign={setSignatureData} signed={!!signatureData} />

          {/* Submit */}
          <Button
            className={`w-full h-12 text-base font-bold gap-2 ${eventType === 'entrada' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'} disabled:opacity-40`}
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting
              ? <Loader2 className="h-5 w-5 animate-spin" />
              : eventType === 'entrada'
                ? <><LogIn className="h-5 w-5" />Registrar Entrada</>
                : <><LogOut className="h-5 w-5" />Registrar Salida</>
            }
          </Button>

          {(!fullName.trim() || fullName.trim().length <= 2 || !signatureData) && (
            <p className="text-center text-xs text-slate-400">
              {!fullName.trim() || fullName.trim().length <= 2
                ? 'Ingresá tu nombre completo para continuar'
                : 'Dibujá tu firma para continuar'}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 mt-4 pb-4">
        <img
          src="https://media.base44.com/images/public/69bc7d2a6f0e7ed160c90003/7a2959dd1_image.png"
          alt="DH1 Software"
          className="h-6 object-contain mix-blend-screen opacity-70"
        />
        <p className="text-white/30 text-xs text-center">Sistema de Gestión</p>
      </div>
    </div>
  );
}