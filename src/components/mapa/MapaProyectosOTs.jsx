import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, MapPin, Zap, AlertTriangle, CheckCircle2, Clock, Building2, Eye, Globe } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Fixes para iconos de Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom icons por tipo
const createCustomIcon = (type, status) => {
  const bgColor = type === 'proyecto' ? 'bg-blue-500' : status === 'completada' ? 'bg-emerald-500' : status === 'en_progreso' ? 'bg-purple-500' : 'bg-amber-500';
  const iconHtml = `
    <div class="${bgColor} rounded-full w-8 h-8 flex items-center justify-center border-2 border-white shadow-lg">
      <span class="text-white text-xs font-bold">${type === 'proyecto' ? 'P' : 'O'}</span>
    </div>
  `;
  
  return L.divIcon({
    html: iconHtml,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
};

function MapContent({ projects, orders, selectedItem, onSelectItem }) {
  const map = useMap();

  useEffect(() => {
    if (selectedItem && selectedItem.latitude && selectedItem.longitude) {
      map.flyTo([selectedItem.latitude, selectedItem.longitude], 15);
    }
  }, [selectedItem, map]);

  return (
    <>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
      />

      {projects.map(project => (
        project.start_date && (
          <Marker
            key={`proj-${project.id}`}
            position={[Math.random() * 0.1 - 34.6, Math.random() * 0.1 - 58.4]}
            icon={createCustomIcon('proyecto', 'proyecto')}
            eventHandlers={{
              click: () => onSelectItem({ ...project, type: 'proyecto' })
            }}
          >
            <Popup className="custom-popup">
              <div className="p-2 min-w-[220px]">
                <p className="font-bold text-sm text-slate-900">{project.name}</p>
                <p className="text-xs text-slate-600 mt-1">Código: {project.code}</p>
                <p className="text-xs text-slate-600">Cliente: {project.client_name}</p>
                <Badge className="mt-2 text-xs bg-blue-100 text-blue-700">{project.status}</Badge>
                <div className="mt-3 w-full bg-slate-200 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${project.progress || 0}%` }} />
                </div>
                <p className="text-xs text-slate-600 mt-1">{project.progress || 0}% completado</p>
              </div>
            </Popup>
          </Marker>
        )
      ))}

      {orders.map(order => (
        order.gps_latitude && order.gps_longitude && (
          <Marker
            key={`ot-${order.id}`}
            position={[order.gps_latitude, order.gps_longitude]}
            icon={createCustomIcon('ot', order.status)}
            eventHandlers={{
              click: () => onSelectItem({ ...order, type: 'ot' })
            }}
          >
            <Popup className="custom-popup">
              <div className="p-2 min-w-[240px]">
                <p className="font-bold text-sm text-slate-900">{order.title}</p>
                <p className="text-xs text-slate-600 mt-1">Código: {order.code || 'S/C'}</p>
                <p className="text-xs text-slate-600">Asignado: {order.assigned_name || 'Sin asignar'}</p>
                <div className="mt-2 flex items-center gap-1">
                  <Badge className="text-xs" variant={order.status === 'completada' ? 'default' : 'secondary'}>
                    {order.status}
                  </Badge>
                  <Badge className="text-xs" variant="outline">{order.priority}</Badge>
                </div>
                <p className="text-xs text-slate-600 mt-2">Precisión GPS: ±{Math.round(order.gps_accuracy || 0)}m</p>
              </div>
            </Popup>
          </Marker>
        )
      ))}
    </>
  );
}

export default function MapaProyectosOTs() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedItem, setSelectedItem] = useState(null);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list()
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['workorders'],
    queryFn: () => base44.entities.WorkOrder.list()
  });

  // Filter activos
  const activeProjects = useMemo(() => {
    return projects.filter(p => {
      const matchSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === 'all' || typeFilter === 'proyecto';
      const matchStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchSearch && matchType && matchStatus && p.status === 'en_progreso';
    });
  }, [projects, search, typeFilter, statusFilter]);

  const activeOrders = useMemo(() => {
    return orders.filter(o => {
      const matchSearch = !search || o.title?.toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === 'all' || typeFilter === 'ot';
      const matchStatus = statusFilter === 'all' || o.status === statusFilter;
      return matchSearch && matchType && matchStatus && ['pendiente', 'asignada', 'en_progreso'].includes(o.status);
    });
  }, [orders, search, typeFilter, statusFilter]);

  const stats = {
    proyectos: activeProjects.length,
    ots: activeOrders.length,
    completadas: activeOrders.filter(o => o.status === 'completada').length,
    urgentes: activeOrders.filter(o => o.priority === 'urgente').length,
  };

  return (
    <div className="space-y-4">
      {/* Header Premium */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Globe className="h-6 w-6 text-blue-600" />
              Mapa de Proyectos y Órdenes
            </h2>
            <p className="text-sm text-slate-600 mt-1">Visualiza ubicaciones activas y accede a detalles con un clic</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Proyectos', value: stats.proyectos, icon: Building2, color: 'bg-blue-50 text-blue-700' },
            { label: 'OTs Activas', value: stats.ots, icon: Zap, color: 'bg-purple-50 text-purple-700' },
            { label: 'Urgentes', value: stats.urgentes, icon: AlertTriangle, color: 'bg-red-50 text-red-700' },
          ].map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card className="shadow-sm border-0">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center justify-between">
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${stat.color}`}>
                      <stat.icon className="h-4 w-4" />
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                      <p className="text-xs text-slate-600">{stat.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Filtros */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar proyecto u orden..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="proyecto">Proyectos</SelectItem>
            <SelectItem value="ot">Órdenes de Trabajo</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="en_progreso">En Progreso</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="completada">Completada</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Mapa + Detalle */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[600px]">
        {/* Mapa */}
        <div className="lg:col-span-2 rounded-lg overflow-hidden shadow-lg border border-slate-200">
          <MapContainer center={[-34.6037, -58.3816]} zoom={12} style={{ height: '100%', width: '100%' }}>
            <MapContent
              projects={activeProjects}
              orders={activeOrders}
              selectedItem={selectedItem}
              onSelectItem={setSelectedItem}
            />
          </MapContainer>
        </div>

        {/* Detalle */}
        <Card className="shadow-lg overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Eye className="h-4 w-4 text-blue-600" />
              Detalle
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 max-h-[500px] overflow-y-auto">
            {selectedItem ? (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-slate-600 uppercase tracking-wide">Tipo</p>
                  <Badge className="mt-1 text-xs" variant={selectedItem.type === 'proyecto' ? 'default' : 'secondary'}>
                    {selectedItem.type === 'proyecto' ? 'PROYECTO' : 'ORDEN DE TRABAJO'}
                  </Badge>
                </div>

                <div>
                  <p className="text-xs text-slate-600 uppercase tracking-wide">Nombre</p>
                  <p className="font-bold text-slate-900 mt-1">{selectedItem.name || selectedItem.title}</p>
                </div>

                {selectedItem.code && (
                  <div>
                    <p className="text-xs text-slate-600 uppercase tracking-wide">Código</p>
                    <p className="font-mono text-sm text-slate-700 mt-1">{selectedItem.code}</p>
                  </div>
                )}

                {selectedItem.type === 'proyecto' ? (
                  <>
                    <div>
                      <p className="text-xs text-slate-600 uppercase tracking-wide">Cliente</p>
                      <p className="text-sm text-slate-700 mt-1">{selectedItem.client_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600 uppercase tracking-wide mb-2">Avance</p>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${selectedItem.progress || 0}%` }} />
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{selectedItem.progress || 0}%</p>
                    </div>
                    <div>
                      <Badge className="text-xs">{selectedItem.status}</Badge>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-xs text-slate-600 uppercase tracking-wide">Asignado a</p>
                      <p className="text-sm text-slate-700 mt-1">{selectedItem.assigned_name || 'Sin asignar'}</p>
                    </div>
                    <div className="flex gap-2">
                      <Badge className="text-xs" variant={selectedItem.status === 'completada' ? 'default' : 'secondary'}>
                        {selectedItem.status}
                      </Badge>
                      <Badge className="text-xs" variant="outline">{selectedItem.priority}</Badge>
                    </div>
                    {selectedItem.gps_accuracy && (
                      <div>
                        <p className="text-xs text-slate-600 uppercase tracking-wide">Precisión GPS</p>
                        <p className="text-sm text-slate-700 mt-1">±{Math.round(selectedItem.gps_accuracy)}m</p>
                      </div>
                    )}
                  </>
                )}

                <Button className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white">
                  Ver Detalle Completo
                </Button>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                <MapPin className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">Haz clic en un marcador en el mapa para ver detalles</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Lista de items */}
      {(activeProjects.length > 0 || activeOrders.length > 0) && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Items en Mapa</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                {activeProjects.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedItem({ ...p, type: 'proyecto' })}
                    className="text-left p-2 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer"
                  >
                    <p className="text-xs font-semibold text-blue-900">{p.name}</p>
                    <p className="text-xs text-blue-700 mt-0.5">{p.progress || 0}% completado</p>
                  </button>
                ))}
                {activeOrders.map(o => (
                  <button
                    key={o.id}
                    onClick={() => setSelectedItem({ ...o, type: 'ot' })}
                    className="text-left p-2 rounded-lg bg-purple-50 hover:bg-purple-100 transition-colors cursor-pointer"
                  >
                    <p className="text-xs font-semibold text-purple-900">{o.title}</p>
                    <p className="text-xs text-purple-700 mt-0.5">{o.status} • {o.assigned_name}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}