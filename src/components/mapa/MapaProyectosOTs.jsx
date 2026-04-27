import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, MapPin, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const statusColors = {
  completada: { bg: 'bg-emerald-500', text: 'text-emerald-700', label: '✓' },
  en_progreso: { bg: 'bg-blue-500', text: 'text-blue-700', label: '→' },
  pendiente: { bg: 'bg-amber-500', text: 'text-amber-700', label: '•' },
  asignada: { bg: 'bg-purple-500', text: 'text-purple-700', label: '→' },
};

const createOrderIcon = (status) => {
  const config = statusColors[status] || statusColors.pendiente;
  const html = `<div class="${config.bg} w-8 h-8 rounded-full flex items-center justify-center border-2 border-white shadow-lg text-white text-xs font-bold">${config.label}</div>`;
  return L.divIcon({ html, className: '', iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -16] });
};

export default function MapaProyectosOTs() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['workorders'],
    queryFn: () => base44.entities.WorkOrder.list('-created_date', 500),
  });

  // Solo OTs con GPS válido
  const ordersWithGPS = useMemo(() => {
    return orders.filter(o => o.gps_latitude && o.gps_longitude && o.gps_latitude !== 0 && o.gps_longitude !== 0);
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return ordersWithGPS.filter(o => {
      const matchSearch = !search || o.title?.toLowerCase().includes(search.toLowerCase()) || o.location?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || o.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [ordersWithGPS, search, statusFilter]);

  const stats = {
    total: ordersWithGPS.length,
    completadas: ordersWithGPS.filter(o => o.status === 'completada').length,
    progreso: ordersWithGPS.filter(o => o.status === 'en_progreso').length,
    urgentes: ordersWithGPS.filter(o => o.priority === 'urgente').length,
  };

  const center = filteredOrders.length > 0 
    ? [filteredOrders[0].gps_latitude, filteredOrders[0].gps_longitude]
    : [-34.6037, -58.3816];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <MapPin className="h-6 w-6 text-primary" />
              Órdenes en Mapa
            </h2>
            <p className="text-sm text-muted-foreground mt-1">{ordersWithGPS.length} órdenes con ubicación GPS</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: stats.total, icon: MapPin, color: 'bg-blue-50 text-blue-700' },
            { label: 'En Progreso', value: stats.progreso, icon: Clock, color: 'bg-blue-50 text-blue-700' },
            { label: 'Urgentes', value: stats.urgentes, icon: AlertCircle, color: 'bg-red-50 text-red-700' },
            { label: 'Completadas', value: stats.completadas, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-700' },
          ].map((stat, i) => (
            <Card key={i} className="shadow-sm">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${stat.color}`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>

      {/* Filtros */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o ubicación..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="asignada">Asignada</SelectItem>
            <SelectItem value="en_progreso">En Progreso</SelectItem>
            <SelectItem value="completada">Completada</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Mapa + Detalle */}
      {ordersWithGPS.length > 0 ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[500px]">
          {/* Mapa */}
          <div className="lg:col-span-2 rounded-lg overflow-hidden shadow-lg border border-slate-200">
            <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; OpenStreetMap contributors, &copy; CARTO'
              />
              {filteredOrders.map(order => (
                <Marker
                  key={order.id}
                  position={[order.gps_latitude, order.gps_longitude]}
                  icon={createOrderIcon(order.status)}
                  eventHandlers={{ click: () => setSelectedOrder(order) }}
                >
                  <Popup>
                    <div className="p-2">
                      <p className="font-bold text-sm">{order.title}</p>
                      <p className="text-xs text-slate-600">{order.location}</p>
                      <div className="mt-2 space-y-1">
                        <Badge className="text-xs mr-1">{order.status}</Badge>
                        <Badge className="text-xs" variant="outline">{order.priority}</Badge>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          {/* Panel Detalle */}
          <Card className="shadow-lg overflow-hidden flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Detalle
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-3">
              {selectedOrder ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Título</p>
                    <p className="font-bold text-slate-900 mt-1">{selectedOrder.title}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Ubicación</p>
                    <p className="text-sm text-slate-700 mt-1">{selectedOrder.location || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Asignado a</p>
                    <p className="text-sm text-slate-700 mt-1">{selectedOrder.assigned_name || 'Sin asignar'}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={selectedOrder.status === 'completada' ? 'default' : 'secondary'} className="text-xs">
                      {selectedOrder.status}
                    </Badge>
                    <Badge variant="outline" className="text-xs">{selectedOrder.priority}</Badge>
                  </div>
                  {selectedOrder.gps_accuracy && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground uppercase">Precisión GPS</p>
                      <p className="text-sm text-slate-700 mt-1">±{Math.round(selectedOrder.gps_accuracy)}m</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <MapPin className="h-12 w-12 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">Haz clic en un marcador</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <Card className="text-center py-12">
          <AlertCircle className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-muted-foreground">No hay órdenes con ubicación GPS registrada</p>
        </Card>
      )}

      {/* Lista de órdenes */}
      {filteredOrders.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Órdenes en Mapa ({filteredOrders.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {filteredOrders.map(o => (
                <button
                  key={o.id}
                  onClick={() => setSelectedOrder(o)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                    selectedOrder?.id === o.id
                      ? 'border-primary bg-primary/5'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <p className="font-semibold text-sm">{o.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{o.location}</p>
                  <div className="flex gap-1 mt-2">
                    <Badge className="text-xs" variant="outline">{o.status}</Badge>
                    <Badge className="text-xs" variant="outline">{o.assigned_name || 'Sin asignar'}</Badge>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}