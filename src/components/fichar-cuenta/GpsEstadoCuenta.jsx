import React from 'react';
import { Loader2, MapPin, AlertTriangle, RotateCcw, CheckCircle2 } from 'lucide-react';
import { getDistanceStatus } from '@/components/fichar/geoDistance';

// Estado del GPS: precisión, distancia al lugar (regla de 350 m) y reintento.
export default function GpsEstadoCuenta({ gps, loading, error, onRetry, location }) {
  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" /> Obteniendo tu ubicación…
      </div>
    );
  }
  if (error || !gps) {
    return (
      <div className="space-y-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
        <p className="flex items-start gap-2 text-sm text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error || 'No se pudo obtener tu ubicación.'}</p>
        <button onClick={onRetry} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-semibold text-foreground active:scale-[0.98]">
          <RotateCcw className="h-4 w-4" /> Reintentar GPS
        </button>
      </div>
    );
  }
  const d = getDistanceStatus(gps.lat, gps.lng, location?.latitude, location?.longitude, gps.accuracy);
  const lejos = d.status === 'far';
  return (
    <div className={`flex items-center justify-between gap-3 rounded-2xl border p-4 ${lejos ? 'border-amber-500/40 bg-amber-500/10' : 'border-emerald-500/30 bg-emerald-500/10'}`}>
      <div className="min-w-0 text-sm">
        <p className={`flex items-center gap-2 font-semibold ${lejos ? 'text-amber-400' : 'text-emerald-400'}`}>
          {lejos ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          {lejos ? 'Lejos del lugar: quedará para revisar' : d.status === 'ok' ? 'Estás en el lugar' : 'GPS listo'}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" /> Precisión ±{gps.accuracy ?? '?'} m{d.dist != null ? ` · a ${d.dist} m del lugar` : ''}
        </p>
      </div>
      <button onClick={onRetry} aria-label="Actualizar GPS" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground active:scale-95">
        <RotateCcw className="h-4 w-4" />
      </button>
    </div>
  );
}