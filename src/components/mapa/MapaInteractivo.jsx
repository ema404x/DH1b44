import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const COLOR_MAP = {
  blue: '#3b82f6',
  green: '#10b981',
  purple: '#a855f7',
  orange: '#f97316',
  red: '#ef4444',
  yellow: '#eab308',
  pink: '#ec4899',
};

const createCustomIcon = (color) => {
  const actualColor = COLOR_MAP[color] || COLOR_MAP.blue;
  
  return L.divIcon({
    html: `
      <div style="
        background: linear-gradient(135deg, ${actualColor}, ${actualColor}dd);
        width: 44px;
        height: 44px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.25), inset 0 0 0 2px ${actualColor}40;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 20px;
        font-weight: bold;
        transition: transform 0.2s;
      ">
        📍
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 44],
    popupAnchor: [0, -44],
    className: 'custom-marker',
  });
};

export default function MapaInteractivo({ 
  locations, 
  selectedLocation, 
  onSelectLocation, 
  onLocationUpdate,
  isDraggable = true 
}) {
  const [mapCenter, setMapCenter] = useState([-34.6037, -58.3816]);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const draggedMarkerRef = useRef(null);

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
    if (selectedLocation?.latitude && selectedLocation?.longitude && mapRef.current) {
      mapRef.current.setView([selectedLocation.latitude, selectedLocation.longitude], 16, { animate: true });
    }
  }, [selectedLocation]);

  const handleMarkerDragEnd = (marker, locationId) => {
    const latLng = marker.getLatLng();
    if (onLocationUpdate) {
      onLocationUpdate(locationId, {
        latitude: latLng.lat,
        longitude: latLng.lng,
      });
    }
  };

  if (validLocations.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 border border-border rounded-lg">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold text-foreground">No hay ubicaciones</p>
          <p className="text-sm text-muted-foreground">Crea ubicaciones con coordenadas GPS válidas</p>
        </div>
      </div>
    );
  }

  return (
    <MapContainer
      ref={mapRef}
      center={mapCenter}
      zoom={13}
      style={{ height: '100%', width: '100%' }}
      className="rounded-xl overflow-hidden"
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
          draggable={isDraggable}
          eventHandlers={{
            click: () => onSelectLocation(loc),
            dragend: (e) => {
              if (isDraggable) {
                handleMarkerDragEnd(e.target, loc.id);
              }
            },
          }}
          ref={(marker) => {
            if (marker) markersRef.current[loc.id] = marker;
          }}
        >
          <Popup className="custom-popup">
            <div className="min-w-64">
              <h3 className="font-semibold text-sm mb-2">{loc.name}</h3>
              {loc.address && (
                <p className="text-xs text-muted-foreground mb-2">{loc.address}</p>
              )}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Escaneos</p>
                  <p className="font-semibold">{loc.total_scans || 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Estado</p>
                  <p className="font-semibold">{loc.is_active ? '✓ Activo' : '✗ Inactivo'}</p>
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                {loc.latitude?.toFixed(5)}, {loc.longitude?.toFixed(5)}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}