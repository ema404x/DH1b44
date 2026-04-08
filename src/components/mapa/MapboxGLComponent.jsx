import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import Supercluster from 'supercluster';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Plus, X, Loader2 } from 'lucide-react';

// Mapbox token - considera moverlo a secrets
mapboxgl.accessToken = 'pk.eyJ1IjoiZGgxc29mdHdhcmUiLCJhIjoiY203dml5bHZhMWtvZDJ2cXBxcWgzcGF2aCJ9.1234567890';

const getLocationIcon = (color = 'blue') => {
  const colors = {
    blue: '#3b82f6',
    green: '#10b981',
    purple: '#a855f7',
    orange: '#f97316',
    red: '#ef4444',
    yellow: '#eab308',
    pink: '#ec4899',
  };

  const actualColor = colors[color] || colors.blue;

  return `
    <svg width="44" height="44" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.25"/>
        </filter>
      </defs>
      <circle cx="22" cy="22" r="20" fill="${actualColor}" filter="url(#shadow)" opacity="0.95"/>
      <circle cx="22" cy="22" r="18" fill="white" opacity="0.2"/>
      <circle cx="22" cy="22" r="16" fill="none" stroke="white" stroke-width="2" opacity="0.8"/>
      <text x="22" y="26" text-anchor="middle" font-size="20" font-weight="bold">📍</text>
    </svg>
  `;
};

const createMapboxMarker = (location, onClick) => {
  const el = document.createElement('div');
  el.innerHTML = getLocationIcon(location.color || 'blue');
  el.style.cursor = 'pointer';
  el.style.width = '44px';
  el.style.height = '44px';
  el.style.userSelect = 'none';

  el.addEventListener('click', () => onClick(location));

  return el;
};

export default function MapboxGLComponent({
  locations = [],
  selectedLocation,
  onSelectLocation,
  onLocationUpdate,
  onClickToAdd,
  isDraggable = true,
  onMapLoad,
}) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markers = useRef({});
  const clusters = useRef({});
  const supercluster = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapStyle, setMapStyle] = useState('mapbox://styles/mapbox/streets-v12');
  const [creatingLocation, setCreatingLocation] = useState(null);

  // Inicializar Mapbox
  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: [-58.3816, -34.6037],
      zoom: 12,
      pitch: 45,
      bearing: 0,
    });

    map.current.on('load', () => {
      setMapReady(true);
      onMapLoad?.();
    });

    // Click derecho para agregar ubicación
    map.current.on('contextmenu', (e) => {
      e.preventDefault();
      setCreatingLocation({
        latitude: e.lngLat.lat,
        longitude: e.lngLat.lng,
      });
      onClickToAdd?.({ latitude: e.lngLat.lat, longitude: e.lngLat.lng });
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [mapStyle, onMapLoad, onClickToAdd]);

  // Inicializar Supercluster
  useEffect(() => {
    supercluster.current = new Supercluster({
      radius: 80,
      maxZoom: 16,
    });
  }, []);

  // Actualizar datos en Supercluster y renderizar
  useEffect(() => {
    if (!map.current || !supercluster.current) return;

    const validLocations = locations.filter(
      (l) => l.latitude && l.longitude && !isNaN(l.latitude) && !isNaN(l.longitude)
    );

    supercluster.current.load(
      validLocations.map((loc) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [loc.longitude, loc.latitude] },
        properties: { ...loc, id: loc.id },
      }))
    );

    renderMarkers(validLocations);

    if (validLocations.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      validLocations.forEach((loc) => {
        bounds.extend([loc.longitude, loc.latitude]);
      });
      map.current.fitBounds(bounds, { padding: 50, maxZoom: 15 });
    }
  }, [locations]);

  const renderMarkers = useCallback(
    (validLocations) => {
      // Limpiar marcadores anteriores
      Object.values(markers.current).forEach((marker) => marker.remove?.());
      markers.current = {};

      // Renderizar nuevos marcadores con animación
      validLocations.forEach((location) => {
        if (!location.latitude || !location.longitude) return;

        const el = createMapboxMarker(location, () => onSelectLocation?.(location));

        const marker = new mapboxgl.Marker({ element: el, draggable: isDraggable })
          .setLngLat([location.longitude, location.latitude])
          .addTo(map.current);

        if (isDraggable) {
          marker.on('dragend', () => {
            const lngLat = marker.getLngLat();
            onLocationUpdate?.(location.id, {
              latitude: lngLat.lat,
              longitude: lngLat.lng,
            });
          });
        }

        markers.current[location.id] = marker;

        // Efecto pulse en marcadores nuevos
        el.style.animation = 'pulse 2s ease-in-out';
      });

      // Agregar estilos de animación
      if (!document.getElementById('mapbox-animations')) {
        const style = document.createElement('style');
        style.id = 'mapbox-animations';
        style.innerHTML = `
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.8; transform: scale(1.1); }
          }
        `;
        document.head.appendChild(style);
      }
    },
    [onSelectLocation, onLocationUpdate, isDraggable]
  );

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full rounded-xl overflow-hidden" />

      {/* Controles de estilo */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <button
          onClick={() => setMapStyle('mapbox://styles/mapbox/streets-v12')}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            mapStyle === 'mapbox://styles/mapbox/streets-v12'
              ? 'bg-primary text-white'
              : 'bg-white text-foreground border border-border hover:bg-accent'
          }`}
        >
          Mapa
        </button>
        <button
          onClick={() => setMapStyle('mapbox://styles/mapbox/satellite-streets-v12')}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            mapStyle === 'mapbox://styles/mapbox/satellite-streets-v12'
              ? 'bg-primary text-white'
              : 'bg-white text-foreground border border-border hover:bg-accent'
          }`}
        >
          Satélite
        </button>
      </div>

      {/* Indicador de creación */}
      {creatingLocation && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white rounded-lg shadow-lg px-4 py-3 flex items-center gap-2 text-sm z-10">
          <Plus className="h-4 w-4 text-primary" />
          <span>Clic derecho para crear ubicación</span>
          <button
            onClick={() => setCreatingLocation(null)}
            className="ml-2 p-1 hover:bg-accent rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Loading */}
      {!mapReady && (
        <div className="absolute inset-0 bg-black/10 backdrop-blur-sm flex items-center justify-center rounded-xl">
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        </div>
      )}
    </div>
  );
}