import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin } from 'lucide-react';

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
  onClickToAdd,
  isDraggable = true 
}) {
  const [mapCenter, setMapCenter] = useState([-34.6037, -58.3816]);
  const [userLocation, setUserLocation] = useState(null);
  const [tracking, setTracking] = useState(true);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const draggedMarkerRef = useRef(null);
  const watchIdRef = useRef(null);

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
    if (mapRef.current && validLocations.length > 0) {
      const avgLat = validLocations.reduce((sum, l) => sum + l.latitude, 0) / validLocations.length;
      const avgLng = validLocations.reduce((sum, l) => sum + l.longitude, 0) / validLocations.length;
      mapRef.current.setView([avgLat, avgLng], 13, { animate: true });
    }
  }, [validLocations]);

  useEffect(() => {
    if (selectedLocation?.latitude && selectedLocation?.longitude && mapRef.current) {
      mapRef.current.setView([selectedLocation.latitude, selectedLocation.longitude], 16, { animate: true });
    }
  }, [selectedLocation]);

  useEffect(() => {
    if (!navigator.geolocation) return;

    const startTracking = () => {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ latitude, longitude });
          if (tracking && mapRef.current) {
            mapRef.current.setView([latitude, longitude], 16, { animate: true });
          }
        },
        (error) => console.error('Error GPS:', error),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
      );
    };

    startTracking();

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [tracking]);

  const handleMarkerDragEnd = (marker, locationId) => {
    const latLng = marker.getLatLng();
    if (onLocationUpdate) {
      onLocationUpdate(locationId, {
        latitude: latLng.lat,
        longitude: latLng.lng,
      });
    }
  };

  return (
    <MapContainer
      ref={mapRef}
      center={mapCenter}
      zoom={13}
      style={{ height: '100%', width: '100%' }}
      className="rounded-xl overflow-hidden"
      onContextMenu={(e) => {
        e.preventDefault();
        if (onClickToAdd) {
          onClickToAdd({ latitude: e.latlng.lat, longitude: e.latlng.lng });
        }
      }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='© OpenStreetMap contributors'
        maxZoom={19}
      />
      
      {userLocation && (
        <>
          <Marker
            position={[userLocation.latitude, userLocation.longitude]}
            icon={L.divIcon({
              html: `
                <div style="
                  background: linear-gradient(135deg, #3b82f6, #2563eb);
                  width: 50px;
                  height: 50px;
                  border-radius: 50%;
                  border: 4px solid white;
                  box-shadow: 0 0 0 3px #3b82f6, 0 4px 12px rgba(59, 130, 246, 0.4);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  cursor: pointer;
                  font-size: 24px;
                ">
                  🎯
                </div>
              `,
              iconSize: [50, 50],
              iconAnchor: [25, 25],
              popupAnchor: [0, -25],
              className: 'user-location-marker',
            })}
          >
            <Popup>
              <div className="text-xs">
                <p className="font-semibold">Tu ubicación</p>
                <p>{userLocation.latitude.toFixed(5)}, {userLocation.longitude.toFixed(5)}</p>
              </div>
            </Popup>
          </Marker>
          <Circle
            center={[userLocation.latitude, userLocation.longitude]}
            radius={20}
            pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.1 }}
          />
        </>
      )}

      {validLocations.length > 0 ? validLocations.map(loc => (
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
          )) : null}
          </MapContainer>
          );
          }

export function MapControls({ onToggleTracking, tracking }) {
  return (
    <div className="absolute bottom-4 right-4 z-[1000] flex flex-col gap-2">
      <button
        onClick={onToggleTracking}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all shadow-lg ${
          tracking
            ? 'bg-blue-500 text-white hover:bg-blue-600'
            : 'bg-white text-blue-500 border border-blue-500 hover:bg-blue-50'
        }`}
      >
        <MapPin className="h-4 w-4" />
        {tracking ? 'Siguiendo' : 'Seguir ubicación'}
      </button>
    </div>
  );
}