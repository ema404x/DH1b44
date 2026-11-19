import React, { useEffect, useState } from 'react';
import { Loader2, MapPin, LogIn, LogOut, AlertTriangle, CloudOff } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { leerHabilitacion, decidirTipoLocal, registrarFichajeLocal } from '@/lib/fichajeOffline';
import { enqueueFichaje } from '@/lib/offlineSyncEngine';
import { getDistanceStatus } from '@/components/fichar/geoDistance';
import RelojVivo from '@/components/fichar-cuenta/RelojVivo';
import GpsEstadoCuenta from '@/components/fichar-cuenta/GpsEstadoCuenta';
import ComprobanteOffline from '@/components/fichar-cuenta/ComprobanteOffline';

/**
 * Sin señal: si la cuenta está habilitada en el teléfono y el lugar está en la
 * lista guardada, se ficha igual y queda en la cola. Si no, `fallback`
 * (el mensaje de siempre con el QR público).
 */
export default function FichajeOfflineFlow({ locId, gpsState, onVolver, fallback }) {
  const { user } = useAuth();
  const { gps, loading, error: gpsError, requestGps } = gpsState;
  const [hab, setHab] = useState(undefined);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(null);
  const [errorGuardar, setErrorGuardar] = useState(null);

  useEffect(() => { leerHabilitacion().then(setHab).catch(() => setHab(null)); }, []);

  if (hab === undefined) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  const loc = hab && user?.id === hab.user_id ? hab.locations.find((l) => l.id === locId) : null;
  if (!loc) return fallback;
  if (guardado) return <ComprobanteOffline guardado={guardado} onVolver={onVolver} />;

  const { tipo, otra } = decidirTipoLocal(hab, loc.id);
  const esSalida = tipo === 'salida';
  const bloqueo = otra ? `Tenés una entrada abierta en "${otra}". Registrá primero la salida allí.` : null;
  const Icono = esSalida ? LogOut : LogIn;

  const confirmar = async () => {
    if (guardando || !gps) return;
    setGuardando(true);
    setErrorGuardar(null);
    const hora = new Date().toISOString();
    try {
      await enqueueFichaje({
        user_id: hab.user_id, location_qr_id: loc.id, location_name: loc.name, tipo, hora_dispositivo: hora,
        latitude: gps.lat, longitude: gps.lng, accuracy: gps.accuracy,
      });
      await registrarFichajeLocal(hab, { tipo, loc, hora });
      setGuardado({ tipo, loc, hora, distancia: getDistanceStatus(gps.lat, gps.lng, loc.latitude, loc.longitude, gps.accuracy) });
    } catch {
      setErrorGuardar('No se pudo guardar en el teléfono. Revisá el espacio libre y volvé a intentar.');
    } finally {
      setGuardando(false);
    }
  };

  const error = errorGuardar || bloqueo;
  return (<>
    <p className="flex items-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-400">
      <CloudOff className="h-4 w-4 shrink-0" /> Sin señal: el fichaje se guarda en el teléfono y se envía solo.
    </p>
    <section className="rounded-3xl border border-border bg-card p-5 shadow-lg shadow-black/10 acero-rise">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15"><MapPin className="h-6 w-6 text-primary" /></div>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold leading-tight text-card-foreground">{loc.name}</h1>
          {loc.address && <p className="mt-0.5 truncate text-sm text-muted-foreground">{loc.address}</p>}
          <p className="mt-1 text-xs text-muted-foreground">{hab.operario_nombre}</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${esSalida ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'}`}>{esSalida ? 'Salida' : 'Entrada'}</span>
      </div>
      <div className="mt-6"><RelojVivo /></div>
    </section>
    <GpsEstadoCuenta gps={gps} loading={loading} error={gpsError} onRetry={requestGps} location={loc} />
    {error && <p className="flex items-start gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
    <button onClick={confirmar} disabled={!gps || guardando || Boolean(bloqueo)}
      className="flex h-20 w-full items-center justify-center gap-3 rounded-2xl bg-primary text-xl font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-transform active:scale-[0.97] disabled:opacity-50">
      {guardando ? <Loader2 className="h-7 w-7 animate-spin" /> : <Icono className="h-7 w-7" />}
      {guardando ? 'Guardando…' : esSalida ? 'Confirmar salida' : 'Confirmar entrada'}
    </button>
    <button onClick={onVolver} className="h-12 w-full rounded-2xl border border-border text-sm font-semibold text-muted-foreground">Cancelar</button>
  </>);
}