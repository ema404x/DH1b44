import React, { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Search, Loader2 } from 'lucide-react';

const COMUNA_COLORS = {
  '8A': '#3b82f6',
  '8B': '#a855f7',
  '10A': '#10b981',
};

const createSchoolIcon = (comuna, isSelected = false) => {
  const color = COMUNA_COLORS[comuna] || '#64748b';
  const size = isSelected ? 40 : 32;
  return L.divIcon({
    html: `<div style="background:${color};width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;cursor:pointer;">
        <div style="transform:rotate(45deg);font-size:${isSelected ? 16 : 13}px;">🏫</div>
      </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -(size + 2)],
    className: 'school-marker',
  });
};

const geocodeAddress = async (address) => {
  const query = encodeURIComponent(`${address}, Buenos Aires, Argentina`);
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
    { headers: { 'Accept-Language': 'es' } }
  );
  const data = await res.json();
  if (data.length > 0) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  return null;
};

export default function MapaColegios() {
  const mapRef = useRef(null);
  const [search, setSearch] = useState('');
  const [selectedComuna, setSelectedComuna] = useState('all');
  const [selected, setSelected] = useState(null);
  const [geocodingProgress, setGeocodingProgress] = useState(null); // null = idle, number = progreso
  const queryClient = useQueryClient();

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['locationData'],
    queryFn: () => base44.entities.LocationData.list('-created_date', 500),
  });

  const { data: direcciones = [] } = useQuery({
    queryKey: ['direcciones'],
    queryFn: () => base44.entities.Direccion.list('-created_date', 200),
  });

  const direccionesMap = useMemo(() => {
    const map = {};
    direcciones.forEach(d => { map[d.id] = d; });
    return map;
  }, [direcciones]);

  // Colegios que ya tienen coords guardadas
  const locationsWithCoords = useMemo(
    () => locations.filter(l => l.gps_latitude && l.gps_longitude),
    [locations]
  );

  // Colegios sin coords que tienen dirección → hay que geocodificar y guardar
  const pending = useMemo(
    () => locations.filter(l => !l.gps_latitude && l.direccion_id && direccionesMap[l.direccion_id]?.direccion),
    [locations, direccionesMap]
  );

  const [geocodingStarted, setGeocodingStarted] = useState(false);

  // Geocodificar los pendientes UNA SOLA VEZ y guardar en la entidad
  // Se ejecuta SOLO si el usuario lo solicita manualmente (botón)
  const runGeocoding = useCallback(async () => {
    if (pending.length === 0 || geocodingProgress !== null) return;
    setGeocodingProgress(0);
    setGeocodingStarted(true);
    let done = 0;
    // Procesar en lotes de 10 para no hacer demasiadas llamadas
    for (const loc of pending) {
      const dir = direccionesMap[loc.direccion_id];
      const result = await geocodeAddress(dir.direccion);
      if (result) {
        await base44.entities.LocationData.update(loc.id, {
          gps_latitude: result.lat,
          gps_longitude: result.lon,
        });
      }
      done++;
      setGeocodingProgress(done);
      await new Promise(r => setTimeout(r, 400)); // respetar rate limit Nominatim
    }
    setGeocodingProgress(null);
    queryClient.invalidateQueries({ queryKey: ['locationData'] });
  }, [pending, direccionesMap, geocodingProgress, queryClient]);

  const filtered = useMemo(() => {
    return locationsWithCoords.filter(l => {
      const matchSearch = !search || l.establecimiento?.toLowerCase().includes(search.toLowerCase());
      const matchComuna = selectedComuna === 'all' || l.comuna === selectedComuna;
      return matchSearch && matchComuna;
    });
  }, [locationsWithCoords, search, selectedComuna]);

  const center = useMemo(() => {
    if (filtered.length > 0) {
      return [
        filtered.reduce((s, l) => s + l.gps_latitude, 0) / filtered.length,
        filtered.reduce((s, l) => s + l.gps_longitude, 0) / filtered.length,
      ];
    }
    return [-34.6037, -58.3816];
  }, [filtered]);

  const handleSelect = (loc) => {
    setSelected(loc);
    if (mapRef.current) {
      mapRef.current.setView([loc.gps_latitude, loc.gps_longitude], 16, { animate: true });
    }
  };

  const comunas = ['8A', '8B', '10A'];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-2 border-border border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Colegios', value: locations.length, color: 'text-primary' },
          { label: 'En el mapa', value: locationsWithCoords.length, color: 'text-emerald-600' },
          { label: 'Sin ubicar', value: pending.length, color: 'text-amber-600' },
        ].map((s, i) => (
          <div key={i} className="rounded-lg border bg-card p-3 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Geocodificación manual */}
      {pending.length > 0 && geocodingProgress === null && !geocodingStarted && (
        <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 flex-shrink-0" />
            <span><strong>{pending.length}</strong> colegios sin coordenadas GPS. Podés geocodificarlos para verlos en el mapa.</span>
          </div>
          <button
            onClick={runGeocoding}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors flex-shrink-0"
          >
            Geocodificar
          </button>
        </div>
      )}

      {/* Barra de progreso geocodificación */}
      {geocodingProgress !== null && (
        <div className="flex items-center gap-3 text-sm bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2.5 rounded-lg">
          <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
          <span>
            Guardando ubicaciones en la base de datos... ({geocodingProgress}/{pending.length}) — la próxima vez cargará al instante.
          </span>
        </div>
      )}

      {/* Filtros por comuna */}
      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-xs text-muted-foreground font-medium">Comunas:</span>
        {comunas.map(c => (
          <button
            key={c}
            onClick={() => setSelectedComuna(selectedComuna === c ? 'all' : c)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
              selectedComuna === c ? 'text-white border-transparent' : 'bg-transparent border-border text-muted-foreground hover:border-primary/40'
            }`}
            style={selectedComuna === c ? { background: COMUNA_COLORS[c] } : {}}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: COMUNA_COLORS[c] }} />
            {c}
          </button>
        ))}
        {selectedComuna !== 'all' && (
          <button onClick={() => setSelectedComuna('all')} className="text-xs text-muted-foreground underline">
            Ver todas
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Mapa */}
        <div className="lg:col-span-2 rounded-xl overflow-hidden border shadow-sm" style={{ height: '520px' }}>
          {filtered.length > 0 ? (
            <MapContainer ref={mapRef} center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="© OpenStreetMap contributors"
                maxZoom={19}
              />
              {filtered.map(loc => (
                <Marker
                  key={loc.id}
                  position={[loc.gps_latitude, loc.gps_longitude]}
                  icon={createSchoolIcon(loc.comuna, selected?.id === loc.id)}
                  eventHandlers={{ click: () => setSelected(loc) }}
                >
                  <Popup>
                    <div className="min-w-44">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">🏫</span>
                        <h3 className="font-bold text-sm">{loc.establecimiento}</h3>
                      </div>
                      {loc.direccion_id && direccionesMap[loc.direccion_id]?.direccion && (
                        <p className="text-xs text-gray-500 mb-1">📍 {direccionesMap[loc.direccion_id].direccion}</p>
                      )}
                      <div className="flex gap-2 flex-wrap text-xs mt-2">
                        {loc.comuna && (
                          <span className="px-2 py-0.5 rounded-full text-white font-semibold"
                            style={{ background: COMUNA_COLORS[loc.comuna] || '#64748b' }}>
                            {loc.comuna}
                          </span>
                        )}
                        {loc.jefe_sitio && <span className="text-gray-600">👤 {loc.jefe_sitio}</span>}
                      </div>
                      {loc.m2 && <p className="text-xs text-gray-500 mt-1">📐 {loc.m2} m²</p>}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              {geocodingProgress !== null ? 'Cargando ubicaciones...' : 'Sin colegios con coordenadas disponibles'}
            </div>
          )}
        </div>

        {/* Lista lateral */}
        <div className="flex flex-col gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar colegio..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <p className="text-xs text-muted-foreground">{filtered.length} colegios</p>
          <div className="overflow-y-auto rounded-lg border bg-card divide-y" style={{ maxHeight: '460px' }}>
            {filtered.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                {geocodingProgress !== null ? 'Geocodificando...' : 'Sin resultados'}
              </div>
            ) : (
              filtered.map(loc => {
                const dir = loc.direccion_id ? direccionesMap[loc.direccion_id] : null;
                return (
                  <button
                    key={loc.id}
                    onClick={() => handleSelect(loc)}
                    className={`w-full text-left px-3 py-2.5 transition-colors ${
                      selected?.id === loc.id ? 'bg-accent' : 'hover:bg-accent/50'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-base mt-0.5">🏫</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{loc.establecimiento}</p>
                        {dir?.direccion && (
                          <p className="text-xs text-muted-foreground truncate">{dir.direccion}</p>
                        )}
                        {loc.comuna && (
                          <span className="mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded-full text-white font-semibold"
                            style={{ background: COMUNA_COLORS[loc.comuna] || '#64748b' }}>
                            {loc.comuna}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}