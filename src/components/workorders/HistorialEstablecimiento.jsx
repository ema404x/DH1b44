import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { History, Search, CheckCircle2, Clock, Archive, FileClock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useResolveCreator } from '@/hooks/useResolveCreator';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { fetchAllList } from '@/lib/fetchAllList';

const statusColors = {
  pendiente: 'bg-yellow-100 text-yellow-700',
  asignada: 'bg-blue-100 text-blue-700',
  en_progreso: 'bg-purple-100 text-purple-700',
  completada: 'bg-emerald-100 text-emerald-700',
  cancelada: 'bg-gray-100 text-gray-500',
};

// Normalización NFD + strip acentos + collapse espacios. Case-insensitive.
// Unifica "GASTON MASSA" = "Gaston Massa" en el match de jefes y en el buscador.
const norm = (s) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ');

// Historial de Órdenes de Trabajo.
//
// REGLA DE ORO — Visibilidad: usa getWorkOrdersForUser (fuente canónica), NO
// query directa del SDK. Así un jefe_sitio ve SOLO sus OTs (otEsVisiblePara:
// creador / jefe_email / nombre / linkage jefe) y un gerente con admin_view
// (permiso "Ver Todo" del rol de Empleado) ve las del sector. Antes la query
// directa respetaba RLS, pero el RLS read deja a un gerente de plataforma ver
// TODAS las del sector aunque su rol de Empleado sea jefe_sitio sin "Ver Todo"
// — Sophia (platformRole='gerente', EmployeeRole='Jefe de sitio') veía 96
// archivadas del sector en vez de sus 55. getWorkOrdersForUser cierra esa
// discrepancia: es la misma fuente que usa el tablero, así que el conteo del
// header ("55 archivadas") coincide exactamente con el historial.
//
// Pestaña "Por Establecimiento": todas las OTs visibles agrupadas por
// establecimiento. Pestaña "Archivadas": OTs que pasaron a completada y a los
// 30 días se archivaron automáticamente (archivada=true).
export default function HistorialEstablecimiento({ open, onOpenChange, onOpenOrder }) {
  const [tab, setTab] = useState('establecimiento');
  const [search, setSearch] = useState('');
  const [selectedEstab, setSelectedEstab] = useState('');
  const [selectedJefe, setSelectedJefe] = useState('');
  const { resolveCreator } = useResolveCreator();
  const { isAdmin, currentUser } = useCurrentUser();
  const isGerente = isAdmin || currentUser?.role === 'gerente';

  // ── Fuente canónica de visibilidad (regla de oro) ──
  // Una sola llamada trae TODAS las OTs visibles para el caller (activas +
  // archivadas). Las archivadas se filtran en el cliente (archivada=true). Así
  // el historial es 100% consistente con el tablero: lo que cuenta como
  // "archivada" en el header es lo mismo que se lista acá.
  const { data: visData, isLoading } = useQuery({
    queryKey: ['workorders-visible-historial'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getWorkOrdersForUser', { includeArchived: true });
      return res.data;
    },
    enabled: open,
    staleTime: 30 * 1000,
  });
  const orders = visData?.orders || [];

  // ── Jefes canónicos del sector ──
  // Reusamos getOperariosSector (is_jefe) en lugar de armar el dropdown desde
  // el texto libre jefe_sitio de las OTs. Esto:
  //  - Muestra a TODOS los jefes del sector (Juan Aschettino aparece aunque no
  //    tenga archivadas; antes no aparecía porque el dropdown se armaba solo
  //    con los jefes que tenían OTs archivadas).
  //  - Unifica variantes case ("GASTON MASSA" = "Gaston Massa") porque la
  //    fuente es Employee.full_name (canónico).
  //  - Da email + user_id para un filtro robusto (no solo match por nombre).
  const { data: operariosData } = useQuery({
    queryKey: ['operarios-sector'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getOperariosSector', {});
      return res.data;
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });
  const jefes = useMemo(
    () => (operariosData?.operarios || []).filter((o) => o.is_jefe),
    [operariosData]
  );

  // ── Direcciones → jefe (cruce de ubicación) ──
  // Igual que WorkOrders.jsx: cuando una OT no tiene jefe_sitio directo, se
  // resuelve cruzando su location contra Direccion.jefe_sitio. Solo lo cargan
  // gerentes (los que filtran por jefe). Sector-scoped por RLS de Direccion.
  const { data: direcciones = [] } = useQuery({
    queryKey: ['direcciones-jefes'],
    queryFn: () => fetchAllList('Direccion', '-created_date'),
    enabled: open && isGerente,
    staleTime: 5 * 60 * 1000,
  });
  const addrToJefe = useMemo(() => {
    const map = {};
    const n = (s) =>
      (s || '').toUpperCase().trim().replace(/\s+/g, ' ').replace(/,\s*CABA\s*$/, '').replace(/,\s*$/, '').trim();
    direcciones.forEach((d) => {
      if (d.direccion && d.jefe_sitio) map[n(d.direccion)] = d.jefe_sitio.trim();
    });
    return { map, n };
  }, [direcciones]);
  const resolveJefe = useMemo(
    () => (o) => {
      if (o.jefe_sitio) return o.jefe_sitio;
      const { map, n } = addrToJefe;
      const loc = n(o.location);
      if (!loc) return null;
      if (map[loc]) return map[loc];
      if (loc.length >= 10) {
        for (const addr of Object.keys(map)) {
          if (addr.length >= 10 && (loc.includes(addr) || addr.includes(loc))) return map[addr];
        }
      }
      return null;
    },
    [addrToJefe]
  );

  const archivadas = useMemo(() => orders.filter((o) => o.archivada), [orders]);

  const establecimientos = useMemo(() => {
    const set = new Set();
    orders.forEach((o) => { if (o.location) set.add(o.location); });
    return [...set].sort();
  }, [orders]);

  // Jefe seleccionado (objeto canónico con email + user_id). Si no hay
  // selección, null → no filtra por jefe.
  const jefeSeleccionado = useMemo(
    () => jefes.find((j) => j.full_name === selectedJefe) || null,
    [jefes, selectedJefe]
  );

  // Predicado robusto: una OT pertenece al jefe canónico si coincide por
  // email, user_id (created_by_id), nombre normalizado, o resolveJefe
  // (cruce de dirección). Resuelve el bug de variantes case: "GASTON MASSA"
  // y "Gaston Massa" matchean el mismo jefe canónico "Gaston Massa".
  const perteneceAJefe = (o, jefe) => {
    if (!jefe) return true;
    if (jefe.email && (o.jefe_sitio_email || '').toLowerCase().trim() === jefe.email) return true;
    if (jefe.user_id && o.created_by_id === jefe.user_id) return true;
    if (o.jefe_sitio && norm(o.jefe_sitio) === norm(jefe.full_name)) return true;
    const r = resolveJefe(o);
    if (r && norm(r) === norm(jefe.full_name)) return true;
    return false;
  };

  // Buscador normalizado: busca en título, ubicación, ubicación QR, asignado,
  // jefe_sitio, jefe_sitio_email, creador (resuelto) y código. NFD + strip
  // acentos: "sophia" encuentra "Sofía Aguilera" aunque el usuario escriba sin
  // acentos/mayúsculas.
  const matchSearch = (o, q) => {
    if (!q) return true;
    const creador = resolveCreator(o.created_by_id, '');
    return norm(o.title).includes(q) ||
      norm(o.location).includes(q) ||
      norm(o.location_qr_name).includes(q) ||
      norm(o.assigned_name).includes(q) ||
      norm(o.jefe_sitio).includes(q) ||
      norm(o.jefe_sitio_email).includes(q) ||
      norm(creador).includes(q) ||
      norm(o.code).includes(q);
  };

  const filtered = useMemo(() => {
    const q = norm(search);
    if (tab === 'archivadas') {
      // Ordenadas por fecha_archivado descendente (más recientes primero).
      return archivadas
        .filter((o) => matchSearch(o, q) && perteneceAJefe(o, jefeSeleccionado))
        .sort((a, b) => (b.fecha_archivado || '').localeCompare(a.fecha_archivado || ''));
    }
    return orders.filter((o) => {
      const matchEstab = !selectedEstab || o.location === selectedEstab;
      return matchSearch(o, q) && matchEstab;
    });
  }, [orders, archivadas, search, selectedEstab, tab, jefeSeleccionado, resolveJefe]);

  const stats = useMemo(() => {
    if (tab === 'archivadas') {
      const base = selectedJefe
        ? archivadas.filter((o) => perteneceAJefe(o, jefeSeleccionado))
        : archivadas;
      return { total: base.length, completadas: base.length, pendientes: 0 };
    }
    const base = selectedEstab ? orders.filter((o) => o.location === selectedEstab) : orders;
    return {
      total: base.length,
      completadas: base.filter((o) => o.status === 'completada').length,
      pendientes: base.filter((o) => o.status === 'pendiente').length,
    };
  }, [orders, archivadas, selectedEstab, selectedJefe, tab, jefeSeleccionado]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" /> Historial
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 flex-shrink-0">
          <button
            onClick={() => setTab('establecimiento')}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium transition-all ${tab === 'establecimiento' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <History className="h-3.5 w-3.5" /> Por Establecimiento
          </button>
          <button
            onClick={() => setTab('archivadas')}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium transition-all ${tab === 'archivadas' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Archive className="h-3.5 w-3.5" /> Archivadas
            {archivadas.length > 0 && (
              <Badge className="text-[10px] h-4 px-1.5">{archivadas.length}</Badge>
            )}
          </button>
        </div>

        <div className="space-y-3 flex-shrink-0">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total', value: stats.total, icon: tab === 'archivadas' ? Archive : History, color: 'text-primary' },
              { label: 'Completadas', value: stats.completadas, icon: CheckCircle2, color: 'text-emerald-600' },
              { label: 'Pendientes', value: stats.pendientes, icon: tab === 'archivadas' ? FileClock : Clock, color: 'text-amber-600' },
            ].map((s, i) => (
              <div key={i} className="rounded-lg border bg-card p-3 text-center">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            {tab === 'establecimiento' && (
              <Select value={selectedEstab || null} onValueChange={(v) => setSelectedEstab(v || '')}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Todos los establecimientos..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Todos</SelectItem>
                  {establecimientos.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {/* Filtro por jefe de sitio (solo gerentes/admin). Dropdown
                canónico desde Employee (getOperariosSector) — no desde texto
                libre de las OTs. Muestra a todos los jefes del sector. */}
            {tab === 'archivadas' && isGerente && (
              <Select value={selectedJefe || null} onValueChange={(v) => setSelectedJefe(v || '')}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Todos los jefes..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Todos</SelectItem>
                  {jefes.map((j) => <SelectItem key={j.user_id || j.full_name} value={j.full_name}>{j.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={tab === 'archivadas' ? 'Buscar archivadas (jefe, creador, establecimiento...)' : 'Buscar...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 mt-1">
          {isLoading && filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Cargando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              {tab === 'archivadas'
                ? 'Sin OTs archivadas para este filtro. Las OTs completadas se archivan automáticamente a los 30 días.'
                : 'Sin órdenes para mostrar'}
            </p>
          ) : (
            filtered.map((o) => {
              const creador = resolveCreator(o.created_by_id, '');
              return (
                <div
                  key={o.id}
                  className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/30 transition-colors cursor-pointer"
                  onClick={() => onOpenOrder && onOpenOrder(o)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold truncate">{o.title}</p>
                      <Badge className={`text-[10px] ${statusColors[o.status] || 'bg-gray-100 text-gray-600'}`}>
                        {o.status?.replace(/_/g, ' ')}
                      </Badge>
                      {tab === 'archivadas' && (
                        <Badge className="text-[10px] bg-slate-200 text-slate-600 flex items-center gap-1">
                          <Archive className="h-3 w-3" /> Archivada
                        </Badge>
                      )}
                      {o.priority === 'urgente' && <Badge className="text-[10px] bg-red-100 text-red-700">Urgente</Badge>}
                    </div>
                    <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      {o.location && <span>📍 {o.location}</span>}
                      {o.assigned_name && <span>👤 {o.assigned_name}</span>}
                      {o.jefe_sitio && <span>🧑‍💼 {o.jefe_sitio}</span>}
                      {creador && <span>✍️ {creador}</span>}
                      {o.created_date && <span>📅 {format(parseISO(o.created_date), 'dd/MM/yyyy', { locale: es })}</span>}
                      {o.completed_date && <span className="text-emerald-600">✅ {format(parseISO(o.completed_date), 'dd/MM/yyyy', { locale: es })}</span>}
                      {tab === 'archivadas' && o.fecha_archivado && (
                        <span className="text-slate-500">🗄️ {format(parseISO(o.fecha_archivado), 'dd/MM/yyyy', { locale: es })}</span>
                      )}
                    </div>
                    {o.description && <p className="text-xs text-muted-foreground mt-1 truncate">{o.description}</p>}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center flex-shrink-0">{filtered.length} órdenes</p>
      </DialogContent>
    </Dialog>
  );
}