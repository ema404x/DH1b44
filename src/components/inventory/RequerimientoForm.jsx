import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2, Loader2, Package } from 'lucide-react';

const unitLabels = {
  unidad: 'Unidad', metro: 'Metro', metro2: 'm²', metro3: 'm³',
  kg: 'Kg', litro: 'Litro', bolsa: 'Bolsa', caja: 'Caja',
};

export default function RequerimientoForm({ open, onOpenChange, onSave, saving, initialData, user }) {
  const [form, setForm] = useState({
    titulo: '',
    jefe_sitio: '',
    jefe_sitio_email: '',
    establecimiento: '',
    prioridad: 'normal',
    fecha_necesidad: '',
    observaciones: '',
    items: [],
  });
  const [itemSearch, setItemSearch] = useState('');
  const [showMaterialPicker, setShowMaterialPicker] = useState(false);

  const { data: materials = [] } = useQuery({
    queryKey: ['materials'],
    queryFn: () => base44.entities.Material.list('name'),
  });

  useEffect(() => {
    if (open) {
      if (initialData) {
        setForm({ ...initialData });
      } else {
        setForm({
          titulo: '',
          jefe_sitio: user?.full_name || '',
          jefe_sitio_email: user?.email || '',
          establecimiento: '',
          prioridad: 'normal',
          fecha_necesidad: '',
          observaciones: '',
          items: [],
        });
      }
    }
  }, [open, initialData, user]);

  const addMaterial = (mat) => {
    const exists = form.items.find(i => i.material_id === mat.id);
    if (exists) return;
    setForm(prev => ({
      ...prev,
      items: [...prev.items, {
        material_id: mat.id,
        material_nombre: mat.name,
        material_codigo: mat.code || '',
        unidad: mat.unit || 'unidad',
        cantidad_solicitada: 1,
        costo_estimado: mat.unit_cost || 0,
        notas_item: '',
      }]
    }));
    setShowMaterialPicker(false);
    setItemSearch('');
  };

  const updateItem = (idx, field, value) => {
    setForm(prev => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...prev, items };
    });
  };

  const removeItem = (idx) => {
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  };

  const totalEstimado = form.items.reduce((sum, i) => sum + (i.cantidad_solicitada || 0) * (i.costo_estimado || 0), 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...form, total_estimado: totalEstimado });
  };

  const filteredMaterials = materials.filter(m =>
    m.name?.toLowerCase().includes(itemSearch.toLowerCase()) ||
    m.code?.toLowerCase().includes(itemSearch.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">{initialData ? 'Editar Requerimiento' : 'Nuevo Requerimiento de Compra'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Datos básicos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-slate-300">Título *</Label>
              <Input value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
                placeholder="Ej: Materiales eléctricos Escuela Nº5"
                className="bg-slate-800 border-slate-600 text-white" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Jefe de Sitio *</Label>
              <Input value={form.jefe_sitio} onChange={e => setForm(p => ({ ...p, jefe_sitio: e.target.value }))}
                className="bg-slate-800 border-slate-600 text-white" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Establecimiento</Label>
              <Input value={form.establecimiento} onChange={e => setForm(p => ({ ...p, establecimiento: e.target.value }))}
                placeholder="Escuela / dirección"
                className="bg-slate-800 border-slate-600 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Prioridad</Label>
              <Select value={form.prioridad} onValueChange={v => setForm(p => ({ ...p, prioridad: v }))}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baja">Baja</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Fecha necesidad</Label>
              <Input type="date" value={form.fecha_necesidad} onChange={e => setForm(p => ({ ...p, fecha_necesidad: e.target.value }))}
                className="bg-slate-800 border-slate-600 text-white" />
            </div>
          </div>

          {/* Materiales */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-slate-300">Materiales solicitados</Label>
              <Button type="button" size="sm" variant="outline"
                className="gap-1.5 border-slate-600 text-slate-300 hover:text-white"
                onClick={() => setShowMaterialPicker(!showMaterialPicker)}>
                <Plus className="h-3.5 w-3.5" /> Agregar material
              </Button>
            </div>

            {showMaterialPicker && (
              <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3 space-y-2">
                <Input value={itemSearch} onChange={e => setItemSearch(e.target.value)}
                  placeholder="Buscar material por nombre o código..."
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500" />
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {filteredMaterials.length === 0 && <p className="text-slate-500 text-sm text-center py-2">Sin resultados</p>}
                  {filteredMaterials.map(mat => (
                    <button key={mat.id} type="button" onClick={() => addMaterial(mat)}
                      className="w-full text-left flex items-center gap-3 px-3 py-2 rounded hover:bg-slate-700 transition-colors">
                      <Package className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                      <span className="text-sm text-white">{mat.name}</span>
                      {mat.code && <span className="text-xs text-slate-500 font-mono">{mat.code}</span>}
                      <span className="ml-auto text-xs text-slate-400">{unitLabels[mat.unit] || mat.unit}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {form.items.length === 0 && (
              <p className="text-slate-500 text-sm text-center py-4 border border-dashed border-slate-700 rounded-lg">
                Agregá materiales al requerimiento
              </p>
            )}

            {form.items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-start p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <div className="col-span-12 sm:col-span-4">
                  <p className="text-sm font-medium text-white">{item.material_nombre}</p>
                  {item.material_codigo && <p className="text-xs text-slate-500 font-mono">{item.material_codigo}</p>}
                </div>
                <div className="col-span-6 sm:col-span-2 space-y-1">
                  <Label className="text-xs text-slate-400">Cantidad</Label>
                  <Input type="number" min="0.01" step="0.01"
                    value={item.cantidad_solicitada}
                    onChange={e => updateItem(idx, 'cantidad_solicitada', parseFloat(e.target.value) || 0)}
                    className="bg-slate-700 border-slate-600 text-white h-8 text-sm" />
                </div>
                <div className="col-span-6 sm:col-span-2 space-y-1">
                  <Label className="text-xs text-slate-400">Unidad</Label>
                  <Select value={item.unidad} onValueChange={v => updateItem(idx, 'unidad', v)}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(unitLabels).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-10 sm:col-span-3 space-y-1">
                  <Label className="text-xs text-slate-400">Nota</Label>
                  <Input value={item.notas_item || ''} onChange={e => updateItem(idx, 'notas_item', e.target.value)}
                    placeholder="Opcional..."
                    className="bg-slate-700 border-slate-600 text-white h-8 text-sm" />
                </div>
                <div className="col-span-2 sm:col-span-1 pt-5 flex justify-end">
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:bg-red-500/10"
                    onClick={() => removeItem(idx)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}

            {form.items.length > 0 && (
              <div className="flex justify-end">
                <p className="text-sm text-slate-400">Total estimado: <span className="font-bold text-white">${totalEstimado.toLocaleString()}</span></p>
              </div>
            )}
          </div>

          {/* Observaciones */}
          <div className="space-y-1.5">
            <Label className="text-slate-300">Observaciones</Label>
            <Textarea value={form.observaciones} onChange={e => setForm(p => ({ ...p, observaciones: e.target.value }))}
              placeholder="Notas adicionales para el sector de compras..."
              className="bg-slate-800 border-slate-600 text-white" rows={3} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" className="text-slate-400" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving || form.items.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {initialData ? 'Guardar cambios' : 'Enviar requerimiento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}