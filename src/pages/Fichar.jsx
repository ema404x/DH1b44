import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, Clock, MapPin, Loader2, AlertTriangle, LogIn, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Fichar() {
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null); // { type, timestamp, location }
  const [error, setError] = useState('');
  const [location, setLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [lastLog, setLastLog] = useState(null);

  const params = new URLSearchParams(window.location.search);
  const employeeId = params.get('id');

  useEffect(() => {
    if (!employeeId) { setError('QR inválido. No se encontró el empleado.'); setLoading(false); return; }

    const init = async () => {
      try {
        const [emps, logs] = await Promise.all([
          base44.entities.Employee.filter({ id: employeeId }),
          base44.entities.AttendanceLog.filter({ employee_id: employeeId }, '-timestamp', 1),
        ]);
        if (!emps || emps.length === 0) { setError('Empleado no encontrado.'); setLoading(false); return; }
        setEmployee(emps[0]);
        if (logs && logs.length > 0) setLastLog(logs[0]);
      } catch (e) {
        setError('Error al cargar datos. Intentá de nuevo.');
      }
      setLoading(false);
    };
    init();

    // Get GPS
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocationLoading(false);
        },
        () => setLocationLoading(false),
        { timeout: 8000 }
      );
    } else {
      setLocationLoading(false);
    }
  }, [employeeId]);

  const nextType = lastLog?.type === 'entrada' ? 'salida' : 'entrada';

  const handleFichar = async () => {
    setSubmitting(true);
    const now = new Date().toISOString();
    const deviceInfo = navigator.userAgent.slice(0, 120);

    let locationName = '';
    if (location) {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${location.lat}&lon=${location.lng}&format=json`);
        const data = await res.json();
        locationName = data.display_name?.split(',').slice(0, 3).join(', ') || '';
      } catch { locationName = `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`; }
    }

    await base44.entities.AttendanceLog.create({
      employee_id: employee.id,
      employee_name: employee.full_name,
      type: nextType,
      timestamp: now,
      latitude: location?.lat || null,
      longitude: location?.lng || null,
      location_name: locationName,
      device_info: deviceInfo,
    });

    setDone({ type: nextType, timestamp: now, location: locationName });
    setSubmitting(false);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <Loader2 className="h-8 w-8 text-white/60 animate-spin" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-3" />
        <h2 className="font-bold text-lg mb-2">Error</h2>
        <p className="text-muted-foreground text-sm">{error}</p>
      </div>
    </div>
  );

  if (done) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a1628] to-[#0f2a4a] p-4">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
        <div className={`h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4 ${done.type === 'entrada' ? 'bg-emerald-100' : 'bg-blue-100'}`}>
          {done.type === 'entrada'
            ? <LogIn className="h-8 w-8 text-emerald-600" />
            : <LogOut className="h-8 w-8 text-blue-600" />
          }
        </div>
        <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-3" />
        <h2 className="font-bold text-xl mb-1">¡Fichaje registrado!</h2>
        <p className="text-muted-foreground text-sm mb-4">
          {done.type === 'entrada' ? 'Entrada' : 'Salida'} registrada para <strong>{employee.full_name}</strong>
        </p>
        <div className="bg-muted/40 rounded-xl p-4 text-left space-y-2 text-sm mb-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4 flex-shrink-0" />
            <span>{format(new Date(done.timestamp), "EEEE d 'de' MMMM · HH:mm'hs'", { locale: es })}</span>
          </div>
          {done.location && (
            <div className="flex items-start gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span className="text-xs leading-tight">{done.location}</span>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Podés cerrar esta ventana.</p>
      </div>
    </div>
  );

  const isEntrada = nextType === 'entrada';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a1628] to-[#0f2a4a] p-4">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <img
            src="https://media.base44.com/images/public/69bc7d2a6f0e7ed160c90003/7a2959dd1_image.png"
            alt="DH1"
            className="h-10 mx-auto mb-4 object-contain"
            style={{ filter: 'invert(1)' }}
          />
          <div className={`h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-3 ${isEntrada ? 'bg-emerald-100' : 'bg-blue-100'}`}>
            {isEntrada
              ? <LogIn className="h-8 w-8 text-emerald-600" />
              : <LogOut className="h-8 w-8 text-blue-600" />
            }
          </div>
          <h1 className="font-bold text-xl">{employee.full_name}</h1>
          <p className="text-sm text-muted-foreground capitalize">
            {[employee.role, employee.specialty].filter(Boolean).join(' · ')}
          </p>
        </div>

        {/* Info */}
        <div className="bg-muted/40 rounded-xl p-4 space-y-2 text-sm mb-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{format(new Date(), "EEEE d 'de' MMMM · HH:mm'hs'", { locale: es })}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            {locationLoading
              ? <span className="text-muted-foreground text-xs flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Obteniendo ubicación...</span>
              : location
                ? <span className="text-xs text-muted-foreground">{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</span>
                : <span className="text-xs text-amber-600">Ubicación no disponible</span>
            }
          </div>
          {lastLog && (
            <div className="pt-1 border-t text-xs text-muted-foreground">
              Último registro: <strong className="capitalize">{lastLog.type}</strong> a las {format(new Date(lastLog.timestamp), 'HH:mm')}hs el {format(new Date(lastLog.timestamp), 'd/M/yy')}
            </div>
          )}
        </div>

        <Button
          className={`w-full h-12 text-base font-semibold gap-2 ${isEntrada ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          onClick={handleFichar}
          disabled={submitting}
        >
          {submitting
            ? <Loader2 className="h-5 w-5 animate-spin" />
            : isEntrada ? <><LogIn className="h-5 w-5" /> Registrar Entrada</> : <><LogOut className="h-5 w-5" /> Registrar Salida</>
          }
        </Button>
      </div>
    </div>
  );
}