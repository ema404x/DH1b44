import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
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
  const [mapCenter, setMapCenter] = useState([-34.6037, -58.3816]); // Buenos Aires
  const validLocations = locations.filter(l => 
    l.latitude && l.longitude && 
    typeof l.latitude === 'number' && 
    typeof l.longitude === 'number' &&
    !isNaN(l.latitude) && !isNaN(l.longitude)
  );

  useEffect(() => {
    if (validLocations.length > 0) {
      const avgLat = validLocations.reduce((sum, l) => sum + l.latitude, 0) / validLocations.length;
      const avgLng = validLocations.reduce((sum, l) => sum + l.longitude, 0) / validLocations.length;
      setMapCenter([avgLat, avgLng]);
    }
  }, [validLocations]);

  useEffect(() => {
    if (selectedLocation && selectedLocation.latitude && selectedLocation.longitude) {
      setMapCenter([selectedLocation.latitude, selectedLocation.longitude]);
    }
  }, [selectedLocation]);

  if (validLocations.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-50">
        <div className="text-center text-muted-foreground">
          <p>No hay ubicaciones con coordenadas para mostrar</p>
        </div>
      </div>
    );
  }

  return (
    <MapContainer
      center={mapCenter && mapCenter[0] && mapCenter[1] ? mapCenter : [-34.6037, -58.3816]}
      zoom={13}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='© OpenStreetMap contributors'
        maxZoom={19}
      />
      {validLocations.map(loc => (
        <Marker
          key={loc.id}
          position={[loc.latitude, loc.longitude]}
          icon={createCustomIcon(loc.color || 'blue')}
          eventHandlers={{
            click: () => onSelectLocation(loc),
          }}
        >
          <Popup>
            <div className="text-sm">
              <strong>{loc.name}</strong>
              {loc.address && (
                <>
                  <br />
                  <small>{loc.address}</small>
                </>
              )}
              <br />
              <small className="text-muted-foreground">
                Escaneos: {loc.total_scans || 0}
              </small>
              <br />
              <small className="text-muted-foreground">
                GPS: {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
              </small>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}