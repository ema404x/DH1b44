import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Plus, Trash2, Loader2, CheckCircle, Package, AlertTriangle, MapPin, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const STATUS_TRANSITIONS = {
  pendiente:   [{ value: 'en_progreso', label: '▶ Iniciar OT' }],
  asignada:    [{ value: 'en_progreso', label: '▶ Iniciar OT' }],
  en_progreso: [{ value: 'completada',  label: '✓ Marcar Completada' }],
};

export default function OTEjecucionModal({ ot, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState(ot.notes || '');
  const [checklist, setChecklist] = useState(ot.checklist || []);
  const [materialesUsados, setMaterialesUsados] = useState(ot.materials_used || []);
  const [materialesFaltantes, setMaterialesFaltantes] = useState(ot.materiales_faltantes || []);
  const [nuevoFaltante, setNuevoFaltante] = useState({ material_name: '', cantidad_faltante: 1, motivo: '' });

  // Checklist toggle
  const toggleCheck = (idx) => {
    setChecklist(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], completed: !next[idx].completed };
      return next;
    });
  };

  // Materiales usados
  const updateMaterial = (idx, field, value) => {
    setMaterialesUsados(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: field === 'quantity' || field === 'unit_cost' ? Number(value) : value };
      return next;
    });
  };

  // Materiales faltantes
  const addFaltante = () => {
    if (!nuevoFaltante.material_name.trim()) return;
    setMaterialesFaltantes(prev => [...prev, { ...nuevoFaltante }]);
    setNuevoFaltante({ material_name: '', cantidad_faltante: 1, motivo: '' });
  };

  const removeFaltante = (idx) => {
    setMaterialesFaltantes(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async (newStatus) => {
    setSaving(true);
    try {
      const payload = {
        notes,
        checklist,
        materials_used: materialesUsados,
        materiales_faltantes: materialesFaltantes,
      };
      if (newStatus) {
        payload.status = newStatus;
        if (newStatus === 'completada') payload.completed_date = new Date().toISOString().split('T')[0];
        if (newStatus === 'en_progreso' && !ot.scheduled_date) payload.scheduled_date = new Date().toISOString().split('T')[0];
      }
      await base44.entities.WorkOrder.update(ot.id, payload);
      toast.success(newStatus ? `OT ${newStatus === 'en_progreso' ? 'iniciada' : 'completada'}` : 'Cambios guardados');
      onSaved();
    } catch (err) {
      toast.error('Error al guardar: ' + (err.message || 'intente nuevamente'));
    } finally {
      setSaving(false);
    }
  };

  const transitions = STATUS_TRANSITIONS[ot.status] || [];
  const checkDone  = checklist.filter(c => c.completed).length;
  const checkTotal = checklist.length;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-4 border-b border-slate-800">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-white truncate">{ot.title}</h2>
            {ot.location && (
              <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                <MapPin className="h-3 w-3" />
                <span className="truncate">{ot.location}</span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors flex-shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">

          {/* Descripción */}
          {ot.description && (
            <div className="bg-slate-800/50 rounded-lg p-3">
              <p className="text-xs text-slate-400 mb-1 flex items-center gap-1"><FileText className="h-3 w-3" /> Descripción</p>
              <p className="text-sm text-slate-200 whitespace-pre-wrap">{ot.description}</p>
            </div>
          )}

          {/* Checklist */}
          {checklist.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> Checklist
                </p>
                <span className="text-xs text-slate-500">{checkDone}/{checkTotal}</span>
              </div>
              <div className="space-y-1.5">
                {checklist.map((item, idx) => (
                  <button
                    key={item.id || idx}
                    onClick={() => toggleCheck(idx)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all ${
                      item.completed ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-slate-800/50 border border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      item.completed ? 'border-emerald-400 bg-emerald-400' : 'border-slate-600'
                    }`}>
                      {item.completed && <CheckCircle className="h-3 w-3 text-white" />}
                    </div>
                    <span className={`text-sm ${item.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                      {item.task}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Materiales usados */}
          {materialesUsados.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-blue-400" /> Materiales Utilizados
              </p>
              <div className="space-y-2">
                {materialesUsados.map((mat, idx) => (
                  <div key={idx} className="bg-slate-800/50 rounded-lg p-3 flex items-center gap-3">
                    <span className="flex-1 text-sm text-slate-200">{mat.material_name}</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        value={mat.quantity}
                        onChange={e => updateMaterial(idx, 'quantity', e.target.value)}
                        className="w-16 bg-slate-700 border border-slate-600 rounded-md px-2 py-1 text-sm text-white text-center"
                      />
                      <span className="text-xs text-slate-500">unid.</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Materiales faltantes */}
          <div>
            <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" /> Materiales Faltantes
            </p>
            {materialesFaltantes.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {materialesFaltantes.map((mat, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-amber-200">{mat.material_name}</p>
                      {mat.motivo && <p className="text-xs text-amber-400/70 truncate">{mat.motivo}</p>}
                    </div>
                    <span className="text-xs text-amber-400 font-mono">{mat.cantidad_faltante} u.</span>
                    <button onClick={() => removeFaltante(idx)} className="text-slate-500 hover:text-red-400 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {/* Agregar faltante */}
            <div className="bg-slate-800/50 rounded-lg p-3 space-y-2">
              <p className="text-xs text-slate-400">Reportar material faltante:</p>
              <div className="flex gap-2">
                <input
                  value={nuevoFaltante.material_name}
                  onChange={e => setNuevoFaltante(p => ({ ...p, material_name: e.target.value }))}
                  placeholder="Nombre del material"
                  className="flex-1 bg-slate-700 border border-slate-600 rounded-md px-2.5 py-1.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  type="number"
                  min={1}
                  value={nuevoFaltante.cantidad_faltante}
                  onChange={e => setNuevoFaltante(p => ({ ...p, cantidad_faltante: Number(e.target.value) }))}
                  className="w-16 bg-slate-700 border border-slate-600 rounded-md px-2 py-1.5 text-sm text-white text-center"
                />
              </div>
              <input
                value={nuevoFaltante.motivo}
                onChange={e => setNuevoFaltante(p => ({ ...p, motivo: e.target.value }))}
                placeholder="Motivo (opcional)"
                className="w-full bg-slate-700 border border-slate-600 rounded-md px-2.5 py-1.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Button onClick={addFaltante} size="sm" variant="outline" className="w-full text-xs h-7 gap-1">
                <Plus className="h-3 w-3" /> Agregar
              </Button>
            </div>
          </div>

          {/* Notas */}
          <div>
            <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-2">Observaciones</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Observaciones del trabajo realizado..."
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center gap-2">
          <Button
            onClick={() => handleSave(null)}
            variant="outline"
            className="flex-1 text-sm"
            disabled={saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
          </Button>
          {transitions.map(t => (
            <Button
              key={t.value}
              onClick={() => handleSave(t.value)}
              className={`flex-1 text-sm font-semibold ${t.value === 'completada' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-primary hover:bg-primary/90'}`}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}