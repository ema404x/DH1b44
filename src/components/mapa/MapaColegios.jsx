import React, { useRef, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, School, MapPin } from 'lucide-react';

const COMUNA_COLORS = {
  '8A': '#3b82f6',
  '8B': '#a855f7',
  '10A': '#10b981',
};

const createSchoolIcon = (comuna) => {
  const color = COMUNA_COLORS[comuna] || '#64748b';
  return L.divIcon({
    html: `
      <div style="
        background: ${color};
        width: 32px;
        height: 32px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 3px solid white;
        box-shadow: 0 3px 10px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      ">
        <div style="transform: rotate(45deg); font-size: 13px;">🏫</div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -34],
    className: 'school-marker',
  });
};

export default function MapaColegios() {
  const mapRef = useRef(null);
  const [search, setSearch] = useState('');
  const [selectedComuna, setSelectedComuna] = useState('all');
  const [selected, setSelected] = useState(null);

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

  // Solo los que tienen coordenadas GPS
  const withCoords = useMemo(() => {
    return locations.filter(l => {
      const dir = l.direccion_id ? direccionesMap[l.direccion_id] : null;
      // Podemos usar coordenadas futuras en LocationData o de la dirección
      // Por ahora mostramos todos con coordenadas conocidas
      return l.gps_latitude && l.gps_longitude;
    });
  }, [locations, direccionesMap]);

  // Todos los colegios (con o sin coords) para la lista lateral
  const filtered = useMemo(() => {
    return locations.filter(l => {
      const matchSearch = !search || l.establecimiento?.toLowerCase().includes(search.toLowerCase());
      const matchComuna = selectedComuna === 'all' || l.comuna === selectedComuna;
      return matchSearch && matchComuna;
    });
  }, [locations, search, selectedComuna]);

  const filteredWithCoords = useMemo(() => {
    return withCoords.filter(l => {
      const matchSearch = !search || l.establecimiento?.toLowerCase().includes(search.toLowerCase());
      const matchComuna = selectedComuna === 'all' || l.comuna === selectedComuna;
      return matchSearch && matchComuna;
    });
  }, [withCoords, search, selectedComuna]);

  // Centro aproximado de Buenos Aires si no hay coords
  const center = filteredWithCoords.length > 0
    ? [
        filteredWithCoords.reduce((s, l) => s + l.gps_latitude, 0) / filteredWithCoords.length,
        filteredWithCoords.reduce((s, l) => s + l.gps_longitude, 0) / filteredWithCoords.length,
      ]
    : [-34.6037, -58.3816];

  const handleSelectColegio = (loc) => {
    setSelected(loc);
    if (loc.gps_latitude && loc.gps_longitude && mapRef.current) {
      mapRef.current.setView([loc.gps_latitude, loc.gps_longitude], 16, { animate: true });
    }
  };

  const comunas = ['8A', '8B', '10A'];
  const stats = {
    total: locations.length,
    conCoords: withCoords.length,
    sinCoords: locations.length - withCoords.length,
  };

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
          { label: 'Total Colegios', value: stats.total, color: 'text-primary' },
          { label: 'Con GPS', value: stats.conCoords, color: 'text-emerald-600' },
          { label: 'Sin GPS', value: stats.sinCoords, color: 'text-amber-600' },
        ].map((s, i) => (
          <div key={i} className="rounded-lg border bg-card p-3 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Leyenda comunas */}
      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-xs text-muted-foreground font-medium">Comunas:</span>
        {comunas.map(c => (
          <button
            key={c}
            onClick={() => setSelectedComuna(selectedComuna === c ? 'all' : c)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
              selectedComuna === c
                ? 'text-white border-transparent'
                : 'bg-transparent border-border text-muted-foreground hover:border-primary/40'
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
          {filteredWithCoords.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center bg-muted/30 text-center p-6">
              <School className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="font-semibold text-muted-foreground">Sin coordenadas GPS</p>
              <p className="text-sm text-muted-foreground mt-1">
                Agregá latitud/longitud a los colegios para verlos en el mapa
              </p>
            </div>
          ) : (
            <MapContainer ref={mapRef} center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="© OpenStreetMap contributors"
                maxZoom={19}
              />
              {filteredWithCoords.map(loc => (
                <Marker
                  key={loc.id}
                  position={[loc.gps_latitude, loc.gps_longitude]}
                  icon={createSchoolIcon(loc.comuna)}
                  eventHandlers={{ click: () => setSelected(loc) }}
                >
                  <Popup>
                    <div className="min-w-48">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">🏫</span>
                        <h3 className="font-bold text-sm">{loc.establecimiento}</h3>
                      </div>
                      {loc.direccion_id && direccionesMap[loc.direccion_id] && (
                        <p className="text-xs text-gray-500 mb-1">
                          📍 {direccionesMap[loc.direccion_id].direccion}
                        </p>
                      )}
                      <div className="flex gap-2 flex-wrap text-xs mt-2">
                        {loc.comuna && (
                          <span className="px-2 py-0.5 rounded-full text-white font-semibold"
                            style={{ background: COMUNA_COLORS[loc.comuna] || '#64748b' }}>
                            {loc.comuna}
                          </span>
                        )}
                        {loc.jefe_sitio && (
                          <span className="text-gray-600">👤 {loc.jefe_sitio}</span>
                        )}
                      </div>
                      {loc.m2 && (
                        <p className="text-xs text-gray-500 mt-1">📐 {loc.m2} m²</p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
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
          <div className="overflow-y-auto rounded-lg border bg-card divide-y" style={{ maxHeight: '450px' }}>
            {filtered.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Sin resultados</div>
            ) : (
              filtered.map(loc => {
                const dir = loc.direccion_id ? direccionesMap[loc.direccion_id] : null;
                const hasCoords = !!loc.gps_latitude;
                return (
                  <button
                    key={loc.id}
                    onClick={() => handleSelectColegio(loc)}
                    className={`w-full text-left px-3 py-2.5 hover:bg-accent transition-colors ${
                      selected?.id === loc.id ? 'bg-accent' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-base mt-0.5">🏫</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{loc.establecimiento}</p>
                        {dir && (
                          <p className="text-xs text-muted-foreground truncate">{dir.direccion}</p>
                        )}
                        <div className="flex gap-1.5 mt-1 flex-wrap">
                          {loc.comuna && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-semibold"
                              style={{ background: COMUNA_COLORS[loc.comuna] || '#64748b' }}>
                              {loc.comuna}
                            </span>
                          )}
                          {!hasCoords && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">
                              Sin GPS
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