import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, QrCode, MapPin, Pencil, Trash2, Building2, Search, CheckCheck, X, Crosshair, Loader2, ArrowUpDown, Users, ScanLine, Power } from 'lucide-react';
import LocationQRModal from '@/components/mapa/LocationQRModal';
import { toast } from 'sonner';

const COLOR_OPTIONS = [
  { value: 'blue',   label: 'Azul',    dot: 'bg-blue-500',   hex: '#3b82f6' },
  { value: 'green',  label: 'Verde',   dot: 'bg-emerald-500', hex: '#10b981' },
  { value: 'purple', label: 'Violeta', dot: 'bg-purple-500',  hex: '#a855f7' },
  { value: 'orange', label: 'Naranja', dot: 'bg-orange-500',  hex: '#f97316' },
  { value: 'red',    label: 'Rojo',    dot: 'bg-red-500',     hex: '#ef4444' },
  { value: 'yellow', label: 'Amarillo',dot: 'bg-yellow-500',  hex: '#eab308' },
  { value: 'pink',   label: 'Rosa',    dot: 'bg-pink-500',    hex: '#ec4899' },
];

const EVENT_TYPE_LABELS = { entrada: 'Solo Entrada', salida: 'Solo Salida', ambos: 'Entrada y Salida' };

const SORT_OPTIONS = [
  { value: 'name',       label: 'Nombre A-Z' },
  { value: 'name_desc',  label: 'Nombre Z-A' },
  { value: 'scans',      label: 'Más escaneos' },
  { value: 'recent',     label: 'Más recientes' },
  { value: 'active',     label: 'Activos primero' },
];

const emptyForm = {
  name: '', description: '', address: '', project_name: '',
  color: 'blue', is_active: true, event_type: 'ambos',
  latitude: '', longitude: '',
};

// Normalizar texto: lowercase + sin acentos + trimmed
const normalize = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

function SkeletonCard() {
  return (
    <Card className="overflow-hidden">
      <div className="h-1.5 w-full bg-muted" />
      <CardContent className="pt-4 pb-4 px-4">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="h-9 w-9 rounded-lg bg-muted animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-3/4 rounded bg-muted animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
          </div>
          <div className="h-5 w-9 rounded-full bg-muted animate-pulse" />
        </div>
        <div className="space-y-1.5 mb-3">
          <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
          <div className="h-3 w-1/3 rounded bg-muted animate-pulse" />
        </div>
        <div className="flex justify-end gap-1 pt-2 border-t border-border/50">
          <div className="h-7 w-7 rounded bg-muted animate-pulse" />
          <div className="h-7 w-7 rounded bg-muted animate-pulse" />
          <div className="h-7 w-7 rounded bg-muted animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
}

function StatPill({ icon: Icon, value, label, color }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/40 border border-border/50">
      <Icon className={`h-3.5 w-3.5 ${color || 'text-muted-foreground'}`} />
      <div className="leading-none">
        <span className="font-bold text-sm text-foreground">{value}</span>
        <span className="text-xs text-muted-foreground ml-1">{label}</span>
      </div>
    </div>
  );
}

export default function LocationsManager({ locations, isLoading, onUpdate, onDelete, onCreate, onActivateAll, highlightedLocId, onClearHighlight }) {
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [qrLoc, setQrLoc] = useState(null);
  const [saving, setSaving] = useState(false);
  const [capturingGPS, setCapturingGPS] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const cardRefs = useRef({});

  // Scroll to highlighted location
  useEffect(() => {
    if (!highlightedLocId) return;
    const loc = locations.find(l => l.id === highlightedLocId);
    if (!loc) return;
    setTimeout(() => {
      const el = cardRefs.current[highlightedLocId];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
    if (onClearHighlight) setTimeout(onClearHighlight, 3000);
  }, [highlightedLocId]);

  // Filter + sort with memoization
  const filtered = useMemo(() => {
    const searchNorm = normalize(search);
    let result = locations.filter(loc => {
      const matchSearch = !searchNorm ||
        normalize(loc.name).includes(searchNorm) ||
        normalize(loc.address).includes(searchNorm) ||
        normalize(loc.project_name).includes(searchNorm);
      const matchActive = filterActive === 'all' ||
        (filterActive === 'active' && loc.is_active) ||
        (filterActive === 'inactive' && !loc.is_active);
      return matchSearch && matchActive;
    });

    const sorters = {
      name:      (a, b) => normalize(a.name).localeCompare(normalize(b.name)),
      name_desc: (a, b) => normalize(b.name).localeCompare(normalize(a.name)),
      scans:     (a, b) => (b.total_scans || 0) - (a.total_scans || 0),
      recent:    (a, b) => new Date(b.created_date || 0).getTime() - new Date(a.created_date || 0).getTime(),
      active:    (a, b) => (b.is_active ? 1 : 0) - (a.is_active ? 1 : 0),
    };
    result.sort(sorters[sortBy] || sorters.name);
    return result;
  }, [locations, search, filterActive, sortBy]);

  // Stats contextuales (sobre el filtro actual)
  const stats = useMemo(() => {
    const total = locations.length;
    const shown = filtered.length;
    const active = filtered.filter(l => l.is_active).length;
    const inactive = shown - active;
    const scans = filtered.reduce((s, l) => s + (l.total_scans || 0), 0);
    return { total, shown, active, inactive, scans };
  }, [locations, filtered]);

  const openNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (loc) => { setEditing(loc); setForm({ ...loc }); setDialogOpen(true); };
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const openQRModal = (loc) => setQrLoc(loc);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('El nombre es requerido'); return; }
    setSaving(true);
    const payload = {
      ...form,
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
    };
    try {
      if (editing) {
        await onUpdate(editing.id, payload);
        toast.success('Ubicación actualizada');
      } else {
        await onCreate(payload);
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error('No se pudo guardar la ubicación');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (loc, val) => {
    setTogglingId(loc.id);
    try {
      await onUpdate(loc.id, { is_active: val });
    } catch (err) {
      toast.error('No se pudo cambiar el estado');
      // Revert visual state on failure — the switch will snap back on next render
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id) => {
    try {
      await onDelete(id);
      toast.success('Ubicación eliminada');
    } catch (err) {
      toast.error('No se pudo eliminar la ubicación');
    }
  };

  const handleCaptureGPS = () => {
    if (!navigator.geolocation) { toast.error('GPS no disponible en este dispositivo'); return; }
    setCapturingGPS(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set('latitude', pos.coords.latitude.toFixed(5));
        set('longitude', pos.coords.longitude.toFixed(5));
        toast.success('Coordenadas capturadas');
        setCapturingGPS(false);
      },
      (err) => {
        toast.error('No se pudo obtener la ubicación: ' + (err.message || 'permiso denegado'));
        setCapturingGPS(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const colorDot = COLOR_OPTIONS.find(c => c.value === form.color)?.dot || 'bg-blue-500';
  const hasSearch = search.length > 0;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
        <div className="flex gap-2 flex-1 max-w-2xl w-full">
          {/* Search with clear button */}
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, dirección o proyecto..."
              className="pl-8 pr-8 h-9"
            />
            {hasSearch && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {/* Filter */}
          <Select value={filterActive} onValueChange={setFilterActive}>
            <SelectTrigger className="w-[130px] h-9 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="inactive">Inactivos</SelectItem>
            </SelectContent>
          </Select>
          {/* Sort */}
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[160px] h-9 shrink-0">
              <div className="flex items-center gap-1.5">
                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 shrink-0">
          {onActivateAll && locations.some(l => !l.is_active) && (
            <Button variant="outline" size="sm" className="gap-1.5 h-9 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10" onClick={onActivateAll}>
              <CheckCheck className="h-4 w-4" /> Activar todas
            </Button>
          )}
          <Button onClick={openNew} className="gap-2 h-9">
            <Plus className="h-4 w-4" /> Nueva Ubicación
          </Button>
        </div>
      </div>

      {/* Stats bar — contextuales al filtro */}
      <div className="flex flex-wrap gap-2">
        <StatPill icon={Building2} value={stats.shown} label={hasSearch || filterActive !== 'all' ? `de ${stats.total} totales` : 'ubicaciones'} />
        <StatPill icon={Power} value={stats.active} label="activas" color="text-emerald-500" />
        {stats.inactive > 0 && (
          <StatPill icon={Power} value={stats.inactive} label="inactivas" color="text-slate-400" />
        )}
        <StatPill icon={ScanLine} value={stats.scans} label="escaneos" color="text-primary" />
        {filtered.some(l => l.assigned_employees?.length > 0) && (
          <StatPill icon={Users} value={filtered.filter(l => l.assigned_employees?.length > 0).length} label="con cuadrilla" color="text-purple-400" />
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-xl py-16 text-center">
          <MapPin className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="font-medium text-sm text-muted-foreground">
            {hasSearch || filterActive !== 'all' ? 'Sin resultados para los filtros aplicados' : 'Sin ubicaciones configuradas'}
          </p>
          {(hasSearch || filterActive !== 'all') && (
            <Button size="sm" variant="ghost" onClick={() => { setSearch(''); setFilterActive('all'); }} className="mt-3 gap-1.5">
              <X className="h-3.5 w-3.5" /> Limpiar filtros
            </Button>
          )}
          {!hasSearch && filterActive === 'all' && (
            <Button size="sm" variant="outline" onClick={openNew} className="mt-4 gap-1.5">
              <Plus className="h-4 w-4" /> Crear primera ubicación
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(loc => {
            const colorCfg = COLOR_OPTIONS.find(c => c.value === loc.color) || COLOR_OPTIONS[0];
            const isHighlighted = loc.id === highlightedLocId;
            const hasGPS = loc.latitude && loc.longitude;
            const hasCuadrilla = loc.assigned_employees?.length > 0;
            const isToggling = togglingId === loc.id;
            return (
              <Card
                key={loc.id}
                ref={el => { cardRefs.current[loc.id] = el; }}
                className={`overflow-hidden card-lift transition-all ${!loc.is_active ? 'opacity-60' : ''} ${isHighlighted ? 'ring-2 ring-primary ring-offset-2 shadow-lg' : ''}`}
              >
                <div className="h-1.5 w-full" style={{ background: colorCfg.hex }} />
                <CardContent className="pt-4 pb-3 px-4">
                  {/* Header row */}
                  <div className="flex items-start justify-between mb-2.5">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: colorCfg.hex + '22' }}>
                        <Building2 className="h-4 w-4" style={{ color: colorCfg.hex }} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm leading-tight line-clamp-2">{loc.name}</p>
                        {loc.project_name && <p className="text-xs text-muted-foreground truncate mt-0.5">{loc.project_name}</p>}
                      </div>
                    </div>
                    <Switch
                      checked={!!loc.is_active}
                      onCheckedChange={val => handleToggle(loc, val)}
                      disabled={isToggling}
                      className="scale-75 flex-shrink-0"
                    />
                  </div>

                  {/* Info badges */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                    <Badge variant="outline" className="text-[10px] py-0 gap-1 font-normal">
                      {EVENT_TYPE_LABELS[loc.event_type] || loc.event_type}
                    </Badge>
                    {hasGPS && (
                      <Badge variant="outline" className="text-[10px] py-0 gap-1 font-normal text-emerald-600 border-emerald-500/20">
                        <MapPin className="h-2.5 w-2.5" /> GPS
                      </Badge>
                    )}
                    {hasCuadrilla && (
                      <Badge variant="outline" className="text-[10px] py-0 gap-1 font-normal text-purple-400 border-purple-500/20">
                        <Users className="h-2.5 w-2.5" /> {loc.assigned_employees.length}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] py-0 gap-1 font-normal text-primary border-primary/20">
                      <ScanLine className="h-2.5 w-2.5" /> {loc.total_scans || 0}
                    </Badge>
                  </div>

                  {/* Address */}
                  {loc.address && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                      <MapPin className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{loc.address}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-0.5 pt-2 border-t border-border/50">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 hover:text-emerald-500" onClick={() => openQRModal(loc)} title="Ver QR y OTs">
                      <QrCode className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(loc)} title="Editar">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="Eliminar">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar "{loc.name}"?</AlertDialogTitle>
                          <AlertDialogDescription>Esta acción no se puede deshacer. El QR dejará de ser válido.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(loc.id)}>Eliminar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* QR + OTs de la ubicación */}
      <LocationQRModal
        open={!!qrLoc}
        onClose={() => setQrLoc(null)}
        location={qrLoc}
      />

      {/* Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Ubicación' : 'Nueva Ubicación'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre *</Label>
              <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ej: Obra Norte, Depósito Central" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Dirección</Label>
              <Input value={form.address || ''} onChange={e => set('address', e.target.value)} placeholder="Av. Corrientes 1234, CABA" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descripción</Label>
              <Input value={form.description || ''} onChange={e => set('description', e.target.value)} placeholder="Descripción del sitio" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Proyecto asociado</Label>
              <Input value={form.project_name || ''} onChange={e => set('project_name', e.target.value)} placeholder="Nombre del proyecto (opcional)" />
            </div>

            {/* GPS coords con captura */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Coordenadas GPS</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={handleCaptureGPS}
                  disabled={capturingGPS}
                >
                  {capturingGPS ? <Loader2 className="h-3 w-3 animate-spin" /> : <Crosshair className="h-3 w-3" />}
                  {capturingGPS ? 'Capturando...' : 'Capturar GPS'}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input type="number" step="0.00001" value={form.latitude || ''} onChange={e => set('latitude', e.target.value)} placeholder="-34.60370" className="font-mono text-xs h-8" />
                <Input type="number" step="0.00001" value={form.longitude || ''} onChange={e => set('longitude', e.target.value)} placeholder="-58.38160" className="font-mono text-xs h-8" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de fichaje</Label>
                <Select value={form.event_type || 'ambos'} onValueChange={v => set('event_type', v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Solo Entrada</SelectItem>
                    <SelectItem value="salida">Solo Salida</SelectItem>
                    <SelectItem value="ambos">Entrada y Salida</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Color</Label>
                <Select value={form.color || 'blue'} onValueChange={v => set('color', v)}>
                  <SelectTrigger className="h-9">
                    <div className="flex items-center gap-2">
                      <div className={`h-3 w-3 rounded-full ${colorDot}`} />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {COLOR_OPTIONS.map(c => (
                      <SelectItem key={c.value} value={c.value}>
                        <div className="flex items-center gap-2">
                          <div className={`h-3 w-3 rounded-full ${c.dot}`} />
                          {c.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t">
              <div>
                <Label className="text-sm font-medium">Activo</Label>
                <p className="text-xs text-muted-foreground">Disponible para fichajes</p>
              </div>
              <Switch checked={!!form.is_active} onCheckedChange={v => set('is_active', v)} />
            </div>
          </div>

          <div className="flex gap-2 pt-2 border-t">
            <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button className="flex-1 gap-2" onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? 'Guardar cambios' : 'Crear ubicación'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}