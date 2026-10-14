import React from 'react';
import { MapPin, AlertTriangle, Loader2 } from 'lucide-react';
import { getDistanceStatus } from '@/components/fichar/geoDistance';

export default function GpsStatus({ gps, location, loading = false }) {
  const distance = getDistanceStatus(gps?.lat, gps?.lng, location?.latitude, location?.longitude);
  const far = !loading && distance.status === 'far';
  return (
    <div role="status" className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs ${far ? 'bg-destructive/10 text-destructive font-semibold' : 'bg-muted text-muted-foreground'}`}>
      {loading ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : far ? <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> : <MapPin className="h-3.5 w-3.5 shrink-0" />}
      <div>
        {loading ? 'Obteniendo GPS...' : !gps ? 'Sin GPS disponible' : (
          <>
            <p>GPS: {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}</p>
            <p>{far ? `Ubicación no coincide: a ${distance.text} del sitio` : distance.status === 'ok' ? `Dentro del sitio · ${distance.text}` : 'Sin coordenadas del sitio para comparar'}</p>
          </>
        )}
      </div>
    </div>
  );
}