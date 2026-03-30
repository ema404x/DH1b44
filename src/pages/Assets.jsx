import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Search, Plus, Wrench, AlertTriangle, CheckCircle2, Clock, Pencil, Trash2, Cpu, Zap, Wind, Droplets, Car, Hammer, Building, ChevronRight } from 'lucide-react';
import { format, differenceInDays, isPast, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import PageHeader from '@/components/shared/PageHeader';

const typeLabels = { equipo_electrico:'Eléctrico', equipo_mecanico:'Mecánico', instalacion_hvac:'HVAC', instalacion_sanitaria:'Sanitario', estructura:'Estructura', vehiculo:'Vehículo', herramienta:'Herramienta', otro:'Otro' };
const typeIcons = { equipo_electrico: Zap, equipo_mecanico: Wrench, instalacion_hvac: Wind, instalacion_sanitaria: Droplets, estructura: Building, vehiculo: Car, herramienta: Hammer, otro: Cpu };
const statusColors = { operativo: 'bg-emerald-100 text-emerald-700 border-emerald-200', en_mantenimiento: 'bg-amber-100 text-amber-700 border-amber-200', fuera_de_servicio: 'bg-red-100 text-red-700 border-red-200', baja: 'bg-gray-100 text-gray-500 border-gray-200' };
const critColors = { baja: 'bg-slate-100 text-slate-600', media: 'bg-blue-100 text-blue-700', alta: 'bg-orange-100 text-orange-700', critica: 'bg-red-100 text-red-700' };

const emptyAsset = { name:'', code:'', type:'equipo_mecanico', brand:'', model:'', serial_number:'', location:'', status:'operativo', criticality:'media', maintenance_frequency_days:90, purchase_cost:0, notes:'' };

export default function Assets() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyAsset);
  const qc = useQueryClient();

  const { data: assets = [], isLoading } = useQuery({ queryKey: ['assets'], queryFn: () => base44.entities.Asset.list() });

  const saveMutation = useMutation({
    mutationFn: (data) => editing ? base44.entities.Asset.update(editing.id, data) : base44.entities.Asset.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assets'] }); setDialogOpen(false); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Asset.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }),
  });

  const openEdit = (a) => { setEditing(a); setForm({ ...a }); setDialogOpen(true); };
  const openNew = () => { setEditing(null); setForm(emptyAsset); setDialogOpen(true); };
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const getMaintenanceStatus = (asset) => {
    if (!asset.next_maintenance) return null;
    const days = differenceInDays(new Date(asset.next_maintenance), new Date());
    if (days < 0) return { label: `Vencido hace ${Math.abs(days)}d`, color: 'text-red-600', urgent: true };
    if (days <= 14) return { label: `En ${days}d`, color: 'text-amber-600', urgent: true };
    return { label: `En ${days}d`, color: 'text-emerald-600', urgent: false };
  };

  const filtered = assets.filter(a => {
    const matchSearch = !search || a.name?.toLowerCase().includes(search.toLowerCase()) || a.code?.toLowerCase().includes(search.toLowerCase()) || a.location?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || a.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: assets.length,
    operativo: assets.filter(a => a.status === 'operativo').length,
    mantenimiento: assets.filter(a => a.status === 'en_mantenimiento').length,
    vencidos: assets.filter(a => a.next_maintenance && isPast(new Date(a.next_maintenance))).length,
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Activos & Equipos" subtitle="Gestión de equipos, instalaciones y mantenimiento preventivo" actionLabel="Nuevo Activo" onAction={openNew} />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Activos', value: stats.total, color: 'border-l-slate-400' },
          { label: 'Operativos', value: stats.operativo, color: 'border-l-emerald-500' },
          { label: 'En Mantenimiento', value: stats.mantenimiento, color: 'border-l-amber-500' },
          { label: 'Mant. Vencidos', value: stats.vencidos, color: 'border-l-red-500' },
        ].map(s => (
          <Card key={s.label} className={`border-l-4 ${s.color}`}>
            <CardContent className="pt-4 pb-3">
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nombre, código, ubicación..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="operativo">Operativo</SelectItem>
            <SelectItem value="en_mantenimiento">En Mantenimiento</SelectItem>
            <SelectItem value="fuera_de_servicio">Fuera de Servicio</SelectItem>
            <SelectItem value="baja">Baja</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(asset => {
          const Icon = typeIcons[asset.type] || Cpu;
          const maintStatus = getMaintenanceStatus(asset);
          return (
            <Card key={asset.id} className="group hover:shadow-md transition-shadow cursor-pointer" onClick={() => openEdit(asset)}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="h-4.5 w-4.5 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm leading-tight">{asset.name}</div>
                      <div className="text-xs text-muted-foreground">{asset.code || typeLabels[asset.type]}</div>
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-xs border ${statusColors[asset.status]}`}>
                    {asset.status?.replace('_', ' ')}
                  </Badge>
                </div>

                <div className="space-y-1.5 text-xs text-muted-foreground">
                  {asset.location && <div className="flex gap-1.5"><span className="font-medium text-foreground/70">Ubicación:</span>{asset.location}</div>}
                  {asset.brand && <div className="flex gap-1.5"><span className="font-medium text-foreground/70">Marca/Modelo:</span>{asset.brand} {asset.model}</div>}
                  {maintStatus && (
                    <div className={`flex items-center gap-1.5 font-medium ${maintStatus.color}`}>
                      <Clock className="h-3 w-3" />
                      Próx. mantenimiento: {maintStatus.label}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between mt-3 pt-2.5 border-t">
                  <Badge className={`text-xs ${critColors[asset.criticality]}`}>
                    Criticidad {asset.criticality}
                  </Badge>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(asset)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>¿Eliminar activo?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(asset.id)}>Eliminar</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && !isLoading && (
          <div className="col-span-full text-center py-16 text-muted-foreground">
            <Cpu className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No se encontraron activos</p>
          </div>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Activo' : 'Nuevo Activo'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5"><Label className="text-xs">Nombre *</Label><Input value={form.name} onChange={e => set('name', e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Código</Label><Input value={form.code} onChange={e => set('code', e.target.value)} /></div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Tipo</Label>
              <Select value={form.type} onValueChange={v => set('type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(typeLabels).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Estado</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="operativo">Operativo</SelectItem>
                  <SelectItem value="en_mantenimiento">En Mantenimiento</SelectItem>
                  <SelectItem value="fuera_de_servicio">Fuera de Servicio</SelectItem>
                  <SelectItem value="baja">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Marca</Label><Input value={form.brand} onChange={e => set('brand', e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Modelo</Label><Input value={form.model} onChange={e => set('model', e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">N° Serie</Label><Input value={form.serial_number} onChange={e => set('serial_number', e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Criticidad</Label>
              <Select value={form.criticality} onValueChange={v => set('criticality', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baja">Baja</SelectItem><SelectItem value="media">Media</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem><SelectItem value="critica">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5"><Label className="text-xs">Ubicación</Label><Input value={form.location} onChange={e => set('location', e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Último Mantenimiento</Label><Input type="date" value={form.last_maintenance || ''} onChange={e => set('last_maintenance', e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Próximo Mantenimiento</Label><Input type="date" value={form.next_maintenance || ''} onChange={e => set('next_maintenance', e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Frecuencia (días)</Label><Input type="number" value={form.maintenance_frequency_days} onChange={e => set('maintenance_frequency_days', parseInt(e.target.value) || 90)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Costo de Adquisición</Label><Input type="number" value={form.purchase_cost} onChange={e => set('purchase_cost', parseFloat(e.target.value) || 0)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Fecha Compra</Label><Input type="date" value={form.purchase_date || ''} onChange={e => set('purchase_date', e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Garantía hasta</Label><Input type="date" value={form.warranty_expiry || ''} onChange={e => set('warranty_expiry', e.target.value)} /></div>
            <div className="col-span-2 space-y-1.5"><Label className="text-xs">Notas</Label><Textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}