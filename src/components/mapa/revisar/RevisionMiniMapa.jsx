import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MAP_TILE_URL, MAP_TILE_ATTRIBUTION, MAP_TILE_MAX_ZOOM } from '@/lib/mapTiles';

const punto = (color, size = 18) => L.divIcon({
  html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.45)"></div>`,
  iconSize: [size, size], iconAnchor: [size / 2, size / 2], className: '',
});
const ICONOS = { actual: punto('#ef4444'), sugerida: punto('#10b981'), manual: punto('#3b82f6', 24) };
const CABA = [-34.6037, -58.3816];

function Encuadre({ puntos }) {
  const map = useMap();
  useEffect(() => {
    if (puntos.length > 1) map.fitBounds(L.latLngBounds(puntos), { padding: [40, 40], maxZoom: 17 });
    else map.setView(puntos[0] || CABA, puntos.length ? 16 : 12);
  }, [map, JSON.stringify(puntos)]);
  return null;
}

function SeguirFoco({ foco }) {
  const map = useMap();
  useEffect(() => { if (foco) map.panTo([foco.lat, foco.lng]); }, [map, foco]);
  return null;
}

function ClickMover({ onMove }) {
  useMapEvents({ click: (e) => onMove(e.latlng) });
  return null;
}

export default function RevisionMiniMapa({ actuales, sugerida, manual, onManualMove, foco }) {
  const puntos = [...actuales.map((a) => [a.lat, a.lng]), ...(sugerida ? [[sugerida.lat, sugerida.lng]] : [])];
  return (
    <div className="h-64 rounded-xl overflow-hidden border border-border/60">
      <MapContainer center={puntos[0] || CABA} zoom={15} className="h-full w-full" scrollWheelZoom>
        <TileLayer url={MAP_TILE_URL} attribution={MAP_TILE_ATTRIBUTION} maxZoom={MAP_TILE_MAX_ZOOM} />
        <Encuadre puntos={puntos} />
        <SeguirFoco foco={foco} />
        {actuales.map((a) => (
          <Marker key={a.key} position={[a.lat, a.lng]} icon={ICONOS.actual}><Tooltip>{a.label}</Tooltip></Marker>
        ))}
        {sugerida && <Marker position={[sugerida.lat, sugerida.lng]} icon={ICONOS.sugerida}><Tooltip>Sugerida por la dirección</Tooltip></Marker>}
        {manual && (
          <>
            <ClickMover onMove={onManualMove} />
            <Marker position={[manual.lat, manual.lng]} icon={ICONOS.manual} draggable
              eventHandlers={{ dragend: (e) => onManualMove(e.target.getLatLng()) }}>
              <Tooltip permanent direction="top" offset={[0, -12]}>Arrastrame</Tooltip>
            </Marker>
          </>
        )}
      </MapContainer>
    </div>
  );
}