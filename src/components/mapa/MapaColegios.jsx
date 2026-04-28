import React, { useRef, useState, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Search, School, Loader2 } from 'lucide-react';

const COMUNA_COLORS = {
  '8A': '#3b82f6',
  '8B': '#a855f7',
  '10A': '#10b981',
};

const createSchoolIcon = (comuna, isSelected = false) => {
  const color = COMUNA_COLORS[comuna] || '#64748b';
  const size = isSelected ? 40 : 32;
  return L.divIcon({
    html: `
      <div style="
        background: ${color};
        width: ${size}px;
        height: ${size}px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 3px solid white;
        box-shadow: 0 3px 10px rgba(0,0,0,0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
      ">
        <div style="transform: rotate(45deg); font-size: ${isSelected ? 16 : 13}px;">🏫</div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -(size + 2)],
    className: 'school-marker',
  });
};

// Geocodifica una dirección usando Nominatim (OpenStreetMap)
const geocodeAddress = async (address) => {
  const query = encodeURIComponent(`${address}, Buenos Aires, Argentina`);
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
    { headers: { 'Accept-Language': 'es' } }
  );
  const data = await res.json();
  if (data.length > 0) {
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  }
  return null;
};

export default function MapaColegios() {
  const mapRef = useRef(null);
  const [search, setSearch] = useState('');
  const [selectedComuna, setSelectedComuna] = useState('all');
  const [selected, setSelected] = useState(null);
  const [coords, setCoords] = useState({}); // { locationId: { lat, lon } }
  const [geocoding, setGeocoding] = useState(false);

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

  // Geocodificar todas las direcciones que no tengan coords aún
  useEffect(() => {
    if (locations.length === 0 || direcciones.length === 0) return;

    const toGeocode = locations.filter(loc => {
      if (coords[loc.id]) return false; // ya tiene coords
      const dir = loc.direccion_id ? direccionesMap[loc.direccion_id] : null;
      return !!dir?.direccion;
    });

    if (toGeocode.length === 0) return;

    setGeocoding(true);

    // Geocodificar de a uno para no saturar Nominatim
    const runSequential = async () => {
      const newCoords = { ...coords };
      for (const loc of toGeocode) {
        const dir = direccionesMap[loc.direccion_id];
        if (!dir?.direccion) continue;
        const result = await geocodeAddress(dir.direccion);
        if (result) {
          newCoords[loc.id] = result;
        }
        // Esperar 300ms entre requests para respetar rate limit de Nominatim
        await new Promise(r => setTimeout(r, 300));
      }
      setCoords(newCoords);
      setGeocoding(false);
    };

    runSequential();
  }, [locations, direcciones]);

  const filtered = useMemo(() => {
    return locations.filter(l => {
      const matchSearch = !search || l.establecimiento?.toLowerCase().includes(search.toLowerCase());
      const matchComuna = selectedComuna === 'all' || l.comuna === selectedComuna;
      return matchSearch && matchComuna;
    });
  }, [locations, search, selectedComuna]);

  const filteredWithCoords = useMemo(() => {
    return filtered.filter(l => coords[l.id]);
  }, [filtered, coords]);

  const center = useMemo(() => {
    if (filteredWithCoords.length > 0) {
      return [
        filteredWithCoords.reduce((s, l) => s + coords[l.id].lat, 0) / filteredWithCoords.length,
        filteredWithCoords.reduce((s, l) => s + coords[l.id].lon, 0) / filteredWithCoords.length,
      ];
    }
    return [-34.6037, -58.3816];
  }, [filteredWithCoords]);

  const handleSelect = (loc) => {
    setSelected(loc);
    const c = coords[loc.id];
    if (c && mapRef.current) {
      mapRef.current.setView([c.lat, c.lon], 16, { animate: true });
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
          { label: 'En el mapa', value: Object.keys(coords).length, color: 'text-emerald-600' },
          { label: 'Geocodificando', value: geocoding ? '...' : `${locations.length - Object.keys(coords).length} pendientes`, color: 'text-amber-600' },
        ].map((s, i) => (
          <div key={i} className="rounded-lg border bg-card p-3 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Geocoding indicator */}
      {geocoding && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 px-4 py-2 rounded-lg border">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Geocodificando direcciones... ({Object.keys(coords).length}/{locations.length})
        </div>
      )}

      {/* Filtros */}
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
          <MapContainer ref={mapRef} center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="© OpenStreetMap contributors"
              maxZoom={19}
            />
            {filteredWithCoords.map(loc => {
              const c = coords[loc.id];
              const dir = loc.direccion_id ? direccionesMap[loc.direccion_id] : null;
              return (
                <Marker
                  key={loc.id}
                  position={[c.lat, c.lon]}
                  icon={createSchoolIcon(loc.comuna, selected?.id === loc.id)}
                  eventHandlers={{ click: () => setSelected(loc) }}
                >
                  <Popup>
                    <div className="min-w-48">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">🏫</span>
                        <h3 className="font-bold text-sm">{loc.establecimiento}</h3>
                      </div>
                      {dir?.direccion && (
                        <p className="text-xs text-gray-500 mb-1">📍 {dir.direccion}</p>
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
              );
            })}
          </MapContainer>
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
              <div className="p-6 text-center text-sm text-muted-foreground">Sin resultados</div>
            ) : (
              filtered.map(loc => {
                const dir = loc.direccion_id ? direccionesMap[loc.direccion_id] : null;
                const hasCoords = !!coords[loc.id];
                return (
                  <button
                    key={loc.id}
                    onClick={() => handleSelect(loc)}
                    disabled={!hasCoords}
                    className={`w-full text-left px-3 py-2.5 transition-colors ${
                      selected?.id === loc.id ? 'bg-accent' : 'hover:bg-accent/50'
                    } ${!hasCoords ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-base mt-0.5">🏫</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{loc.establecimiento}</p>
                        {dir?.direccion && (
                          <p className="text-xs text-muted-foreground truncate">{dir.direccion}</p>
                        )}
                        <div className="flex gap-1.5 mt-1 flex-wrap">
                          {loc.comuna && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-semibold"
                              style={{ background: COMUNA_COLORS[loc.comuna] || '#64748b' }}>
                              {loc.comuna}
                            </span>
                          )}
                          {!hasCoords && geocoding && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold flex items-center gap-1">
                              <Loader2 className="h-2.5 w-2.5 animate-spin" /> geocodificando
                            </span>
                          )}
                        </div>
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