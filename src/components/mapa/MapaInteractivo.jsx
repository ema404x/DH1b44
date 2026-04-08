import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const COLOR_MAP = {
  blue: '#3b82f6',
  green: '#10b981',
  purple: '#a855f7',
  orange: '#f97316',
  red: '#ef4444',
};

const createCustomIcon = (color) => {
  const actualColor = COLOR_MAP[color] || COLOR_MAP.blue;
  
  return L.divIcon({
    html: `
      <div style="
        background-color: ${actualColor};
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 18px;
      ">
        📍
      </div>
    `,
    iconSize: [40, 40],
    className: 'custom-marker',
  });
};

export default function MapaInteractivo({ locations, selectedLocation, onSelectLocation }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Calcular centro del mapa
    const center = locations.length > 0
      ? [
          locations.reduce((sum, l) => sum + l.latitude, 0) / locations.length,
          locations.reduce((sum, l) => sum + l.longitude, 0) / locations.length,
        ]
      : [-34.6037, -58.3816]; // Buenos Aires default

    // Crear mapa
    const map = L.map(mapRef.current).setView(center, 13);

    // Tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    // Agregar marcadores
    locations.forEach(loc => {
      if (loc.latitude && loc.longitude) {
        const marker = L.marker([loc.latitude, loc.longitude], {
          icon: createCustomIcon(loc.color || 'blue'),
        }).addTo(map);

        marker.bindPopup(`
          <div style="font-size: 12px; min-width: 180px;">
            <strong>${loc.name}</strong>
            ${loc.address ? `<br/><small>${loc.address}</small>` : ''}
            <br/><small style="color: #666;">Escaneos: ${loc.total_scans || 0}</small>
            <br/><small style="color: #666;">GPS: ${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}</small>
          </div>
        `);

        marker.on('click', () => onSelectLocation(loc));

        markersRef.current[loc.id] = marker;
      }
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [locations]);

  // Actualizar zoom en ubicación seleccionada
  useEffect(() => {
    if (selectedLocation && mapInstanceRef.current) {
      const marker = markersRef.current[selectedLocation.id];
      if (marker) {
        mapInstanceRef.current.setView(
          [selectedLocation.latitude, selectedLocation.longitude],
          15,
          { animate: true }
        );
        marker.openPopup();
      }
    }
  }, [selectedLocation]);

  return (
    <div
      ref={mapRef}
      className="w-full h-full"
      style={{ zIndex: 1 }}
    />
  );
}