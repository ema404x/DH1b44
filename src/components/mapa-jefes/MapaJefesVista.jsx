import React, { useMemo, useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import FiltrosJefes from './FiltrosJefes';
import FiltrosComunas from './FiltrosComunas';

// Colores para hasta 10 jefes de sitio
const JEFE_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#84cc16',
];

const COMUNA_COLORS = {
  'COMUNA 8A1': '#3b82f6',
  'COMUNA 8B1': '#a855f7',
  'COMUNA 10A1': '#10b981',
};

function buildIcon(color, size = 28) {
  return L.divIcon({
    html: `<div style="
      background:${color};
      width:${size}px;height:${size}px;
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      border:2.5px solid white;
      box-shadow:0 2px 8px rgba(0,0,0,0.35);
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -(size + 4)],
    className: '',
  });
}

function PopupContent({ dir, escuelas }) {
  const listaEscuelas = escuelas.filter(e => e.direccion_mapa_id === dir.id);
  return (
    <div style={{ minWidth: '210px', maxWidth: '280px', fontFamily: 'inherit' }}>
      <div className="font-bold text-sm mb-1">{dir.direccion}</div>
      <div className="text-xs text-gray-500 mb-1">
        <span className="mr-2">👤 {dir.jefe_sitio}</span>
        <span>🏘️ {dir.comuna}</span>
      </div>
      {listaEscuelas.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-200">
          <p className="text-xs font-semibold text-gray-600 mb-1">
            🏫 {listaEscuelas.length} escuela{listaEscuelas.length !== 1 ? 's' : ''}
          </p>
          <ul className="space-y-0.5 max-h-40 overflow-y-auto pr-1">
            {listaEscuelas.map((e, i) => (
              <li key={i} className="text-xs text-gray-700 leading-tight">• {e.nombre}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function MapaJefesVista({ direcciones, escuelas, modo }) {
  const mapRef = useRef(null);
  const [filtrosJefe, setFiltrosJefe] = useState(new Set());
  const [filtrosComuna, setFiltrosComuna] = useState(new Set());

  // Construir índice de jefes → color
  const jefes = useMemo(() => {
    const set = [...new Set(direcciones.map(d => d.jefe_sitio).filter(Boolean))].sort();
    const map = {};
    set.forEach((j, i) => { map[j] = JEFE_COLORS[i % JEFE_COLORS.length]; });
    return map;
  }, [direcciones]);

  const comunas = useMemo(() =>
    [...new Set(direcciones.map(d => d.comuna).filter(Boolean))].sort(),
    [direcciones]
  );

  // Al cambiar el modo, limpiar filtros
  useEffect(() => {
    setFiltrosJefe(new Set());
    setFiltrosComuna(new Set());
  }, [modo]);

  const dirConCoords = useMemo(
    () => direcciones.filter(d => d.lat && d.lng),
    [direcciones]
  );

  const filtradas = useMemo(() => {
    return dirConCoords.filter(d => {
      if (modo === 'jefe' && filtrosJefe.size > 0 && !filtrosJefe.has(d.jefe_sitio)) return false;
      if (modo === 'comuna' && filtrosComuna.size > 0 && !filtrosComuna.has(d.comuna)) return false;
      return true;
    });
  }, [dirConCoords, modo, filtrosJefe, filtrosComuna]);

  const center = useMemo(() => {
    if (filtradas.length === 0) return [-34.663, -58.445];
    const latSum = filtradas.reduce((s, d) => s + d.lat, 0);
    const lngSum = filtradas.reduce((s, d) => s + d.lng, 0);
    return [latSum / filtradas.length, lngSum / filtradas.length];
  }, [filtradas]);

  const getColor = (dir) => {
    if (modo === 'comuna') return COMUNA_COLORS[dir.comuna] || '#64748b';
    return jefes[dir.jefe_sitio] || '#64748b';
  };

  const sinCoords = direcciones.length - dirConCoords.length;

  return (
    <div className="flex flex-col lg:flex-row gap-4" style={{ minHeight: '580px' }}>
      {/* Panel lateral de filtros */}
      <div className="w-full lg:w-64 flex-shrink-0 space-y-3">
        {modo === 'jefe' && (
          <FiltrosJefes
            jefes={jefes}
            filtros={filtrosJefe}
            onChange={setFiltrosJefe}
            direcciones={direcciones}
          />
        )}
        {modo === 'comuna' && (
          <FiltrosComunas
            comunas={comunas}
            colores={COMUNA_COLORS}
            filtros={filtrosComuna}
            onChange={setFiltrosComuna}
            direcciones={direcciones}
          />
        )}
        {modo === 'cluster' && (
          <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
            Modo cluster: todos los pins agrupados. Hacé zoom para separarlos.
          </div>
        )}

        {sinCoords > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
            ⚠ {sinCoords} dirección{sinCoords !== 1 ? 'es' : ''} sin coordenadas. Re-importá para geocodificarlas.
          </div>
        )}

        {/* Leyenda */}
        <div className="rounded-lg border bg-card p-3 space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            {modo === 'jefe' ? 'Jefes de sitio' : modo === 'comuna' ? 'Comunas' : 'Total'}
          </p>
          {modo === 'jefe' && Object.entries(jefes).map(([jefe, color]) => (
            <div key={jefe} className="flex items-center gap-2 text-xs">
              <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ background: color }} />
              <span className="truncate" title={jefe}>{jefe}</span>
            </div>
          ))}
          {modo === 'comuna' && Object.entries(COMUNA_COLORS).map(([com, color]) => (
            <div key={com} className="flex items-center gap-2 text-xs">
              <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ background: color }} />
              <span>{com}</span>
            </div>
          ))}
          {modo === 'cluster' && (
            <div className="text-xs text-muted-foreground">
              {filtradas.length} de {direcciones.length} direcciones
            </div>
          )}
        </div>
      </div>

      {/* Mapa */}
      <div className="flex-1 rounded-xl overflow-hidden border shadow-sm" style={{ minHeight: '520px' }}>
        <MapContainer
          ref={mapRef}
          center={center}
          zoom={13}
          style={{ height: '100%', width: '100%', minHeight: '520px' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="© OpenStreetMap contributors"
            maxZoom={19}
          />
          {filtradas.map(dir => (
            <Marker
              key={dir.id}
              position={[dir.lat, dir.lng]}
              icon={buildIcon(getColor(dir))}
            >
              <Popup maxWidth={300}>
                <PopupContent dir={dir} escuelas={escuelas} />
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}