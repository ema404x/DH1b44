import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, QrCode, MapPin, Pencil, Trash2, Building2, Search, CheckCheck } from 'lucide-react';
import QRCodeModal from '@/components/shared/QRCodeModal';
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

const emptyForm = {
  name: '', description: '', address: '', project_name: '',
  color: 'blue', is_active: true, event_type: 'ambos',
  latitude: '', longitude: '',
};

export default function LocationsManager({ locations, isLoading, onUpdate, onDelete, onCreate, onActivateAll, highlightedLocId, onClearHighlight }) {
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [qrLoc, setQrLoc] = useState(null);
  const [saving, setSaving] = useState(false);
  const cardRefs = useRef({});

  // Scroll to highlighted location and open edit dialog
  useEffect(() => {
    if (!highlightedLocId) return;
    const loc = locations.find(l => l.id === highlightedLocId);
    if (!loc) return;
    // Scroll to card
    setTimeout(() => {
      const el = cardRefs.current[highlightedLocId];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
    if (onClearHighlight) setTimeout(onClearHighlight, 3000);
  }, [highlightedLocId]);

  const filtered = locations.filter(loc => {
    const matchSearch = !search ||
      loc.name?.toLowerCase().includes(search.toLowerCase()) ||
      loc.address?.toLowerCase().includes(search.toLowerCase()) ||
      loc.project_name?.toLowerCase().includes(search.toLowerCase());
    const matchActive = filterActive === 'all' ||
      (filterActive === 'active' && loc.is_active) ||
      (filterActive === 'inactive' && !loc.is_active);
    return matchSearch && matchActive;
  });

  const openNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (loc) => { setEditing(loc); setForm({ ...loc }); setDialogOpen(true); };
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const getQROTUrl = (loc) => `${window.location.origin}/ejecutar-ot?loc=${loc.id}`;

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('El nombre es requerido'); return; }
    setSaving(true);
    const payload = {
      ...form,
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
    };
    if (editing) {
      await onUpdate(editing.id, payload);
      toast.success('Ubicación actualizada');
    } else {
      await onCreate(payload);
    }
    setSaving(false);
    setDialogOpen(false);
  };

  const handleToggle = (loc, val) => onUpdate(loc.id, { is_active: val });

  const handleDelete = (id) => {
    onDelete(id);
    toast.success('Ubicación eliminada');
  };

  const colorDot = COLOR_OPTIONS.find(c => c.value === form.color)?.dot || 'bg-blue-500';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1 max-w-lg">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar ubicaciones..."
              className="pl-8 h-9"
            />
          </div>
          <select
            value={filterActive}
            onChange={e => setFilterActive(e.target.value)}
            className="px-3 py-1.5 text-sm border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        </div>
        <div className="flex gap-2">
          {onActivateAll && locations.some(l => !l.is_active) && (
            <Button variant="outline" size="sm" className="gap-1.5 h-9 text-emerald-700 border-emerald-300 hover:bg-emerald-50" onClick={onActivateAll}>
              <CheckCheck className="h-4 w-4" /> Activar todas
            </Button>
          )}
          <Button onClick={openNew} className="gap-2 h-9">
            <Plus className="h-4 w-4" /> Nueva Ubicación
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex gap-4 text-sm text-muted-foreground">
        <span><strong className="text-foreground">{locations.length}</strong> totales</span>
        <span><strong className="text-emerald-600">{locations.filter(l => l.is_active).length}</strong> activas</span>
        <span><strong className="text-slate-400">{locations.filter(l => !l.is_active).length}</strong> inactivas</span>
        <span><strong className="text-primary">{locations.reduce((s, l) => s + (l.total_scans || 0), 0)}</strong> escaneos totales</span>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-xl py-16 text-center">
          <MapPin className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="font-medium text-sm text-muted-foreground">
            {search ? 'Sin resultados para la búsqueda' : 'Sin ubicaciones configuradas'}
          </p>
          {!search && (
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
            return (
              <Card
                key={loc.id}
                ref={el => { cardRefs.current[loc.id] = el; }}
                className={`overflow-hidden transition-all hover:shadow-md ${!loc.is_active ? 'opacity-70 border-dashed' : ''} ${isHighlighted ? 'ring-2 ring-primary ring-offset-2 shadow-lg' : ''}`}
              >
                <div className="h-1.5 w-full" style={{ background: colorCfg.hex }} />
                <CardContent className="pt-4 pb-4 px-4">
                  {/* Header row */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0`} style={{ background: colorCfg.hex + '22' }}>
                        <Building2 className="h-4 w-4" style={{ color: colorCfg.hex }} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm leading-tight truncate">{loc.name}</p>
                        {loc.project_name && <p className="text-xs text-muted-foreground truncate">{loc.project_name}</p>}
                      </div>
                    </div>
                    <Switch
                      checked={!!loc.is_active}
                      onCheckedChange={val => handleToggle(loc, val)}
                      className="scale-75 flex-shrink-0"
                    />
                  </div>

                  {/* Info */}
                  <div className="space-y-1 mb-3">
                    {loc.address && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{loc.address}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{EVENT_TYPE_LABELS[loc.event_type] || loc.event_type}</span>
                      <span className="font-semibold text-foreground">{loc.total_scans || 0} escaneos</span>
                    </div>
                    {(loc.latitude && loc.longitude) && (
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
                        <MapPin className="h-2.5 w-2.5" />
                        {parseFloat(loc.latitude).toFixed(5)}, {parseFloat(loc.longitude).toFixed(5)}
                      </div>
                    )}
                  </div>

                  {/* Assigned employees badge */}
                  {loc.assigned_employees?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {loc.assigned_employees.slice(0, 2).map(emp => (
                        <Badge key={emp} variant="secondary" className="text-[10px] py-0">{emp}</Badge>
                      ))}
                      {loc.assigned_employees.length > 2 && (
                        <Badge variant="secondary" className="text-[10px] py-0">+{loc.assigned_employees.length - 2}</Badge>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                   <div className="flex items-center justify-end gap-0.5 pt-2 border-t border-border/50">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" onClick={() => setQrLoc(loc)} title="QR Orden de Trabajo">
                      <QrCode className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(loc)} title="Editar">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Eliminar">
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

      {/* QR Orden de Trabajo */}
      <QRCodeModal
        open={!!qrLoc}
        onClose={() => setQrLoc(null)}
        title={qrLoc?.name || ''}
        subtitle={qrLoc?.address || qrLoc?.project_name || 'Escanear para ver y completar la OT'}
        value={qrLoc ? getQROTUrl(qrLoc) : ''}
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
              <Label className="text-xs">Descripción</Label>
              <Input value={form.description || ''} onChange={e => set('description', e.target.value)} placeholder="Descripción del sitio" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Dirección</Label>
              <Input value={form.address || ''} onChange={e => set('address', e.target.value)} placeholder="Av. Corrientes 1234, CABA" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Proyecto asociado</Label>
              <Input value={form.project_name || ''} onChange={e => set('project_name', e.target.value)} placeholder="Nombre del proyecto (opcional)" />
            </div>

            {/* GPS coords */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Latitud GPS</Label>
                <Input type="number" step="0.00001" value={form.latitude || ''} onChange={e => set('latitude', e.target.value)} placeholder="-34.60370" className="font-mono text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Longitud GPS</Label>
                <Input type="number" step="0.00001" value={form.longitude || ''} onChange={e => set('longitude', e.target.value)} placeholder="-58.38160" className="font-mono text-xs" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de fichaje</Label>
              <Select value={form.event_type || 'ambos'} onValueChange={v => set('event_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Solo Entrada</SelectItem>
                  <SelectItem value="salida">Solo Salida</SelectItem>
                  <SelectItem value="ambos">Entrada y Salida</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Color identificador</Label>
              <Select value={form.color || 'blue'} onValueChange={v => set('color', v)}>
                <SelectTrigger>
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

            <div className="flex items-center justify-between pt-1 border-t">
              <div>
                <Label className="text-sm font-medium">Activo</Label>
                <p className="text-xs text-muted-foreground">Disponible para fichajes</p>
              </div>
              <Switch checked={!!form.is_active} onCheckedChange={v => set('is_active', v)} />
            </div>
          </div>

          <div className="flex gap-2 pt-2 border-t">
            <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving || !form.name}>
              {editing ? 'Guardar cambios' : 'Crear ubicación'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}