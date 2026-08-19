import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import AssetHistory from '@/components/assets/AssetHistory';

const typeLabels = {
  equipo_electrico: 'Eléctrico', equipo_mecanico: 'Mecánico', instalacion_hvac: 'HVAC',
  instalacion_sanitaria: 'Sanitario', estructura: 'Estructura', vehiculo: 'Vehículo',
  herramienta: 'Herramienta', sistemas_informaticos: 'Informático', mobiliario: 'Mobiliario',
  seguridad: 'Seguridad', otro: 'Otro',
};

const emptyAsset = {
  name: '', code: '', type: 'equipo_mecanico', brand: '', model: '', serial_number: '',
  location_id: '', sede: '', area: '', jefe_sitio: '', status: 'operativo', criticality: 'media',
  location: '', purchase_cost: 0, purchase_date: '', warranty_expiry: '',
  last_maintenance: '', next_maintenance: '', maintenance_frequency_days: 90, notes: '',
};

export default function AssetFormDialog({ open, onOpenChange, editing, sedes }) {
  const [form, setForm] = useState(emptyAsset);
  const qc = useQueryClient();

  React.useEffect(() => {
    if (open) setForm(editing ? { ...emptyAsset, ...editing } : emptyAsset);
  }, [open, editing]);

  const saveMutation = useMutation({
    mutationFn: (data) => {
      const payload = { ...data };
      if (!payload.code) delete payload.code;
      return editing
        ? base44.entities.Asset.update(editing.id, payload)
        : base44.entities.Asset.create(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assets'] }); onOpenChange(false); },
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const onSedeChange = (value) => {
    if (value === '__none') {
      setForm(p => ({ ...p, location_id: '', sede: '' }));
    } else {
      const sede = sedes.find(s => s.id === value);
      setForm(p => ({ ...p, location_id: value, sede: sede?.nombre || '' }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{editing ? `Editar: ${editing.name}` : 'Nuevo Activo'}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="datos" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="flex-shrink-0">
            <TabsTrigger value="datos">Datos del Activo</TabsTrigger>
            {editing && <TabsTrigger value="historial">Historial OTs</TabsTrigger>}
          </TabsList>
          <TabsContent value="datos" className="flex-1 overflow-y-auto mt-3 pr-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs">Nombre *</Label>
                  <Input value={form.name} onChange={e => set('name', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Código</Label>
                  <Input value={form.code} onChange={e => set('code', e.target.value)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Sede (Ubicación del mapa)</Label>
                <Select value={form.location_id || '__none'} onValueChange={onSedeChange}>
                  <SelectTrigger><SelectValue placeholder="Sin sede" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— Sin sede —</SelectItem>
                    {sedes.map(s => <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Área / Zona</Label>
                <Input value={form.area} onChange={e => set('area', e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Tipo</Label>
                <Select value={form.type} onValueChange={v => set('type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Estado</Label>
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
              <div className="space-y-1.5">
                <Label className="text-xs">Criticidad</Label>
                <Select value={form.criticality} onValueChange={v => set('criticality', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baja">Baja</SelectItem><SelectItem value="media">Media</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem><SelectItem value="critica">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5"><Label className="text-xs">Jefe de Sitio</Label><Input value={form.jefe_sitio} onChange={e => set('jefe_sitio', e.target.value)} /></div>
              <div className="col-span-2 space-y-1.5"><Label className="text-xs">Ubicación detallada</Label><Input value={form.location} onChange={e => set('location', e.target.value)} /></div>

              <div className="space-y-1.5"><Label className="text-xs">Último Mant.</Label><Input type="date" value={form.last_maintenance || ''} onChange={e => set('last_maintenance', e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Próximo Mant.</Label><Input type="date" value={form.next_maintenance || ''} onChange={e => set('next_maintenance', e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Frecuencia (días)</Label><Input type="number" value={form.maintenance_frequency_days} onChange={e => set('maintenance_frequency_days', parseInt(e.target.value) || 90)} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Costo Adquisición</Label><Input type="number" value={form.purchase_cost} onChange={e => set('purchase_cost', parseFloat(e.target.value) || 0)} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Fecha Compra</Label><Input type="date" value={form.purchase_date || ''} onChange={e => set('purchase_date', e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Garantía hasta</Label><Input type="date" value={form.warranty_expiry || ''} onChange={e => set('warranty_expiry', e.target.value)} /></div>
              <div className="col-span-2 space-y-1.5"><Label className="text-xs">Notas</Label><Textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending || !form.name}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Guardar
              </Button>
            </DialogFooter>
          </TabsContent>
          {editing && (
            <TabsContent value="historial" className="flex-1 overflow-y-auto mt-3 px-1">
              <AssetHistory assetName={editing.name} />
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}