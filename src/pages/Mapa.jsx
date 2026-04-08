import React, { useState, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  MapPin, Clock, LogIn, LogOut, Activity, AlertCircle, Loader2, Search,
  TrendingUp, Users, Filter, X, Eye, ChevronDown, ChevronUp, Calendar
} from 'lucide-react';
import { format, differenceInDays, startOfDay, isToday, isYesterday } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const createMarkerIcon = (color = 'blue') => {
  const colorMap = {
    blue: '#3b82f6',
    green: '#10b981',
    purple: '#a855f7',
    orange: '#f97316',
    red: '#ef4444',
  };
  return L.divIcon({
    html: `<div style="background: linear-gradient(135deg, ${colorMap[color]} 0%, rgba(0,0,0,.1) 100%); width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.25), 0 0 0 2px ${colorMap[color]}; animation: pulse 2s infinite;">📍</div>`,
    iconSize: [44, 44],
    className: 'custom-marker',
  });
};

function MapController({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, 13, { animate: true, duration: 0.5 });
    }
  }, [center, map]);
  return null;
}

export default function Mapa() {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [mapCenter, setMapCenter] = useState(null);
  const [expandedLog, setExpandedLog] = useState(null);
  const [logPage, setLogPage] = useState(0);

  // Fetch locations
  const { data: locations = [], isLoading: locLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: () => base44.entities.LocationQR.list(),
  });

  // Fetch attendance logs
  const { data: logs = [], isLoading: logsLoading, refetch } = useQuery({
    queryKey: ['attendanceLogs'],
    queryFn: async () => {
      const allLogs = await base44.entities.AttendanceLog.list('-timestamp', 300);
      return allLogs;
    },
    staleTime: 15000,
    refetchInterval: 15000, // Actualizar cada 15 segundos
  });

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(() => refetch(), 15000);
    return () => clearInterval(interval);
  }, [refetch]);

  const activeLocations = locations.filter(l => l.is_active);
  const logsByDay = useMemo(() => {
    let result = logs;
    
    if (filterType !== 'all') {
      result = result.filter(log => log.type === filterType);
    }
    
    if (searchTerm) {
      result = result.filter(log =>
        log.employee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.location_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    const grouped = {};
    result.forEach(log => {
      const date = new Date(log.timestamp);
      const key = startOfDay(date).toISOString();
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(log);
    });

    return Object.entries(grouped)
      .sort(([a], [b]) => new Date(b) - new Date(a))
      .map(([date, items]) => ({ date: new Date(date), logs: items }));
  }, [logs, filterType, searchTerm]);

  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    const todayLogs = logs.filter(l => {
      const logDate = startOfDay(new Date(l.timestamp));
      return logDate.getTime() === today.getTime();
    });

    return {
      totalScans: logs.length,
      todayScans: todayLogs.length,
      uniqueEmployees: new Set(logs.map(l => l.employee_name)).size,
      totalLocations: activeLocations.length,
      entrances: logs.filter(l => l.type === 'entrada').length,
      exits: logs.filter(l => l.type === 'salida').length,
    };
  }, [logs, activeLocations]);

  const defaultCenter = [-34.6037, -58.3816];
  const mapCenterCoords = selectedLocation?.latitude && selectedLocation?.longitude
    ? [selectedLocation.latitude, selectedLocation.longitude]
    : activeLocations[0]?.latitude && activeLocations[0]?.longitude
      ? [activeLocations[0].latitude, activeLocations[0].longitude]
      : defaultCenter;

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
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header Stats */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm p-4">
        <div className="max-w-full">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <MapPin className="h-6 w-6 text-primary" /> Mapa en Vivo
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Sistema de seguimiento de asistencia geolocalizado
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              className="gap-1.5"
            >
              <Activity className="h-4 w-4" /> Actualizar
            </Button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[
              { label: 'Escaneos Hoy', value: stats.todayScans, icon: '📍' },
              { label: 'Escaneos Total', value: stats.totalScans, icon: '📊' },
              { label: 'Empleados', value: stats.uniqueEmployees, icon: '👥' },
              { label: 'Ubicaciones', value: stats.totalLocations, icon: '📌' },
              { label: 'Entradas', value: stats.entrances, icon: '➡️' },
              { label: 'Salidas', value: stats.exits, icon: '⬅️' },
            ].map((stat, i) => (
              <div
                key={i}
                className="bg-card border border-border rounded-lg p-3 hover:border-primary/50 transition-colors"
              >
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <span>{stat.icon}</span>
                  <span className="text-xs">{stat.label}</span>
                </div>
                <div className="text-2xl font-bold mt-1">{stat.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        {/* Mapa */}
        <div className="flex-1 flex flex-col min-h-0 gap-3">
          <div className="rounded-2xl overflow-hidden border border-border shadow-lg bg-white flex-1 relative">
            {activeLocations.length > 0 ? (
              <>
                {typeof window !== 'undefined' && (
                  <MapContainer
                    center={mapCenterCoords}
                    zoom={13}
                    style={{ height: '100%', width: '100%' }}
                    className="z-0"
                  >
                    <TileLayer
                      url="https://{s}.basemaps.cartocdn.com/positron/{z}/{x}/{y}{r}.png"
                      attribution='&copy; OpenStreetMap contributors, &copy; CartoDB'
                      maxZoom={19}
                    />
                    <MapController center={mapCenter} />
                    {activeLocations.map(loc => (
                      loc.latitude && loc.longitude && (
                        <div key={loc.id}>
                          <Marker
                            position={[loc.latitude, loc.longitude]}
                            icon={createMarkerIcon(loc.color || 'blue')}
                            eventHandlers={{
                              click: () => {
                                setSelectedLocation(loc);
                                setMapCenter([loc.latitude, loc.longitude]);
                              },
                            }}
                          >
                            <Popup className="custom-popup">
                              <div className="font-semibold text-sm mb-1">{loc.name}</div>
                              {loc.address && (
                                <div className="text-xs text-muted-foreground mb-2">{loc.address}</div>
                              )}
                              <div className="flex gap-2 items-center justify-between">
                                <Badge variant="outline" className="text-xs">
                                  {loc.total_scans || 0} escaneos
                                </Badge>
                                <Badge
                                  className={`text-xs ${loc.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}
                                >
                                  {loc.is_active ? 'Activo' : 'Inactivo'}
                                </Badge>
                              </div>
                            </Popup>
                          </Marker>
                          <Circle
                            center={[loc.latitude, loc.longitude]}
                            radius={600}
                            pathOptions={{
                              color: `rgba(59, 130, 246, 0.1)`,
                              weight: 1.5,
                              fillOpacity: 0.08,
                              dashArray: '5, 5',
                            }}
                          />
                        </div>
                      )
                    ))}
                  </MapContainer>
                )}

                {/* Location selector badge */}
                {selectedLocation && (
                  <div className="absolute top-4 left-4 z-10 bg-white border border-border rounded-xl shadow-lg p-3 max-w-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-foreground">{selectedLocation.name}</p>
                        {selectedLocation.address && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {selectedLocation.address}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setSelectedLocation(null);
                          setMapCenter(null);
                        }}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-50">
                <div className="text-center">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-2 opacity-50" />
                  <p className="text-muted-foreground">No hay ubicaciones activas para mostrar</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Panel Lateral */}
        <div className="w-full lg:w-[420px] flex flex-col gap-4 min-h-0">
          {/* Detalles */}
          {selectedLocation && (
            <Card className="border-primary/40 bg-gradient-to-br from-primary/5 to-primary/10 shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  {selectedLocation.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {selectedLocation.address && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Dirección</p>
                    <p className="text-sm mt-1">{selectedLocation.address}</p>
                  </div>
                )}
                {selectedLocation.description && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Descripción</p>
                    <p className="text-sm mt-1 italic text-foreground/80">{selectedLocation.description}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-primary/10">
                  <div className="bg-white rounded-lg p-2.5">
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Escaneos</p>
                    <p className="text-2xl font-bold text-primary mt-1">{selectedLocation.total_scans || 0}</p>
                  </div>
                  <div className="bg-white rounded-lg p-2.5">
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Estado</p>
                    <Badge
                      className={`mt-1 ${
                        selectedLocation.is_active
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {selectedLocation.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Filtros y búsqueda */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" /> Últimos Fichajes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por empleado o ubicación..."
                  className="pl-9 h-9 text-sm"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                {['all', 'entrada', 'salida'].map(type => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5',
                      filterType === type
                        ? type === 'all'
                          ? 'bg-primary text-white'
                          : type === 'entrada'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-blue-100 text-blue-700'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    )}
                  >
                    {type === 'all' && 'Todos'}
                    {type === 'entrada' && <LogIn className="h-3 w-3" />}
                    {type === 'salida' && <LogOut className="h-3 w-3" />}
                    {type === 'entrada' && 'Entradas'}
                    {type === 'salida' && 'Salidas'}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Historial por Días */}
          <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <CardContent className="flex-1 overflow-y-auto p-3 space-y-3">
              {logsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : logsByDay.length > 0 ? (
                logsByDay.map(({ date, logs: dayLogs }) => {
                  const dayKey = date.toISOString();
                  const isExpanded = expandedLog === dayKey;
                  const todayLabel = isToday(date) ? 'Hoy' : isYesterday(date) ? 'Ayer' : format(date, 'd MMM', { locale: es });

                  return (
                    <div key={dayKey} className="border border-border rounded-lg overflow-hidden">
                      <button
                        onClick={() => setExpandedLog(isExpanded ? null : dayKey)}
                        className="w-full px-3 py-2 flex items-center justify-between hover:bg-accent/50 transition-colors bg-muted/30"
                      >
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-primary" />
                          <div className="text-left">
                            <p className="text-xs font-bold text-foreground">{todayLabel}</p>
                            <p className="text-xs text-muted-foreground">{dayLogs.length} registros</p>
                          </div>
                        </div>
                        <div className="text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded-full">
                          {dayLogs.filter(l => l.type === 'entrada').length}↓ {dayLogs.filter(l => l.type === 'salida').length}↑
                        </div>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>

                      {isExpanded && (
                        <div className="p-2 space-y-1.5 bg-background border-t border-border max-h-60 overflow-y-auto">
                          {dayLogs.map(log => {
                            const isEntry = log.type === 'entrada';
                            const locInfo = locations.find(l => l.id === log.location_qr_id);

                            return (
                              <div
                                key={log.id}
                                className="p-2.5 rounded-lg bg-card border border-border/50 hover:border-primary/30 hover:shadow-sm transition-all group cursor-pointer"
                              >
                                <div className="flex items-start gap-2.5">
                                  <div
                                    className={cn(
                                      'h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs',
                                      isEntry
                                        ? 'bg-emerald-100 text-emerald-600'
                                        : 'bg-blue-100 text-blue-600'
                                    )}
                                  >
                                    {isEntry ? <LogIn className="h-3.5 w-3.5" /> : <LogOut className="h-3.5 w-3.5" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-xs text-foreground">{log.employee_name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{log.location_name || 'Sin ubicación'}</p>
                                    {log.latitude && log.longitude && (
                                      <p className="text-xs text-muted-foreground/60 mt-0.5">
                                        📍 {log.latitude.toFixed(4)}, {log.longitude.toFixed(4)}
                                      </p>
                                    )}
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <p className="font-semibold text-xs text-foreground">{format(new Date(log.timestamp), 'HH:mm:ss')}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  <span className="text-sm">Sin registros</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}