import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, MapPin, LogIn, LogOut, AlertTriangle } from 'lucide-react';
import useRequiredGps from '@/components/fichar/useRequiredGps';
import { irAFichajePublico } from '@/lib/modoOperario';
import useFichajeCuenta from '@/components/fichar-cuenta/useFichajeCuenta';
import RelojVivo from '@/components/fichar-cuenta/RelojVivo';
import EntradaResumen from '@/components/fichar-cuenta/EntradaResumen';
import GpsEstadoCuenta from '@/components/fichar-cuenta/GpsEstadoCuenta';
import ComprobanteFichaje from '@/components/fichar-cuenta/ComprobanteFichaje';
import SinConexionFichaje from '@/components/fichar-cuenta/SinConexionFichaje';
import FichajeOfflineFlow from '@/components/fichar-cuenta/FichajeOfflineFlow';
import FichajesPendientesAviso from '@/components/fichar-cuenta/FichajesPendientesAviso';
import { FICHAJE_SIN_CONEXION } from '@/lib/fichajeCuenta';
import { isNetworkError } from '@/lib/offlineSession';

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

// /fichar-cuenta?loc=<LocationQR> — fichaje con la cuenta del operario (sin nombre, DNI ni firma).
export default function FicharCuenta() {
  const navigate = useNavigate();
  const locId = new URLSearchParams(window.location.search).get('loc') || '';
  const online = useOnline();
  const { gps, loading: gpsLoading, error: gpsError, requestGps } = useRequiredGps();
  const { estado, confirmar, enviando, resultado, errorEnvio } = useFichajeCuenta(locId);
  const volver = useCallback(() => navigate('/', { replace: true }), [navigate]);
  const data = estado.data;

  // Sin ficha de operario / sin DNI / otro rol: mismo comportamiento de siempre (portal público).
  useEffect(() => {
    if (data?.code === 'no_elegible' || errorEnvio?.code === 'no_elegible') irAFichajePublico(locId);
  }, [data?.code, errorEnvio?.code, locId]);

  const wrap = (children) => <div className="mx-auto flex w-full max-w-md flex-col gap-5 pb-8 page-enter">{children}</div>;

  if (resultado) return wrap(<ComprobanteFichaje resultado={resultado} onVolver={volver} />);
  if (!locId) return wrap(<p className="rounded-2xl border border-border bg-card p-5 text-center text-sm text-muted-foreground">El código QR no tiene una ubicación válida.</p>);
  if (!online || estado.isError || errorEnvio?.code === 'red') {
    const mensajeHoy = (
      <SinConexionFichaje locId={locId} mensaje={errorEnvio?.code === 'red' ? errorEnvio.mensaje : null}
        onReintentar={online ? () => (errorEnvio?.code === 'red' && gps ? confirmar(gps) : estado.refetch()) : null} />
    );
    // Sin señal real (no un error del servidor): fichar igual y guardar en el teléfono.
    const sinSenal = !online || errorEnvio?.code === 'red' || isNetworkError(estado.error);
    if (FICHAJE_SIN_CONEXION && sinSenal) {
      return wrap(<>
        <FichajesPendientesAviso />
        <FichajeOfflineFlow locId={locId} gpsState={{ gps, loading: gpsLoading, error: gpsError, requestGps }} onVolver={volver} fallback={mensajeHoy} />
      </>);
    }
    return wrap(mensajeHoy);
  }
  if (estado.isLoading || !data || data.code === 'no_elegible') {
    return wrap(<div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>);
  }
  if (!data.ok) return wrap(<SinConexionFichaje locId={locId} mensaje={data.error} onReintentar={() => estado.refetch()} />);

  const esSalida = data.tipo === 'salida';
  const bloqueo = data.otra_ubicacion ? `Tenés una entrada abierta en "${data.otra_ubicacion}". Registrá primero la salida allí.` : null;
  const error = errorEnvio?.mensaje || bloqueo;
  const Icono = esSalida ? LogOut : LogIn;

  return wrap(<>
    <section className="rounded-3xl border border-border bg-card p-5 shadow-lg shadow-black/10 acero-rise">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15"><MapPin className="h-6 w-6 text-primary" /></div>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold leading-tight text-card-foreground">{data.location.name}</h1>
          {data.location.address && <p className="mt-0.5 truncate text-sm text-muted-foreground">{data.location.address}</p>}
          <p className="mt-1 text-xs text-muted-foreground">{data.operario_nombre}</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${esSalida ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'}`}>{esSalida ? 'Salida' : 'Entrada'}</span>
      </div>
      <div className="mt-6"><RelojVivo /></div>
      {esSalida && data.entrada_timestamp && <EntradaResumen entrada={data.entrada_timestamp} />}
    </section>
    <GpsEstadoCuenta gps={gps} loading={gpsLoading} error={gpsError} onRetry={requestGps} location={data.location} />
    {error && <p className="flex items-start gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
    <button onClick={() => confirmar(gps)} disabled={!gps || enviando || Boolean(bloqueo)}
      className="flex h-20 w-full items-center justify-center gap-3 rounded-2xl bg-primary text-xl font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-transform active:scale-[0.97] disabled:opacity-50">
      {enviando ? <Loader2 className="h-7 w-7 animate-spin" /> : <Icono className="h-7 w-7" />}
      {enviando ? 'Registrando…' : esSalida ? 'Confirmar salida' : 'Confirmar entrada'}
    </button>
    <button onClick={volver} className="h-12 w-full rounded-2xl border border-border text-sm font-semibold text-muted-foreground">Cancelar</button>
  </>);
}