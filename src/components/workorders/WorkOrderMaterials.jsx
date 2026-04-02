import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, Plus, Trash2 } from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

export default function WorkOrderMaterials({ materials = [], onChange }) {
  const [adding, setAdding] = useState(false);
  const [newItem, setNewItem] = useState({ material_name: '', quantity: 1, unit_cost: 0 });

  const { data: inventory = [] } = useQuery({
    queryKey: ['materials'],
    queryFn: () => base44.entities.Material.list(),
  });

  const total = materials.reduce((s, m) => s + (m.quantity * m.unit_cost || 0), 0);

  const selectMaterial = (name) => {
    const found = inventory.find(m => m.name === name);
    setNewItem({ material_name: name, quantity: 1, unit_cost: found?.unit_cost || 0 });
  };

  const add = () => {
    if (!newItem.material_name) return;
    onChange([...materials, { ...newItem, quantity: parseFloat(newItem.quantity) || 1, unit_cost: parseFloat(newItem.unit_cost) || 0 }]);
    setNewItem({ material_name: '', quantity: 1, unit_cost: 0 });
    setAdding(false);
  };

  const remove = (idx) => onChange(materials.filter((_, i) => i !== idx));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Materiales Utilizados</span>
          {materials.length > 0 && <span className="text-xs text-muted-foreground">({materials.length})</span>}
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5" /> Agregar
        </Button>
      </div>

      {materials.length > 0 && (
        <div className="space-y-1.5">
          {materials.map((m, idx) => (
            <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 text-xs">
              <Package className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="flex-1 font-medium">{m.material_name}</span>
              <span className="text-muted-foreground">{m.quantity} u.</span>
              <span className="text-muted-foreground w-20 text-right">{fmt(m.unit_cost)}/u</span>
              <span className="font-semibold w-20 text-right">{fmt(m.quantity * m.unit_cost)}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive flex-shrink-0" onClick={() => remove(idx)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <div className="flex justify-end pt-1">
            <span className="text-sm font-bold text-primary">Total materiales: {fmt(total)}</span>
          </div>
        </div>
      )}

      {adding && (
        <div className="border border-border rounded-lg p-3 space-y-2 bg-muted/20">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Nuevo material</p>
          <Select value={newItem.material_name} onValueChange={selectMaterial}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar del inventario..." /></SelectTrigger>
            <SelectContent>
              {inventory.map(m => (
                <SelectItem key={m.id} value={m.name} className="text-xs">
                  {m.name} — Stock: {m.stock} — {fmt(m.unit_cost)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="h-8 text-xs"
            placeholder="O escribir nombre manualmente"
            value={newItem.material_name}
            onChange={e => setNewItem(p => ({ ...p, material_name: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Cantidad</p>
              <Input type="number" className="h-8 text-xs" value={newItem.quantity} onChange={e => setNewItem(p => ({ ...p, quantity: e.target.value }))} />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Costo unitario ($)</p>
              <Input type="number" className="h-8 text-xs" value={newItem.unit_cost} onChange={e => setNewItem(p => ({ ...p, unit_cost: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 h-7 text-xs" onClick={add} disabled={!newItem.material_name}>Agregar</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAdding(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {materials.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground text-center py-2">Sin materiales registrados</p>
      )}
    </div>
  );
}