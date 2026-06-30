import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Plus, Trash2, Loader2, CheckCircle, Package, AlertTriangle, MapPin, FileText, Wrench, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const STATUS_TRANSITIONS = {
  pendiente:   [{ value: 'en_progreso', label: 'Iniciar OT',   icon: Wrench,     variant: 'primary' }],
  asignada:    [{ value: 'en_progreso', label: 'Iniciar OT',   icon: Wrench,     variant: 'primary' }],
  en_progreso: [{ value: 'completada',  label: 'Completar OT', icon: CheckCircle,variant: 'success' }],
};

const TYPE_LABELS = {
  mantenimiento_preventivo: 'Mantenimiento Preventivo',
  mantenimiento_correctivo: 'Mantenimiento Correctivo',
  instalacion: 'Instalación',
  inspeccion: 'Inspección',
  reparacion: 'Reparación',
  emergencia: 'Emergencia',
};

const PRIORITY_CONFIG = {
  baja:    { label: 'Baja',    color: 'text-slate-400',  bg: 'bg-slate-500/10' },
  media:   { label: 'Media',   color: 'text-blue-400',   bg: 'bg-blue-500/10' },
  alta:    { label: 'Alta',    color: 'text-amber-400',  bg: 'bg-amber-500/10' },
  urgente: { label: 'Urgente', color: 'text-red-400',    bg: 'bg-red-500/10' },
};

export default function OTEjecucionModal({ ot, onClose, onSaved }) {
  const [saving, setSaving] = useState(null);
  const [notes, setNotes] = useState(ot.notes || '');
  const [checklist, setChecklist] = useState(ot.checklist || []);
  const [materialesUsados, setMaterialesUsados] = useState(ot.materials_used || []);
  const [materialesFaltantes, setMaterialesFaltantes] = useState(ot.materiales_faltantes || []);
  const [nuevoFaltante, setNuevoFaltante] = useState({ material_name: '', cantidad_faltante: 1, motivo: '' });

  const toggleCheck = (idx) => {
    setChecklist(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], completed: !next[idx].completed };
      return next;
    });
  };

  const updateMaterial = (idx, field, value) => {
    setMaterialesUsados(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: field === 'quantity' || field === 'unit_cost' ? Number(value) : value };
      return next;
    });
  };

  const addFaltante = () => {
    if (!nuevoFaltante.material_name.trim()) return;
    setMaterialesFaltantes(prev => [...prev, { ...nuevoFaltante }]);
    setNuevoFaltante({ material_name: '', cantidad_faltante: 1, motivo: '' });
  };

  const removeFaltante = (idx) => {
    setMaterialesFaltantes(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async (newStatus) => {
    setSaving(newStatus || 'save');
    try {
      const payload = { notes, checklist, materials_used: materialesUsados, materiales_faltantes: materialesFaltantes };
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
      setSaving(null);
    }
  };

  const transitions = STATUS_TRANSITIONS[ot.status] || [];
  const checkDone = checklist.filter(c => c.completed).length;
  const checkTotal = checklist.length;
  const checkPct = checkTotal > 0 ? Math.round((checkDone / checkTotal) * 100) : 0;
  const prio = PRIORITY_CONFIG[ot.priority] || PRIORITY_CONFIG.media;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">

        {/* Header con gradiente */}
        <div className="relative p-5 border-b border-slate-800"
          style={{ background: 'linear-gradient(135deg, rgba(30,58,95,0.4) 0%, rgba(15,30,50,0.3) 100%)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${prio.bg} ${prio.color} ring-1 ring-white/10`}>
                  {prio.label}
                </span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">
                  {TYPE_LABELS[ot.type] || ot.type?.replace(/_/g, ' ')}
                </span>
              </div>
              <h2 className="text-lg font-bold text-white leading-tight">{ot.title}</h2>
              {ot.location && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1.5">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">{ot.location}</span>
                </div>
              )}
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors flex-shrink-0 p-1.5 rounded-lg hover:bg-white/5">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">

          {/* Descripción */}
          {ot.description && (
            <Section icon={FileText} title="Descripción" color="slate">
              <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{ot.description}</p>
            </Section>
          )}

          {/* Checklist */}
          {checklist.length > 0 && (
            <Section icon={CheckCircle} title="Checklist" color="emerald" badge={`${checkDone}/${checkTotal}`}>
              {/* Progress bar */}
              <div className="mb-3 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${checkPct}%` }} />
              </div>
              <div className="space-y-1.5">
                {checklist.map((item, idx) => (
                  <button
                    key={item.id || idx}
                    onClick={() => toggleCheck(idx)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all duration-200 ${
                      item.completed
                        ? 'bg-emerald-500/10 border border-emerald-500/25'
                        : 'bg-slate-800/50 border border-slate-700/60 hover:border-slate-600 hover:bg-slate-800'
                    }`}
                  >
                    <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      item.completed ? 'border-emerald-400 bg-emerald-400 scale-100' : 'border-slate-600 scale-90'
                    }`}>
                      {item.completed && <CheckCircle className="h-3.5 w-3.5 text-slate-900" strokeWidth={3} />}
                    </div>
                    <span className={`text-sm transition-all ${item.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                      {item.task}
                    </span>
                  </button>
                ))}
              </div>
            </Section>
          )}

          {/* Materiales usados */}
          {materialesUsados.length > 0 && (
            <Section icon={Package} title="Materiales Utilizados" color="blue">
              <div className="space-y-2">
                {materialesUsados.map((mat, idx) => (
                  <div key={idx} className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-3 flex items-center gap-3">
                    <span className="flex-1 text-sm text-slate-200 font-medium">{mat.material_name}</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        value={mat.quantity}
                        onChange={e => updateMaterial(idx, 'quantity', e.target.value)}
                        className="w-16 bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      <span className="text-xs text-slate-500">unid.</span>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Materiales faltantes */}
          <Section icon={AlertTriangle} title="Materiales Faltantes" color="amber">
            {materialesFaltantes.length > 0 && (
              <div className="space-y-2 mb-3">
                {materialesFaltantes.map((mat, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/25 rounded-xl p-3">
                    <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-amber-200">{mat.material_name}</p>
                      {mat.motivo && <p className="text-xs text-amber-400/70 truncate mt-0.5">{mat.motivo}</p>}
                    </div>
                    <span className="text-xs text-amber-400 font-mono font-bold">{mat.cantidad_faltante}u</span>
                    <button onClick={() => removeFaltante(idx)} className="text-slate-500 hover:text-red-400 transition-colors p-1 rounded hover:bg-red-500/10">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3 space-y-2">
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <Plus className="h-3 w-3" /> Reportar material faltante
              </p>
              <div className="flex gap-2">
                <input
                  value={nuevoFaltante.material_name}
                  onChange={e => setNuevoFaltante(p => ({ ...p, material_name: e.target.value }))}
                  placeholder="Nombre del material"
                  className="flex-1 bg-slate-700/80 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <input
                  type="number"
                  min={1}
                  value={nuevoFaltante.cantidad_faltante}
                  onChange={e => setNuevoFaltante(p => ({ ...p, cantidad_faltante: Number(e.target.value) }))}
                  className="w-16 bg-slate-700/80 border border-slate-600 rounded-lg px-2 py-2 text-sm text-white text-center focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <input
                value={nuevoFaltante.motivo}
                onChange={e => setNuevoFaltante(p => ({ ...p, motivo: e.target.value }))}
                placeholder="Motivo (opcional)"
                className="w-full bg-slate-700/80 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <Button onClick={addFaltante} size="sm" variant="outline" className="w-full text-xs h-8 gap-1 border-dashed">
                <Plus className="h-3.5 w-3.5" /> Agregar faltante
              </Button>
            </div>
          </Section>

          {/* Notas */}
          <Section icon={FileText} title="Observaciones" color="slate">
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Observaciones del trabajo realizado..."
              className="w-full bg-slate-800/50 border border-slate-700/60 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
          </Section>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center gap-2 bg-slate-900/80 backdrop-blur-sm">
          <Button
            onClick={() => handleSave(null)}
            variant="outline"
            className="flex-1 text-sm h-10"
            disabled={saving !== null}
          >
            {saving === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
          </Button>
          {transitions.map(t => {
            const TIcon = t.icon;
            const isCompleting = t.value === 'completada';
            return (
              <Button
                key={t.value}
                onClick={() => handleSave(t.value)}
                className={`flex-1 text-sm h-10 font-semibold gap-2 ${
                  isCompleting
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/20'
                    : 'bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20'
                }`}
                disabled={saving !== null}
              >
                {saving === t.value ? <Loader2 className="h-4 w-4 animate-spin" /> : <TIcon className="h-4 w-4" />}
                {t.label}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const SECTION_STYLES = {
  slate:   'text-slate-400',
  emerald: 'text-emerald-400',
  blue:    'text-blue-400',
  amber:   'text-amber-400',
};

function Section({ icon: Icon, title, color = 'slate', badge, children }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <p className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 ${SECTION_STYLES[color]}`}>
          <Icon className="h-3.5 w-3.5" />
          {title}
        </p>
        {badge && (
          <span className="text-xs text-slate-500 font-mono bg-slate-800/60 px-2 py-0.5 rounded-full">{badge}</span>
        )}
      </div>
      {children}
    </div>
  );
}