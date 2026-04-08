import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Clock, LogIn, LogOut, Activity, AlertCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Custom marker icons
const createMarkerIcon = (color = 'blue') => {
  const colorMap = {
    blue: '#3b82f6',
    green: '#10b981',
    purple: '#a855f7',
    orange: '#f97316',
    red: '#ef4444',
  };
  return L.divIcon({
    html: `<div style="background-color: ${colorMap[color]}; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">📍</div>`,
    iconSize: [40, 40],
    className: 'custom-marker',
  });
};

export default function Mapa() {
  const [selectedLocation, setSelectedLocation] = useState(null);

  // Fetch locations
  const { data: locations = [], isLoading: locLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: () => base44.entities.LocationQR.list(),
  });

  // Fetch attendance logs
  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['attendanceLogs'],
    queryFn: async () => {
      const allLogs = await base44.entities.AttendanceLog.list('-timestamp', 500);
      return allLogs;
    },
  });

  const recentLogs = logs.slice(0, 20);
  const activeLocations = locations.filter(l => l.is_active);

  // Default map center (Buenos Aires)
  const defaultCenter = [-34.6037, -58.3816];

  if (locLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground">Cargando mapa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col lg:flex-row gap-4 p-4 bg-background overflow-hidden">
      {/* Mapa */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="mb-3">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" /> Mapa de Ubicaciones
          </h1>
          <p className="text-sm text-muted-foreground">{activeLocations.length} puntos de fichaje activos</p>
        </div>
        <div className="flex-1 rounded-xl overflow-hidden border border-border shadow-md bg-white">
          {activeLocations.length > 0 ? (
            <MapContainer
              center={activeLocations[0]?.latitude && activeLocations[0]?.longitude 
                ? [activeLocations[0].latitude, activeLocations[0].longitude] 
                : defaultCenter}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
              className="z-0"
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
              />
              {activeLocations.map(loc => (
                <div key={loc.id}>
                  {loc.latitude && loc.longitude && (
                    <>
                      <Marker
                        position={[loc.latitude, loc.longitude]}
                        icon={createMarkerIcon(loc.color || 'blue')}
                        eventHandlers={{
                          click: () => setSelectedLocation(loc),
                        }}
                      >
                        <Popup>
                          <div className="text-sm font-semibold">{loc.name}</div>
                          <div className="text-xs text-muted-foreground">{loc.address}</div>
                          <div className="text-xs mt-1">
                            <Badge variant="outline" className="text-xs">
                              {loc.total_scans || 0} escaneos
                            </Badge>
                          </div>
                        </Popup>
                      </Marker>
                      <Circle
                        center={[loc.latitude, loc.longitude]}
                        radius={500}
                        pathOptions={{
                          color: 'rgba(59, 130, 246, 0.2)',
                          weight: 1,
                          fillOpacity: 0.1,
                        }}
                      />
                    </>
                  )}
                </div>
              ))}
            </MapContainer>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-50">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-muted-foreground">No hay ubicaciones activas</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Panel lateral - Historial y detalles */}
      <div className="w-full lg:w-96 flex flex-col gap-4 min-h-0">
        {/* Detalles de ubicación seleccionada */}
        {selectedLocation && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                {selectedLocation.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {selectedLocation.address && (
                <div className="text-muted-foreground">{selectedLocation.address}</div>
              )}
              {selectedLocation.description && (
                <div className="text-muted-foreground italic">{selectedLocation.description}</div>
              )}
              <div className="flex items-center gap-4 pt-2 border-t border-border">
                <div>
                  <p className="text-xs text-muted-foreground">Total de escaneos</p>
                  <p className="text-lg font-bold text-primary">{selectedLocation.total_scans || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tipo de evento</p>
                  <Badge variant="outline" className="capitalize">
                    {selectedLocation.event_type === 'ambos' ? 'Entrada/Salida' : selectedLocation.event_type}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Historial de fichajes */}
        <Card className="flex-1 flex flex-col min-h-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" /> Últimos Fichajes
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto space-y-2">
            {logsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : recentLogs.length > 0 ? (
              recentLogs.map(log => {
                const isEntry = log.type === 'entrada';
                const locInfo = locations.find(l => l.id === log.location_qr_id);
                return (
                  <div
                    key={log.id}
                    className="p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => {
                      if (locInfo) setSelectedLocation(locInfo);
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${isEntry ? 'bg-emerald-100' : 'bg-blue-100'}`}>
                        {isEntry ? (
                          <LogIn className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <LogOut className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{log.employee_name}</p>
                        <p className="text-xs text-muted-foreground">{log.location_name || 'Sin ubicación'}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(log.timestamp), "HH:mm · d MMM", { locale: es })}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-xs capitalize flex-shrink-0 ${
                          isEntry
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}
                      >
                        {isEntry ? 'Entrada' : 'Salida'}
                      </Badge>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Clock className="h-4 w-4 mr-2" />
                <span className="text-sm">Sin registros aún</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}