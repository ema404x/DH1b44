import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Clock, LogIn, LogOut, Download, Search, AlertTriangle, CheckCircle2, Loader2, Eye, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import AsistenciaDetailDialog from './AsistenciaDetailDialog';

const ESTADO_ADMIN = {
  pendiente: { label: 'Pendiente', class: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  revisado: { label: 'Revisado', class: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  incidencia: { label: 'Incidencia', class: 'bg-red-500/15 text-red-400 border-red-500/30' },
};

const DISTANCE_THRESHOLD_M = 150; // Umbral de alerta: fichajes a más de 150m del sitio

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000; // metros
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function calcFichajeDistance(fichaje, locCoords) {
  const loc = locCoords.get(fichaje.location_qr_id);
  if (!loc) return { status: 'no_coords', text: 'Sin coords.' };
  const lat = fichaje.entrada_latitude;
  const lng = fichaje.entrada_longitude;
  if (lat == null || lng == null) return { status: 'no_gps', text: 'Sin GPS' };
  const dist = haversine(loc.lat, loc.lng, lat, lng);
  if (dist > DISTANCE_THRESHOLD_M) return { status: 'far', text: `${dist}m`, dist };
  return { status: 'ok', text: `${dist}m`, dist };
}

function calcDuration(entrada, salida) {
  if (!entrada || !salida) return null;
  const ms = new Date(salida).getTime() - new Date(entrada).getTime();
  if (ms < 0) return null;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

function StatCard({ icon: Icon, label, value, tone }) {
  const tones = {
    blue: 'text-blue-400 bg-blue-500/10',
    emerald: 'text-emerald-400 bg-emerald-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
    red: 'text-red-400 bg-red-500/10',
    slate: 'text-slate-300 bg-slate-500/10',
  };
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/50 px-4 py-3">
      <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${tones[tone] || tones.slate}`}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-lg font-bold tabular-nums leading-tight">{value}</p>
      </div>
    </div>
  );
}

export default function AsistenciasPanel({ locations = [] }) {
  const [filters, setFilters] = useState({
    dateFrom: '', dateTo: '', locationId: 'all', estado: 'all', estadoAdmin: 'all', search: '',
  });
  const [selected, setSelected] = useState(null);

  const query = useMemo(() => {
    const q = {};
    if (filters.locationId !== 'all') q.location_qr_id = filters.locationId;
    if (filters.estado !== 'all') q.estado = filters.estado;
    if (filters.estadoAdmin !== 'all') q.estado_admin = filters.estadoAdmin;
    if (filters.dateFrom || filters.dateTo) {
      q.entrada_timestamp = {};
      if (filters.dateFrom) q.entrada_timestamp.$gte = new Date(filters.dateFrom).toISOString();
      if (filters.dateTo) q.entrada_timestamp.$lte = new Date(filters.dateTo + 'T23:59:59').toISOString();
    }
    if (filters.search.trim()) {
      q.$or = [
        { operario_nombre: { $regex: filters.search.trim(), $options: 'i' } },
        { dni: { $regex: filters.search.trim(), $options: 'i' } },
      ];
    }
    return q;
  }, [filters]);

  const { data, isLoading } = useQuery({
    queryKey: ['fichajes-ubicacion', query],
    queryFn: () => base44.entities.FichajeUbicacion.filter(query, { sort: '-entrada_timestamp', limit: 200 }),
    staleTime: 15000,
  });

  const items = data?.items || [];

  // Lookup de coordenadas de cada ubicación para cálculo de distancia
  const locCoords = useMemo(() => {
    const m = new Map();
    for (const l of locations) {
      if (l.latitude && l.longitude) m.set(l.id, { lat: l.latitude, lng: l.longitude });
    }
    return m;
  }, [locations]);

  const stats = useMemo(() => {
    const total = items.length;
    const abiertas = items.filter(i => i.estado === 'abierta').length;
    const cerradas = items.filter(i => i.estado === 'cerrada').length;
    const incidencias = items.filter(i => i.estado_admin === 'incidencia').length;
    const revisados = items.filter(i => i.estado_admin === 'revisado').length;
    let lejosSitio = 0;
    let sinGps = 0;
    for (const i of items) {
      const d = calcFichajeDistance(i, locCoords);
      if (d.status === 'far') lejosSitio++;
      if (d.status === 'no_gps' || d.status === 'no_coords') sinGps++;
    }
    const horasMs = items.reduce((acc, i) => {
      if (i.entrada_timestamp && i.salida_timestamp) {
        return acc + (new Date(i.salida_timestamp).getTime() - new Date(i.entrada_timestamp).getTime());
      }
      return acc;
    }, 0);
    const horas = Math.floor(horasMs / 3600000);
    const minutos = Math.floor((horasMs % 3600000) / 60000);
    return { total, abiertas, cerradas, incidencias, revisados, horas, minutos, lejosSitio, sinGps };
  }, [items, locCoords]);

  const exportCSV = () => {
    if (!items.length) { toast.error('No hay registros para exportar'); return; }
    const headers = ['Operario', 'DNI', 'Ubicacion', 'Entrada', 'Salida', 'Duracion', 'Distancia', 'Estado', 'Estado Admin', 'Notas'];
    const rows = items.map(i => [
      i.operario_nombre || '',
      i.dni || '',
      i.location_name || '',
      i.entrada_timestamp ? format(new Date(i.entrada_timestamp), 'dd/MM/yyyy HH:mm') : '',
      i.salida_timestamp ? format(new Date(i.salida_timestamp), 'dd/MM/yyyy HH:mm') : '',
      calcDuration(i.entrada_timestamp, i.salida_timestamp) || '',
      calcFichajeDistance(i, locCoords).text,
      i.estado || '',
      ESTADO_ADMIN[i.estado_admin]?.label || 'Pendiente',
      (i.notas_admin || '').replace(/[\n\r]/g, ' '),
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asistencias_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${items.length} registros exportados`);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="rounded-xl border border-border/50 bg-card/30 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Search className="h-4 w-4" /> Filtros
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <Input
            type="date"
            value={filters.dateFrom}
            onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
            className="h-9 text-sm"
          />
          <Input
            type="date"
            value={filters.dateTo}
            onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))}
            className="h-9 text-sm"
          />
          <Select value={filters.locationId} onValueChange={v => setFilters(f => ({ ...f, locationId: v }))}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Ubicación" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las ubicaciones</SelectItem>
              {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.estado} onValueChange={v => setFilters(f => ({ ...f, estado: v }))}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Jornada" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las jornadas</SelectItem>
              <SelectItem value="abierta">Abiertas</SelectItem>
              <SelectItem value="cerrada">Cerradas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.estadoAdmin} onValueChange={v => setFilters(f => ({ ...f, estadoAdmin: v }))}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Estado admin" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="pendiente">Pendientes</SelectItem>
              <SelectItem value="revisado">Revisados</SelectItem>
              <SelectItem value="incidencia">Con incidencia</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Buscar por nombre o DNI..."
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            className="h-9 text-sm"
          />
        </div>
        {(filters.dateFrom || filters.dateTo || filters.locationId !== 'all' || filters.estado !== 'all' || filters.estadoAdmin !== 'all' || filters.search) && (
          <button
            onClick={() => setFilters({ dateFrom: '', dateTo: '', locationId: 'all', estado: 'all', estadoAdmin: 'all', search: '' })}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={Clock} label="Total fichajes" value={stats.total} tone="slate" />
        <StatCard icon={LogIn} label="Jornadas abiertas" value={stats.abiertas} tone="blue" />
        <StatCard icon={LogOut} label="Jornadas cerradas" value={stats.cerradas} tone="emerald" />
        <StatCard icon={AlertTriangle} label={`Lejos del sitio (>${DISTANCE_THRESHOLD_M}m)`} value={stats.lejosSitio} tone="red" />
        <StatCard icon={MapPin} label="Sin GPS" value={stats.sinGps} tone="amber" />
        <StatCard icon={Clock} label="Horas trabajadas" value={`${stats.horas}h ${stats.minutos}m`} tone="amber" />
      </div>

      {/* Table */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isLoading ? 'Cargando...' : `${items.length} registro${items.length !== 1 ? 's' : ''}`}
          {data?.has_more && ' (mostrando los primeros 200)'}
        </p>
        <Button variant="outline" size="sm" className="gap-2" onClick={exportCSV} disabled={!items.length}>
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Operario</TableHead>
            <TableHead>DNI</TableHead>
            <TableHead>Ubicación</TableHead>
            <TableHead>Entrada</TableHead>
            <TableHead>Salida</TableHead>
            <TableHead>Duración</TableHead>
            <TableHead>Distancia</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Admin</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
              </TableCell>
            </TableRow>
          ) : items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center py-8 text-muted-foreground text-sm">
                No hay registros de asistencia para los filtros seleccionados.
              </TableCell>
            </TableRow>
          ) : items.map(fichaje => {
            const ea = ESTADO_ADMIN[fichaje.estado_admin] || ESTADO_ADMIN.pendiente;
            return (
              <TableRow key={fichaje.id} className="cursor-pointer hover:bg-accent/20" onClick={() => setSelected(fichaje)}>
                <TableCell className="font-medium">{fichaje.operario_nombre || '—'}</TableCell>
                <TableCell className="tabular-nums text-muted-foreground">{fichaje.dni || '—'}</TableCell>
                <TableCell className="text-muted-foreground text-xs max-w-[160px] truncate">{fichaje.location_name || '—'}</TableCell>
                <TableCell className="text-xs tabular-nums">
                  {fichaje.entrada_timestamp ? format(new Date(fichaje.entrada_timestamp), 'dd/MM/yy HH:mm') : '—'}
                </TableCell>
                <TableCell className="text-xs tabular-nums">
                  {fichaje.salida_timestamp ? format(new Date(fichaje.salida_timestamp), 'dd/MM/yy HH:mm') : '—'}
                </TableCell>
                <TableCell className="text-xs tabular-nums">
                  {calcDuration(fichaje.entrada_timestamp, fichaje.salida_timestamp) || (fichaje.estado === 'abierta' ? 'En curso' : '—')}
                </TableCell>
                <TableCell>
                  {(() => {
                    const d = calcFichajeDistance(fichaje, locCoords);
                    if (d.status === 'far') return <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-400 gap-1"><AlertTriangle className="h-2.5 w-2.5" />{d.text}</Badge>;
                    if (d.status === 'no_gps') return <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-400">{d.text}</Badge>;
                    if (d.status === 'no_coords') return <span className="text-xs text-muted-foreground">{d.text}</span>;
                    return <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400">{d.text}</Badge>;
                  })()}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={fichaje.estado === 'abierta' ? 'border-blue-500/30 bg-blue-500/10 text-blue-400' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'}>
                    {fichaje.estado === 'abierta' ? 'Abierta' : 'Cerrada'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={ea.class}>{ea.label}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setSelected(fichaje); }}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <AsistenciaDetailDialog
        fichaje={selected}
        onClose={() => setSelected(null)}
        locCoords={selected ? locCoords.get(selected.location_qr_id) : null}
      />
    </div>
  );
}