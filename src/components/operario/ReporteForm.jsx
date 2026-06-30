import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Loader2, Package, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function ReporteForm({ ot, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [material, setMaterial] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [faltantes, setFaltantes] = useState([]);
  const [faltanteNombre, setFaltanteNombre] = useState('');
  const [faltanteCant, setFaltanteCant] = useState(1);
  const [faltanteMotivo, setFaltanteMotivo] = useState('');
  const [notas, setNotas] = useState(ot.notes || '');

  // Materiales usados locales (partiendo de los que ya tenía la OT)
  const [usados, setUsados] = useState(ot.materials_used || []);

  const addUsado = () => {
    if (!material.trim()) return;
    setUsados(prev => [...prev, { material_name: material.trim(), quantity: Number(cantidad), unit_cost: 0 }]);
    setMaterial('');
    setCantidad(1);
  };

  const removeUsado = (idx) => setUsados(prev => prev.filter((_, i) => i !== idx));

  const addFaltante = () => {
    if (!faltanteNombre.trim()) return;
    setFaltantes(prev => [...prev, { material_name: faltanteNombre.trim(), cantidad_faltante: Number(faltanteCant), motivo: faltanteMotivo.trim() }]);
    setFaltanteNombre('');
    setFaltanteCant(1);
    setFaltanteMotivo('');
  };

  const removeFaltante = (idx) => setFaltantes(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await base44.entities.WorkOrder.update(ot.id, {
        notes: notas,
        materials_used: usados,
        materiales_faltantes: [...(ot.materiales_faltantes || []), ...faltantes],
      });
      toast.success('Reporte guardado');
      onSaved();
    } catch (err) {
      toast.error('Error: ' + (err.message || 'intente nuevamente'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-lg max-h-[92vh] flex flex-col bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h2 className="text-base font-bold text-white">Reporte de Materiales</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="px-4 pt-3 text-xs text-slate-400 truncate">{ot.title}</p>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">

          {/* Materiales usados */}
          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-1.5 mb-2">
              <Package className="h-3.5 w-3.5 text-blue-400" /> Materiales Usados
            </label>
            {usados.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {usados.map((m, i) => (
                  <div key={i} className="flex items-center gap-2 bg-slate-800/50 rounded-lg p-2.5">
                    <span className="flex-1 text-sm text-slate-200">{m.material_name}</span>
                    <span className="text-xs text-slate-400 tabular-nums">{m.quantity}u</span>
                    <button type="button" onClick={() => removeUsado(i)} className="text-slate-500 hover:text-red-400">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={material}
                onChange={e => setMaterial(e.target.value)}
                placeholder="Nombre del material"
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <input
                type="number"
                min={1}
                value={cantidad}
                onChange={e => setCantidad(e.target.value)}
                className="w-16 bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-sm text-white text-center focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={addUsado}
                className="px-3 rounded-lg bg-slate-700 text-slate-200 text-sm font-medium hover:bg-slate-600"
              >
                +
              </button>
            </div>
          </div>

          {/* Materiales faltantes */}
          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-1.5 mb-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" /> Materiales Faltantes
            </label>
            {faltantes.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {faltantes.map((m, i) => (
                  <div key={i} className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-amber-200">{m.material_name}</p>
                      {m.motivo && <p className="text-xs text-amber-400/70 truncate">{m.motivo}</p>}
                    </div>
                    <span className="text-xs text-amber-400 tabular-nums">{m.cantidad_faltante}u</span>
                    <button type="button" onClick={() => removeFaltante(i)} className="text-slate-500 hover:text-red-400">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  value={faltanteNombre}
                  onChange={e => setFaltanteNombre(e.target.value)}
                  placeholder="Material faltante"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  type="number"
                  min={1}
                  value={faltanteCant}
                  onChange={e => setFaltanteCant(e.target.value)}
                  className="w-16 bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-sm text-white text-center focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <input
                value={faltanteMotivo}
                onChange={e => setFaltanteMotivo(e.target.value)}
                placeholder="Motivo (opcional)"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={addFaltante}
                className="w-full h-8 rounded-lg border border-dashed border-slate-600 text-slate-400 text-xs font-medium hover:bg-slate-800 hover:text-slate-200 transition-colors"
              >
                + Agregar faltante
              </button>
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-2 block">Observaciones</label>
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              rows={2}
              placeholder="Notas del trabajo..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800">
          <button
            type="submit"
            disabled={saving}
            className="w-full h-10 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar Reporte'}
          </button>
        </div>
      </form>
    </div>
  );
}