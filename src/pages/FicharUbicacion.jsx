import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  CheckCircle2, Clock, MapPin, Loader2, AlertTriangle,
  LogIn, LogOut, Building2, User, ChevronDown, Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const COLOR_MAP = {
  blue:   { bg: 'from-blue-600 to-blue-800',     icon: 'bg-blue-500/20 text-blue-200',  btn: 'bg-blue-500 hover:bg-blue-400' },
  green:  { bg: 'from-emerald-600 to-emerald-800', icon: 'bg-emerald-500/20 text-emerald-200', btn: 'bg-emerald-500 hover:bg-emerald-400' },
  purple: { bg: 'from-purple-600 to-purple-800', icon: 'bg-purple-500/20 text-purple-200', btn: 'bg-purple-500 hover:bg-purple-400' },
  orange: { bg: 'from-orange-600 to-orange-800', icon: 'bg-orange-500/20 text-orange-200', btn: 'bg-orange-500 hover:bg-orange-400' },
  red:    { bg: 'from-red-600 to-red-800',       icon: 'bg-red-500/20 text-red-200',    btn: 'bg-red-500 hover:bg-red-400' },
};

export default function FicharUbicacion() {
  const params = new URLSearchParams(window.location.search);
  const locationId = params.get('loc');

  const [location, setLocation] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [gps, setGps] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(true);

  // UI state
  const [step, setStep] = useState('select'); // 'select' | 'confirm' | 'done'
  const [search, setSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [eventType, setEventType] = useState('entrada');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!locationId) { setError('QR inválido. No se encontró la ubicación.'); setLoading(false); return; }

    const init = async () => {
      try {
        const [locs, emps] = await Promise.all([
          base44.entities.LocationQR.filter({ id: locationId }),
          base44.entities.Employee.filter({ status: 'activo' }, 'full_name', 200),
        ]);
        if (!locs || locs.length === 0) { setError('Punto de fichaje no encontrado o inactivo.'); setLoading(false); return; }
        if (!locs[0].is_active) { setError('Este punto de fichaje está desactivado.'); setLoading(false); return; }
        setLocation(locs[0]);
        setEmployees(emps || []);
        if (locs[0].event_type !== 'ambos') setEventType(locs[0].event_type);
      } catch {
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

  const filteredEmployees = employees.filter(e =>
    e.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    e.dni?.includes(search)
  );

  const handleConfirm = async () => {
    setSubmitting(true);
    const timestamp = new Date().toISOString();
    const deviceInfo = navigator.userAgent.slice(0, 120);

    let locationName = location.name;
    if (gps) {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${gps.lat}&lon=${gps.lng}&format=json`);
        const data = await res.json();
        locationName = `${location.name} · ${data.display_name?.split(',').slice(0, 2).join(', ') || ''}`;
      } catch { locationName = `${location.name} · ${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}`; }
    }

    await base44.entities.AttendanceLog.create({
      employee_id: selectedEmployee.id,
      employee_name: selectedEmployee.full_name,
      type: eventType,
      timestamp,
      latitude: gps?.lat || null,
      longitude: gps?.lng || null,
      location_name: locationName,
      device_info: deviceInfo,
      notes: `QR Ubicación: ${location.name}`,
    });

    // Update scan count
    await base44.entities.LocationQR.update(location.id, {
      total_scans: (location.total_scans || 0) + 1,
    });

    setDone({ type: eventType, timestamp, locationName });
    setStep('done');
    setSubmitting(false);
  };

  const colors = COLOR_MAP[location?.color || 'blue'] || COLOR_MAP.blue;

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="text-center">
        <Loader2 className="h-8 w-8 text-white/60 animate-spin mx-auto mb-3" />
        <p className="text-white/40 text-sm">Cargando punto de fichaje...</p>
      </div>
    </div>
  );

  // ── Error ──────────────────────────────────────────────────────────────────
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

  // ── Done ──────────────────────────────────────────────────────────────────
  if (step === 'done') return (
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
        <h2 className="font-bold text-2xl mb-1">¡Listo!</h2>
        <p className="text-muted-foreground text-sm mb-5">
          {done.type === 'entrada' ? 'Entrada' : 'Salida'} registrada para{' '}
          <strong className="text-foreground">{selectedEmployee.full_name}</strong>
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
        </div>

        <Button
          variant="outline"
          className="w-full"
          onClick={() => { setStep('select'); setSelectedEmployee(null); setSearch(''); setDone(null); }}
        >
          Fichar otro empleado
        </Button>
        <p className="text-xs text-muted-foreground mt-3">Podés cerrar esta ventana.</p>
      </div>
    </div>
  );

  // ── Confirm ────────────────────────────────────────────────────────────────
  if (step === 'confirm') return (
    <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br ${colors.bg} p-4`}>
      <div className="bg-white rounded-2xl overflow-hidden max-w-sm w-full shadow-2xl">
        {/* Header */}
        <div className={`bg-gradient-to-br ${colors.bg} p-6 text-white text-center`}>
          <div className={`h-14 w-14 rounded-full ${colors.icon} flex items-center justify-center mx-auto mb-3 backdrop-blur-sm`}>
            <Building2 className="h-7 w-7" />
          </div>
          <p className="text-white/60 text-xs font-medium uppercase tracking-wider mb-0.5">Punto de fichaje</p>
          <h2 className="font-bold text-xl">{location.name}</h2>
          {location.address && <p className="text-white/60 text-xs mt-1">{location.address}</p>}
        </div>

        <div className="p-6 space-y-4">
          {/* Employee info */}
          <div className="bg-slate-50 rounded-xl p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
              <User className="h-5 w-5 text-slate-500" />
            </div>
            <div>
              <p className="font-semibold text-sm">{selectedEmployee.full_name}</p>
              <p className="text-xs text-muted-foreground capitalize">{selectedEmployee.role}</p>
            </div>
            <Button variant="ghost" size="sm" className="ml-auto text-xs" onClick={() => setStep('select')}>
              Cambiar
            </Button>
          </div>

          {/* Event type */}
          {location.event_type === 'ambos' && (
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
          )}

          {location.event_type !== 'ambos' && (
            <div className={`py-3 rounded-xl text-sm font-semibold text-center ${eventType === 'entrada' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
              {eventType === 'entrada' ? <span className="flex items-center justify-center gap-2"><LogIn className="h-4 w-4" />Solo Entrada</span> : <span className="flex items-center justify-center gap-2"><LogOut className="h-4 w-4" />Solo Salida</span>}
            </div>
          )}

          {/* Time & GPS */}
          <div className="bg-slate-50 rounded-xl p-3 space-y-2 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              <span className="font-mono font-semibold text-slate-700">{format(now, "HH:mm:ss")}</span>
              <span>· {format(now, "d 'de' MMMM yyyy", { locale: es })}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5" />
              {gpsLoading
                ? <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Obteniendo GPS...</span>
                : gps
                  ? <span className="text-emerald-600">GPS capturado ✓</span>
                  : <span className="text-amber-600">Sin GPS</span>
              }
            </div>
          </div>

          <Button
            className={`w-full h-12 text-base font-bold gap-2 ${eventType === 'entrada' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting
              ? <Loader2 className="h-5 w-5 animate-spin" />
              : eventType === 'entrada'
                ? <><LogIn className="h-5 w-5" />Confirmar Entrada</>
                : <><LogOut className="h-5 w-5" />Confirmar Salida</>
            }
          </Button>
        </div>
      </div>
    </div>
  );

  // ── Select employee ────────────────────────────────────────────────────────
  return (
    <div className={`min-h-screen bg-gradient-to-br ${colors.bg} p-4 flex flex-col`}>
      {/* Header */}
      <div className="text-center pt-8 pb-6 text-white">
        <div className={`h-16 w-16 rounded-2xl ${colors.icon} flex items-center justify-center mx-auto mb-4 backdrop-blur-sm`}>
          <Building2 className="h-8 w-8" />
        </div>
        <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-1">Punto de fichaje</p>
        <h1 className="font-bold text-2xl">{location.name}</h1>
        {location.address && <p className="text-white/50 text-sm mt-1">{location.address}</p>}
        {location.project_name && (
          <span className="inline-block mt-2 px-3 py-0.5 bg-white/10 backdrop-blur-sm rounded-full text-white/70 text-xs">
            {location.project_name}
          </span>
        )}
        <p className="text-white/40 text-xs mt-4 font-mono">{format(now, "HH:mm:ss · d MMM yyyy")}</p>
      </div>

      {/* Card */}
      <div className="flex-1 bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-w-sm w-full mx-auto">
        <div className="p-4 border-b">
          <p className="text-sm font-semibold text-center text-muted-foreground mb-3">Seleccioná tu nombre</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o DNI..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-10"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filteredEmployees.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">
              <User className="h-10 w-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No se encontraron empleados</p>
            </div>
          )}
          {filteredEmployees.map(emp => (
            <button
              key={emp.id}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 active:bg-slate-100 transition-colors text-left"
              onClick={() => { setSelectedEmployee(emp); setStep('confirm'); }}
            >
              <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-slate-500">
                {emp.full_name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-slate-800">{emp.full_name}</p>
                <p className="text-xs text-muted-foreground capitalize">{emp.role}{emp.specialty !== 'general' ? ` · ${emp.specialty}` : ''}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-300 -rotate-90 flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}