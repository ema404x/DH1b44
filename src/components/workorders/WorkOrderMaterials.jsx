import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, Plus, Trash2, AlertTriangle, CheckCircle2, X } from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

export default function WorkOrderMaterials({ materials = [], faltantes = [], onChangeMaterials, onChangeFaltantes, onChange }) {
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
    <div className="space-y-5">

      {/* ── Materiales planificados ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-3.5 w-3.5 text-indigo-400" />
            <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide">Materiales a usar</span>
            {materials.length > 0 && (
              <span className="text-[10px] bg-indigo-500/15 text-indigo-300 px-1.5 py-0.5 rounded-full font-bold">{materials.length}</span>
            )}
          </div>
          <button
            onClick={() => { setAddingPlan(true); setAddingFalt(false); }}
            className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 hover:border-indigo-400/50 rounded-lg px-2.5 py-1 transition-colors"
          >
            <Plus className="h-3 w-3" /> Agregar
          </button>
        </div>

        {/* Cards list */}
        <div className="space-y-2">
          {materials.map((m, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 border border-slate-700/40">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-100 truncate">{m.material_name}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {m.quantity} u.
                  {m.unit_cost > 0 && <> · {fmt(m.unit_cost)}/u · <span className="text-slate-400 font-semibold">{fmt(m.quantity * m.unit_cost)}</span></>}
                </p>
              </div>
              <button
                onClick={() => handleMaterials(materials.filter((_, i) => i !== idx))}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-colors flex-shrink-0 active:scale-90"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {total > 0 && (
            <div className="flex justify-between items-center px-3 py-2 rounded-xl bg-indigo-950/30 border border-indigo-800/30">
              <span className="text-xs text-slate-400">Total estimado</span>
              <span className="text-sm font-bold text-indigo-300">{fmt(total)}</span>
            </div>
          )}

          {materials.length === 0 && !addingPlan && (
            <p className="text-xs text-slate-600 text-center py-3">Sin materiales registrados</p>
          )}
        </div>

        {/* Add form */}
        {addingPlan && (
          <div className="rounded-xl border border-indigo-700/30 bg-indigo-950/20 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">Nuevo material</p>
              <button onClick={() => setAddingPlan(false)} className="text-slate-500 hover:text-slate-300">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {inventory.length > 0 && (
              <Select value={newItem.material_name} onValueChange={selectMaterialPlan}>
                <SelectTrigger className="h-10 text-xs bg-slate-800/80 border-slate-700/50 text-white">
                  <SelectValue placeholder="Del inventario..." />
                </SelectTrigger>
                <SelectContent>
                  {inventory.map(m => (
                    <SelectItem key={m.id} value={m.name} className="text-xs">
                      {m.name} — {m.stock} en stock — {fmt(m.unit_cost)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Input
              className="h-10 text-sm bg-slate-800/80 border-slate-700/50 text-white placeholder:text-slate-600"
              placeholder="O escribir nombre..."
              value={newItem.material_name}
              onChange={e => setNewItem(p => ({ ...p, material_name: e.target.value }))}
            />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] text-slate-500 mb-1">Cantidad</p>
                <Input type="number" min="0" className="h-10 text-sm bg-slate-800/80 border-slate-700/50 text-white"
                  value={newItem.quantity} onChange={e => setNewItem(p => ({ ...p, quantity: e.target.value }))} />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 mb-1">Costo unit. (opc.)</p>
                <Input type="number" min="0" className="h-10 text-sm bg-slate-800/80 border-slate-700/50 text-white"
                  value={newItem.unit_cost} onChange={e => setNewItem(p => ({ ...p, unit_cost: e.target.value }))} />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={addPlanned}
                disabled={!newItem.material_name}
                className="flex-1 h-10 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl transition-colors"
              >
                Agregar
              </button>
              <button
                onClick={() => setAddingPlan(false)}
                className="px-4 h-10 text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-xl transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* divider */}
      <div className="border-t border-slate-700/40" />

      {/* ── Materiales faltantes ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide">Faltantes</span>
            {faltantes.length > 0 && (
              <span className="text-[10px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded-full font-bold">{faltantes.length}</span>
            )}
          </div>
          <button
            onClick={() => { setAddingFalt(true); setAddingPlan(false); }}
            className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 border border-amber-600/30 hover:border-amber-500/50 rounded-lg px-2.5 py-1 transition-colors"
          >
            <Plus className="h-3 w-3" /> Reportar
          </button>
        </div>

        <p className="text-[11px] text-slate-600">Registrá materiales que te faltaron durante la tarea.</p>

        <div className="space-y-2">
          {faltantes.map((f, idx) => (
            <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-amber-950/20 border border-amber-700/30">
              <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-100">{f.material_name}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Faltó: {f.cantidad_faltante} u.
                  {f.motivo && <> · <span className="text-amber-300/70">{f.motivo}</span></>}
                </p>
              </div>
              <button
                onClick={() => handleFaltantes(faltantes.filter((_, i) => i !== idx))}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-colors flex-shrink-0 active:scale-90"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {faltantes.length === 0 && !addingFalt && (
            <p className="text-xs text-slate-600 text-center py-2">Sin faltantes reportados ✓</p>
          )}
        </div>

        {addingFalt && (
          <div className="rounded-xl border border-amber-700/30 bg-amber-950/15 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider">¿Qué te faltó?</p>
              <button onClick={() => setAddingFalt(false)} className="text-slate-500 hover:text-slate-300">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <Input
              className="h-10 text-sm bg-slate-800/80 border-slate-700/50 text-white placeholder:text-slate-600"
              placeholder="Nombre del material..."
              value={newFalt.material_name}
              onChange={e => setNewFalt(p => ({ ...p, material_name: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] text-slate-500 mb-1">Cantidad</p>
                <Input type="number" min="0" className="h-10 text-sm bg-slate-800/80 border-slate-700/50 text-white"
                  value={newFalt.cantidad_faltante} onChange={e => setNewFalt(p => ({ ...p, cantidad_faltante: e.target.value }))} />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 mb-1">Motivo (opc.)</p>
                <Input className="h-10 text-sm bg-slate-800/80 border-slate-700/50 text-white placeholder:text-slate-600"
                  placeholder="¿Por qué?"
                  value={newFalt.motivo} onChange={e => setNewFalt(p => ({ ...p, motivo: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={addFaltante}
                disabled={!newFalt.material_name}
                className="flex-1 h-10 text-sm font-semibold bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded-xl transition-colors"
              >
                Reportar
              </button>
              <button
                onClick={() => setAddingFalt(false)}
                className="px-4 h-10 text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-xl transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}