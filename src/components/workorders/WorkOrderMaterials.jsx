import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, Plus, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

export default function WorkOrderMaterials({ materials = [], faltantes = [], onChangeMaterials, onChangeFaltantes, onChange }) {
  // Compatibilidad con uso antiguo (solo onChange)
  const handleMaterials = onChangeMaterials || onChange;
  const handleFaltantes = onChangeFaltantes || (() => {});

  const [addingPlan, setAddingPlan] = useState(false);
  const [addingFalt, setAddingFalt] = useState(false);
  const [newItem, setNewItem] = useState({ material_name: '', quantity: 1, unit_cost: 0 });
  const [newFalt, setNewFalt] = useState({ material_name: '', cantidad_faltante: 1, motivo: '' });

  const { data: inventory = [] } = useQuery({
    queryKey: ['materials'],
    queryFn: () => base44.entities.Material.list(),
  });

  const total = materials.reduce((s, m) => s + ((m.quantity || 0) * (m.unit_cost || 0)), 0);

  const addPlanned = () => {
    if (!newItem.material_name) return;
    handleMaterials([...materials, {
      ...newItem,
      quantity: parseFloat(newItem.quantity) || 1,
      unit_cost: parseFloat(newItem.unit_cost) || 0,
    }]);
    setNewItem({ material_name: '', quantity: 1, unit_cost: 0 });
    setAddingPlan(false);
  };

  const addFaltante = () => {
    if (!newFalt.material_name) return;
    handleFaltantes([...faltantes, {
      ...newFalt,
      cantidad_faltante: parseFloat(newFalt.cantidad_faltante) || 1,
    }]);
    setNewFalt({ material_name: '', cantidad_faltante: 1, motivo: '' });
    setAddingFalt(false);
  };

  const selectMaterialPlan = (name) => {
    const found = inventory.find(m => m.name === name);
    setNewItem(p => ({ ...p, material_name: name, unit_cost: found?.unit_cost || 0 }));
  };

  return (
    <div className="space-y-6">

      {/* ── Materiales planificados */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Materiales a Utilizar</span>
            {materials.length > 0 && <span className="text-xs text-muted-foreground">({materials.length})</span>}
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setAddingPlan(true)}>
            <Plus className="h-3.5 w-3.5" /> Agregar
          </Button>
        </div>

        {materials.length > 0 && (
          <div className="space-y-1.5">
            {materials.map((m, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/40 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                <span className="flex-1 font-medium">{m.material_name}</span>
                <span className="text-muted-foreground">{m.quantity} u.</span>
                {m.unit_cost > 0 && <span className="text-muted-foreground w-20 text-right">{fmt(m.unit_cost)}/u</span>}
                {m.unit_cost > 0 && <span className="font-semibold w-20 text-right">{fmt(m.quantity * m.unit_cost)}</span>}
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive flex-shrink-0"
                  onClick={() => handleMaterials(materials.filter((_, i) => i !== idx))}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {total > 0 && (
              <div className="flex justify-end pt-1">
                <span className="text-sm font-bold text-primary">Total estimado: {fmt(total)}</span>
              </div>
            )}
          </div>
        )}

        {addingPlan && (
          <div className="border border-border rounded-xl p-3 space-y-2 bg-muted/20">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Nuevo material</p>
            {inventory.length > 0 && (
              <Select value={newItem.material_name} onValueChange={selectMaterialPlan}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar del inventario..." /></SelectTrigger>
                <SelectContent>
                  {inventory.map(m => (
                    <SelectItem key={m.id} value={m.name} className="text-xs">
                      {m.name} — Stock: {m.stock} — {fmt(m.unit_cost)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Input
              className="h-8 text-xs"
              placeholder="Escribir nombre del material..."
              value={newItem.material_name}
              onChange={e => setNewItem(p => ({ ...p, material_name: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Cantidad</p>
                <Input type="number" min="0" className="h-8 text-xs" value={newItem.quantity}
                  onChange={e => setNewItem(p => ({ ...p, quantity: e.target.value }))} />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Costo unitario (opcional)</p>
                <Input type="number" min="0" className="h-8 text-xs" value={newItem.unit_cost}
                  onChange={e => setNewItem(p => ({ ...p, unit_cost: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 h-7 text-xs" onClick={addPlanned} disabled={!newItem.material_name}>Agregar</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAddingPlan(false)}>Cancelar</Button>
            </div>
          </div>
        )}

        {materials.length === 0 && !addingPlan && (
          <p className="text-xs text-muted-foreground text-center py-2">Sin materiales registrados</p>
        )}
      </div>

      <hr className="border-border" />

      {/* ── Materiales faltantes (operario) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-semibold">Materiales que Faltaron</span>
            {faltantes.length > 0 && (
              <span className="text-xs bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full font-semibold">
                {faltantes.length} ítem{faltantes.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-amber-400 hover:text-amber-300"
            onClick={() => setAddingFalt(true)}>
            <Plus className="h-3.5 w-3.5" /> Reportar faltante
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Si te faltó algún material durante el trabajo, registralo acá para que el supervisor lo sepa.
        </p>

        {faltantes.length > 0 && (
          <div className="space-y-1.5">
            {faltantes.map((f, idx) => (
              <div key={idx} className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-medium">{f.material_name}</span>
                  <span className="text-muted-foreground ml-2">— {f.cantidad_faltante} u.</span>
                  {f.motivo && <p className="text-muted-foreground mt-0.5">{f.motivo}</p>}
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive flex-shrink-0"
                  onClick={() => handleFaltantes(faltantes.filter((_, i) => i !== idx))}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {addingFalt && (
          <div className="border border-amber-500/30 rounded-xl p-3 space-y-2 bg-amber-500/5">
            <p className="text-xs font-semibold text-amber-400 uppercase">¿Qué te faltó?</p>
            <Input
              className="h-8 text-xs"
              placeholder="Nombre del material que faltó..."
              value={newFalt.material_name}
              onChange={e => setNewFalt(p => ({ ...p, material_name: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">¿Cuánto faltó?</p>
                <Input type="number" min="0" className="h-8 text-xs" value={newFalt.cantidad_faltante}
                  onChange={e => setNewFalt(p => ({ ...p, cantidad_faltante: e.target.value }))} />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">¿Por qué no lo había?</p>
                <Input className="h-8 text-xs" placeholder="Motivo (opcional)"
                  value={newFalt.motivo}
                  onChange={e => setNewFalt(p => ({ ...p, motivo: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 h-7 text-xs bg-amber-600 hover:bg-amber-700" onClick={addFaltante} disabled={!newFalt.material_name}>Reportar</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAddingFalt(false)}>Cancelar</Button>
            </div>
          </div>
        )}

        {faltantes.length === 0 && !addingFalt && (
          <p className="text-xs text-muted-foreground text-center py-1">Sin materiales faltantes reportados ✓</p>
        )}
      </div>
    </div>
  );
}