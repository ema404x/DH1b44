import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Users, Map, Layers, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MapaJefesVista from '@/components/mapa-jefes/MapaJefesVista';

export default function MapaJefes() {
  const [modo, setModo] = useState('jefe'); // 'jefe' | 'comuna' | 'cluster'

  const { data: rawDirecciones = [], isLoading: loadingDir, refetch: refetchDir } = useQuery({
    queryKey: ['direcciones'],
    queryFn: () => base44.entities.Direccion.list('jefe_sitio', 500),
  });

  const { data: rawLocations = [], isLoading: loadingLoc, refetch: refetchLoc } = useQuery({
    queryKey: ['locationData'],
    queryFn: () => base44.entities.LocationData.list('-created_date', 500),
  });

  const isLoading = loadingDir || loadingLoc;

  // Construir datos para el mapa: una entrada por dirección con coords promedio de sus escuelas
  const { direcciones, escuelas } = useMemo(() => {
    // Agrupar locations por direccion_id para obtener coords
    const coordsByDir = {};
    rawLocations.forEach(loc => {
      if (loc.direccion_id && loc.gps_latitude && loc.gps_longitude) {
        if (!coordsByDir[loc.direccion_id]) coordsByDir[loc.direccion_id] = [];
        coordsByDir[loc.direccion_id].push({ lat: loc.gps_latitude, lng: loc.gps_longitude });
      }
    });

    const dirs = rawDirecciones.map(d => {
      const coords = coordsByDir[d.id];
      let lat = null, lng = null;
      if (coords && coords.length > 0) {
        lat = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
        lng = coords.reduce((s, c) => s + c.lng, 0) / coords.length;
      }
      // Normalizar comuna al formato esperado
      const comunaMap = { '8A': 'COMUNA 8A1', '8B': 'COMUNA 8B1', '10A': 'COMUNA 10A1' };
      return { ...d, lat, lng, comuna: comunaMap[d.comuna] || d.comuna };
    });

    const escs = rawLocations.map(loc => ({
      id: loc.id,
      direccion_mapa_id: loc.direccion_id,
      nombre: loc.establecimiento,
      jefe_sitio: loc.jefe_sitio,
      comuna: loc.comuna,
    }));

    return { direcciones: dirs, escuelas: escs };
  }, [rawDirecciones, rawLocations]);

  const sinCoords = direcciones.filter(d => !d.lat || !d.lng).length;
  const conCoords = direcciones.filter(d => d.lat && d.lng).length;

  const MODOS = [
    { id: 'jefe', label: 'Por Jefe', icon: Users },
    { id: 'comuna', label: 'Por Comuna', icon: Map },
    { id: 'cluster', label: 'Cluster', icon: Layers },
  ];

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            Mapa de Jefes de Sitio
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {direcciones.length} direcciones · {escuelas.length} escuelas · {conCoords} geocodificadas
            {sinCoords > 0 && <span className="text-amber-600"> · {sinCoords} sin coordenadas</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { refetchDir(); refetchLoc(); }}
            className="gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Selector de modo */}
      <div className="flex gap-2">
        {MODOS.map(m => (
          <button
            key={m.id}
            onClick={() => setModo(m.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
              modo === m.id
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
            }`}
          >
            <m.icon className="h-4 w-4" />
            {m.label}
          </button>
        ))}
      </div>

      {/* Cuerpo */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <MapaJefesVista direcciones={direcciones} escuelas={escuelas} modo={modo} />
      )}
    </div>
  );
}