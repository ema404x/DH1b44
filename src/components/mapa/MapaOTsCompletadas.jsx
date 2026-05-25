import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import { CheckCircle2, MapPin, Filter, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const PRIORITY_COLORS = {
  urgente: '#ef4444',
  alta:    '#f97316',
  media:   '#3b82f6',
  baja:    '#22c55e',
};

const PRIORITY_LABELS = {
  urgente: 'Urgente',
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
};

export default function MapaOTsCompletadas() {
  const [filterPriority, setFilterPriority] = useState('todas');
  const [filterAssigned, setFilterAssigned] = useState('todos');

  const { data: workOrders = [], isLoading } = useQuery({
    queryKey: ['workOrders-completadas-mapa'],
    queryFn: () => base44.entities.WorkOrder.filter({ status: 'completada' }, '-completed_date', 500),
    staleTime: 60000,
  });

  // Solo OTs con GPS capturado
  const otsConGPS = useMemo(() =>
    workOrders.filter(wo => wo.gps_status === 'capturado' && wo.gps_latitude && wo.gps_longitude),
    [workOrders]
  );

  const otsConGPSTotal = otsConGPS.length;
  const otsSinGPS = workOrders.length - otsConGPSTotal;

  // Filtrado
  const otsFiltradas = useMemo(() => {
    let result = otsConGPS;
    if (filterPriority !== 'todas') result = result.filter(wo => wo.priority === filterPriority);
    if (filterAssigned !== 'todos') result = result.filter(wo => wo.assigned_name === filterAssigned);
    return result;
  }, [otsConGPS, filterPriority, filterAssigned]);

  // Lista de asignados únicos
  const asignados = useMemo(() => {
    const names = [...new Set(otsConGPS.map(wo => wo.assigned_name).filter(Boolean))];
    return names.sort();
  }, [otsConGPS]);

  // Centro del mapa: promedio de coords o Buenos Aires por defecto
  const center = useMemo(() => {
    if (otsFiltradas.length === 0) return [-34.6037, -58.3816];
    const avgLat = otsFiltradas.reduce((s, wo) => s + wo.gps_latitude, 0) / otsFiltradas.length;
    const avgLng = otsFiltradas.reduce((s, wo) => s + wo.gps_longitude, 0) / otsFiltradas.length;
    return [avgLat, avgLng];
  }, [otsFiltradas]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="w-6 h-6 border-2 border-border border-t-primary rounded-full animate-spin mr-3" />
        Cargando órdenes...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <span className="text-sm font-semibold text-emerald-400">{otsConGPSTotal} OTs con GPS</span>
        </div>
        {otsSinGPS > 0 && (
          <div className="flex items-center gap-2 bg-slate-500/10 border border-slate-500/20 rounded-lg px-3 py-2">
            <AlertCircle className="h-4 w-4 text-slate-400" />
            <span className="text-sm text-slate-400">{otsSinGPS} sin ubicación</span>
          </div>
        )}
        {otsFiltradas.length !== otsConGPSTotal && (
          <Badge variant="outline" className="text-xs">
            Mostrando {otsFiltradas.length} de {otsConGPSTotal}
          </Badge>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filtrar por:</span>
        </div>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue placeholder="Prioridad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las prioridades</SelectItem>
            <SelectItem value="urgente">Urgente</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="media">Media</SelectItem>
            <SelectItem value="baja">Baja</SelectItem>
          </SelectContent>
        </Select>
        {asignados.length > 0 && (
          <Select value={filterAssigned} onValueChange={setFilterAssigned}>
            <SelectTrigger className="w-44 h-8 text-xs">
              <SelectValue placeholder="Operario" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los operarios</SelectItem>
              {asignados.map(name => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: PRIORITY_COLORS[key] }} />
            {label}
          </div>
        ))}
      </div>

      {/* Mapa */}
      {otsFiltradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3 border border-dashed border-border rounded-xl">
          <MapPin className="h-10 w-10 opacity-30" />
          <p className="text-sm">No hay OTs completadas con ubicación GPS para los filtros seleccionados.</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden border border-border" style={{ height: 500 }}>
          <MapContainer
            key={center.join(',')}
            center={center}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap contributors'
            />
            {otsFiltradas.map(wo => (
              <CircleMarker
                key={wo.id}
                center={[wo.gps_latitude, wo.gps_longitude]}
                radius={10}
                pathOptions={{
                  color: PRIORITY_COLORS[wo.priority] || '#3b82f6',
                  fillColor: PRIORITY_COLORS[wo.priority] || '#3b82f6',
                  fillOpacity: 0.85,
                  weight: 2,
                }}
              >
                <Popup>
                  <div className="min-w-[200px] text-sm space-y-1">
                    <p className="font-bold text-slate-800">{wo.title}</p>
                    {wo.code && <p className="text-slate-500 text-xs">#{wo.code}</p>}
                    {wo.assigned_name && (
                      <p className="text-slate-600">👷 {wo.assigned_name}</p>
                    )}
                    {wo.location && (
                      <p className="text-slate-600">📍 {wo.location}</p>
                    )}
                    {wo.completed_date && (
                      <p className="text-slate-500 text-xs">
                        ✅ Completada: {new Date(wo.completed_date).toLocaleDateString('es-AR')}
                      </p>
                    )}
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-white text-xs font-semibold"
                      style={{ background: PRIORITY_COLORS[wo.priority] || '#3b82f6' }}
                    >
                      {PRIORITY_LABELS[wo.priority] || wo.priority}
                    </span>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      )}
    </div>
  );
}