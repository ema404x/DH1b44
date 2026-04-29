import React, { useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogIn, LogOut, MapPin, Users, Activity, Calendar, Loader2, QrCode } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import QRCodeModal from '@/components/shared/QRCodeModal';

const COLOR_MAP = {
  blue: '#3b82f6', green: '#10b981', purple: '#a855f7',
  orange: '#f97316', red: '#ef4444', yellow: '#eab308', pink: '#ec4899',
};

const createLocationIcon = (color) => {
  const c = COLOR_MAP[color] || COLOR_MAP.blue;
  return L.divIcon({
    html: `<div style="background:${c};width:36px;height:36px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:16px;">📍</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
    className: '',
  });
};

const createFichajeIcon = (type) => {
  const color = type === 'entrada' ? '#10b981' : '#3b82f6';
  const emoji = type === 'entrada' ? '➡️' : '⬅️';
  return L.divIcon({
    html: `<div style="background:${color};width:26px;height:26px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:11px;">${emoji}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -13],
    className: '',
  });
};

const DAYS_OPTIONS = [
  { label: 'Hoy', value: 1 },
  { label: '3 días', value: 3 },
  { label: '7 días', value: 7 },
  { label: '30 días', value: 30 },
];

export default function MapaFichajes({ locations, logs, logsLoading, onLocationUpdate, onClickToAdd, onEditLocation, onGotoGestion }) {
  const mapRef = useRef(null);
  const [daysFilter, setDaysFilter] = useState(7);
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [qrLoc, setQrLoc] = useState(null);

  const getQROTUrl = (loc) => `${window.location.origin}/ejecutar-ot?loc=${loc.id}`;

  const validLocations = locations.filter(l =>
    l.latitude && l.longitude && !isNaN(l.latitude) && !isNaN(l.longitude)
  );

  // Filter logs with GPS coords
  const gpsLogs = useMemo(() => {
    const cutoff = subDays(new Date(), daysFilter);
    return logs.filter(l =>
      l.latitude && l.longitude &&
      !isNaN(l.latitude) && !isNaN(l.longitude) &&
      new Date(l.timestamp) >= cutoff &&
      (typeFilter === 'all' || l.type === typeFilter) &&
      (selectedEmployee === 'all' || l.employee_name === selectedEmployee)
    );
  }, [logs, daysFilter, typeFilter, selectedEmployee]);

  const employees = useMemo(() => [...new Set(logs.map(l => l.employee_name).filter(Boolean))].sort(), [logs]);

  const stats = useMemo(() => {
    const cutoff = subDays(new Date(), 1);
    const todayLogs = logs.filter(l => new Date(l.timestamp) >= cutoff);
    return {
      today: todayLogs.length,
      total: logs.length,
      uniqueEmps: new Set(gpsLogs.map(l => l.employee_name)).size,
      withGps: gpsLogs.length,
    };
  }, [logs, gpsLogs]);

  const mapCenter = useMemo(() => {
    if (validLocations.length > 0) {
      const avgLat = validLocations.reduce((s, l) => s + l.latitude, 0) / validLocations.length;
      const avgLng = validLocations.reduce((s, l) => s + l.longitude, 0) / validLocations.length;
      return [avgLat, avgLng];
    }
    if (gpsLogs.length > 0) {
      return [gpsLogs[0].latitude, gpsLogs[0].longitude];
    }
    return [-34.6037, -58.3816];
  }, [validLocations, gpsLogs]);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Fichajes hoy', value: stats.today, icon: Calendar, color: 'text-primary' },
          { label: 'Total registros', value: stats.total, icon: Activity, color: 'text-emerald-600' },
          { label: 'Empleados (filtro)', value: stats.uniqueEmps, icon: Users, color: 'text-indigo-600' },
          { label: 'Con GPS', value: stats.withGps, icon: MapPin, color: 'text-orange-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-border/60">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`h-4 w-4 ${color}`} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <p className="text-2xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex border rounded-lg overflow-hidden">
          {DAYS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setDaysFilter(opt.value)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium transition-colors',
                daysFilter === opt.value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex border rounded-lg overflow-hidden">
          {[['all', 'Todos'], ['entrada', 'Entrada'], ['salida', 'Salida']].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setTypeFilter(v)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium transition-colors',
                typeFilter === v ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
              )}
            >
              {l}
            </button>
          ))}
        </div>

        <select
          value={selectedEmployee}
          onChange={e => setSelectedEmployee(e.target.value)}
          className="px-3 py-1.5 text-xs border rounded-lg bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">Todos los empleados</option>
          {employees.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      {/* Map */}
      <div className="rounded-xl overflow-hidden border border-border shadow-lg bg-white" style={{ height: '520px' }}>
        {logsLoading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <MapContainer
            ref={mapRef}
            center={mapCenter}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; OpenStreetMap contributors, &copy; CARTO'
              maxZoom={19}
            />

            {/* Location markers */}
            {validLocations.map(loc => (
              <Marker
                key={loc.id}
                position={[loc.latitude, loc.longitude]}
                icon={createLocationIcon(loc.color || 'blue')}
                draggable
                eventHandlers={{
                  dragend: (e) => onLocationUpdate(loc.id, {
                    latitude: e.target.getLatLng().lat,
                    longitude: e.target.getLatLng().lng,
                  }),
                }}
              >
                <Popup minWidth={220}>
                  <div style={{ minWidth: 220 }}>
                    <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{loc.name}</p>
                    {loc.project_name && <p style={{ fontSize: 11, color: '#6366f1', marginBottom: 2 }}>📁 {loc.project_name}</p>}
                    {loc.address && <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>📍 {loc.address}</p>}
                    <div style={{ display: 'flex', gap: 12, fontSize: 12, marginBottom: 8 }}>
                      <span><strong>{loc.total_scans || 0}</strong> escaneos</span>
                      <span style={{ color: loc.is_active ? '#10b981' : '#9ca3af' }}>
                        {loc.is_active ? '✓ Activo' : '✗ Inactivo'}
                      </span>
                    </div>
                    {loc.assigned_employees?.length > 0 && (
                      <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>
                        👷 {loc.assigned_employees.slice(0, 3).join(', ')}{loc.assigned_employees.length > 3 ? ` +${loc.assigned_employees.length - 3}` : ''}
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid #e5e7eb' }}>
                       <button
                         onClick={() => setQrLoc(loc)}
                         style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: 11, borderRadius: 6, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', cursor: 'pointer' }}
                       >
                         🔲 Ver QR
                       </button>
                       {onGotoGestion && (
                         <button
                           onClick={() => onGotoGestion(loc)}
                           style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: 11, borderRadius: 6, background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', cursor: 'pointer' }}
                         >
                           ✏️ Gestionar
                         </button>
                       )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Fichaje GPS markers */}
            {gpsLogs.map((log) => (
              <Marker
                key={log.id}
                position={[log.latitude, log.longitude]}
                icon={createFichajeIcon(log.type)}
              >
                <Popup>
                  <div className="min-w-44">
                    <div className="flex items-center gap-1.5 mb-1">
                      {log.type === 'entrada'
                        ? <LogIn className="h-3.5 w-3.5 text-emerald-600" />
                        : <LogOut className="h-3.5 w-3.5 text-blue-600" />}
                      <span className="font-semibold text-sm capitalize">{log.type}</span>
                    </div>
                    <p className="text-xs font-medium">{log.employee_name}</p>
                    {log.location_name && <p className="text-xs text-gray-500">{log.location_name}</p>}
                    <p className="text-xs text-gray-400 mt-1">
                      {format(new Date(log.timestamp), 'dd MMM HH:mm', { locale: es })}
                    </p>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                      {log.latitude.toFixed(5)}, {log.longitude.toFixed(5)}
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded-full bg-blue-500 border-2 border-white shadow" />Ubicación QR</div>
        <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded-full bg-emerald-500 border-2 border-white shadow" />Fichaje entrada</div>
        <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded-full bg-blue-400 border-2 border-white shadow" />Fichaje salida</div>
        <span className="text-muted-foreground/60">· Clic en marcador para ver acciones · Arrastrá para mover</span>
      </div>

      {/* QR Modal */}
      <QRCodeModal
        open={!!qrLoc}
        onClose={() => setQrLoc(null)}
        title={qrLoc?.name || ''}
        subtitle={qrLoc?.address || qrLoc?.project_name || 'Escanear para ver y completar la OT'}
        value={qrLoc ? getQROTUrl(qrLoc) : ''}
      />
    </div>
  );
}