import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MapPin, LogIn, LogOut, Activity, AlertCircle, Loader2, Plus,
  Eye, ChevronDown, ChevronUp, Calendar, MoreVertical
} from 'lucide-react';
import { format, startOfDay, isToday, isYesterday } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import MapaInteractivo, { MapControls } from '@/components/mapa/MapaInteractivo';
import LocationDetailPanel from '@/components/mapa/LocationDetailPanel';
import MapSearchBar from '@/components/mapa/MapSearchBar';
import { toast } from 'sonner';

export default function Mapa() {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({});
  const [expandedLog, setExpandedLog] = useState(null);
  const [tracking, setTracking] = useState(true);
  const queryClient = useQueryClient();

  // Fetch locations
  const { data: locations = [], isLoading: locLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: () => base44.entities.LocationQR.list(),
    staleTime: 30000,
  });

  // Fetch attendance logs
  const { data: logs = [], isLoading: logsLoading, refetch } = useQuery({
    queryKey: ['attendanceLogs'],
    queryFn: async () => {
      const allLogs = await base44.entities.AttendanceLog.list('-timestamp', 300);
      return allLogs;
    },
    staleTime: 15000,
    refetchInterval: 15000,
  });

  // Update location mutation
  const updateLocationMutation = useMutation({
    mutationFn: (payload) =>
      base44.entities.LocationQR.update(payload.id, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      toast.success('Ubicación actualizada');
    },
    onError: () => {
      toast.error('Error al actualizar ubicación');
    },
  });

  // Delete location mutation
  const deleteLocationMutation = useMutation({
    mutationFn: (id) => base44.entities.LocationQR.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      setSelectedLocation(null);
      toast.success('Ubicación eliminada');
    },
    onError: () => {
      toast.error('Error al eliminar ubicación');
    },
  });

  const availableFilters = [
    {
      key: 'is_active',
      label: 'Estado',
      type: 'checkbox',
    },
    {
      key: 'event_type',
      label: 'Tipo de Evento',
      type: 'select',
      options: [
        { value: 'entrada', label: 'Entrada' },
        { value: 'salida', label: 'Salida' },
        { value: 'ambos', label: 'Ambos' },
      ],
    },
  ];

  const filteredLocations = useMemo(() => {
    let result = locations;

    if (searchTerm) {
      result = result.filter(loc =>
        loc.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        loc.address?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filters.is_active !== undefined && filters.is_active !== null) {
      result = result.filter(loc => loc.is_active === true);
    }

    if (filters.event_type) {
      result = result.filter(loc => loc.event_type === filters.event_type);
    }

    return result;
  }, [locations, searchTerm, filters]);

  const logsByDay = useMemo(() => {
    const grouped = {};
    logs.forEach(log => {
      const date = new Date(log.timestamp);
      const key = startOfDay(date).toISOString();
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(log);
    });

    return Object.entries(grouped)
      .sort(([a], [b]) => new Date(b) - new Date(a))
      .map(([date, items]) => ({ date: new Date(date), logs: items }));
  }, [logs]);

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
      totalLocations: locations.filter(l => l.is_active).length,
      entrances: logs.filter(l => l.type === 'entrada').length,
      exits: logs.filter(l => l.type === 'salida').length,
    };
  }, [logs, locations]);

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
                <MapPin className="h-6 w-6 text-primary" /> Mapa Interactivo
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Gestión visual de ubicaciones con edición drag & drop
              </p>
            </div>
            <Button
              variant="default"
              size="sm"
              className="gap-1.5"
              onClick={() => refetch()}
            >
              <Activity className="h-4 w-4" /> Actualizar
            </Button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[
              { label: 'Hoy', value: stats.todayScans, icon: '📍' },
              { label: 'Total', value: stats.totalScans, icon: '📊' },
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
          <MapSearchBar
            locations={locations}
            onSearch={setSearchTerm}
            onLocationSelect={setSelectedLocation}
            filters={filters}
            onFiltersChange={setFilters}
            availableFilters={availableFilters}
          />

          <div className="rounded-xl overflow-hidden border border-border shadow-lg bg-white flex-1 relative">
            {filteredLocations.length > 0 ? (
              <>
                <MapaInteractivo
                  locations={filteredLocations}
                  selectedLocation={selectedLocation}
                  onSelectLocation={setSelectedLocation}
                  onLocationUpdate={(id, data) => updateLocationMutation.mutate({ id, data })}
                  isDraggable={true}
                />
                <MapControls onToggleTracking={() => setTracking(!tracking)} tracking={tracking} />
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-50">
                <div className="text-center">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-2 opacity-50" />
                  <p className="text-muted-foreground">No hay ubicaciones que coincidan con los filtros</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Panel Lateral */}
        <div className="w-full lg:w-[420px] flex flex-col gap-4 min-h-0">
          {/* Detalles de ubicación */}
          {selectedLocation && (
            <Card className="border-primary/40 bg-gradient-to-br from-primary/5 to-primary/10 shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  Ubicación Seleccionada
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <p className="font-semibold mb-2">{selectedLocation.name}</p>
                {selectedLocation.address && (
                  <p className="text-muted-foreground text-xs mb-3">{selectedLocation.address}</p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white rounded-lg p-2">
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Escaneos</p>
                    <p className="text-lg font-bold text-primary">{selectedLocation.total_scans || 0}</p>
                  </div>
                  <div className="bg-white rounded-lg p-2">
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Estado</p>
                    <Badge className={selectedLocation.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}>
                      {selectedLocation.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Historial por Días */}
          <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <CardHeader className="pb-3 sticky top-0 bg-card/50 backdrop-blur-sm z-10">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" /> Últimos Fichajes
              </CardTitle>
            </CardHeader>
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
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>

                      {isExpanded && (
                        <div className="p-2 space-y-1.5 bg-background border-t border-border max-h-60 overflow-y-auto">
                          {dayLogs.map(log => {
                            const isEntry = log.type === 'entrada';
                            return (
                              <div
                                key={log.id}
                                className="p-2.5 rounded-lg bg-card border border-border/50 hover:border-primary/30 hover:shadow-sm transition-all"
                              >
                                <div className="flex items-start gap-2.5">
                                  <div className={cn(
                                    'h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0',
                                    isEntry ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
                                  )}>
                                    {isEntry ? <LogIn className="h-3.5 w-3.5" /> : <LogOut className="h-3.5 w-3.5" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-xs text-foreground">{log.employee_name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{log.location_name || 'Sin ubicación'}</p>
                                  </div>
                                  <p className="font-semibold text-xs text-foreground flex-shrink-0">{format(new Date(log.timestamp), 'HH:mm')}</p>
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

      {/* Location Detail Panel */}
      {selectedLocation && (
        <LocationDetailPanel
          location={selectedLocation}
          onClose={() => setSelectedLocation(null)}
          onUpdate={(id, data) => updateLocationMutation.mutateAsync({ id, data })}
          onDelete={(id) => deleteLocationMutation.mutateAsync(id)}
          isLoading={updateLocationMutation.isPending || deleteLocationMutation.isPending}
        />
      )}
    </div>
  );
}