import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Loader2, Package, AlertTriangle, Camera } from 'lucide-react';
import { toast } from 'sonner';

const MOTIVOS_PREDEFINIDOS = [
  'Sin stock en pañol',
  'Material dañado',
  'Cantidad insuficiente',
  'No corresponde al trabajo',
  'Otro',
];

export default function ReporteForm({ ot, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [material, setMaterial] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [faltantes, setFaltantes] = useState([]);
  const [faltanteNombre, setFaltanteNombre] = useState('');
  const [faltanteCant, setFaltanteCant] = useState(1);
  const [faltanteMotivo, setFaltanteMotivo] = useState('');
  const [notas, setNotas] = useState(ot.notes || '');

  const [usados, setUsados] = useState(ot.materials_used || []);
  const [photos, setPhotos] = useState(ot.photos || []);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const addUsado = () => {
    if (!material.trim()) return;
    setUsados(prev => [...prev, { material_name: material.trim(), quantity: Number(cantidad), unit_cost: 0 }]);
    setMaterial('');
    setCantidad(1);
  };

  const removeUsado = (idx) => setUsados(prev => prev.filter((_, i) => i !== idx));

  const addFaltante = () => {
    if (!faltanteNombre.trim()) {
      toast.error('Indicá el nombre del material faltante');
      return;
    }
    if (!faltanteMotivo.trim()) {
      toast.error('Debes seleccionar un motivo para el material faltante');
      return;
    }
    setFaltantes(prev => [...prev, { material_name: faltanteNombre.trim(), cantidad_faltante: Number(faltanteCant), motivo: faltanteMotivo.trim() }]);
    setFaltanteNombre('');
    setFaltanteCant(1);
    setFaltanteMotivo('');
  };

  const removeFaltante = (idx) => setFaltantes(prev => prev.filter((_, i) => i !== idx));

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setPhotos(prev => [...prev, file_url]);
    } catch (err) {
      toast.error('Error al subir foto');
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const removePhoto = (idx) => setPhotos(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validación final: si hay faltantes, todos deben tener motivo
    if (faltantes.length > 0) {
      const sinMotivo = faltantes.filter(m => !m.motivo || !m.motivo.trim());
      if (sinMotivo.length > 0) {
        toast.error('Todos los materiales faltantes deben tener un motivo');
        return;
      }
    }

    setSaving(true);
    try {
      // Devolver los datos al portal — la transición de estado la hace el backend
      onSaved({
        materials_used: usados,
        materiales_faltantes: faltantes,
        notes: notas,
        photos,
      });
    } catch (err) {
      toast.error('Error: ' + (err.message || 'intente nuevamente'));
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
          <div>
            <h2 className="text-base font-bold text-white">Reporte de Cierre</h2>
            <p className="text-xs text-slate-500">Al guardar, la OT se envía al Jefe de Sitio</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="px-4 pt-3 text-xs text-slate-400 truncate">{ot.title}</p>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">

          {/* Fotos de evidencia */}
          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-1.5 mb-2">
              <Camera className="h-3.5 w-3.5 text-sky-400" /> Fotos de Evidencia
            </label>
            {photos.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-2">
                {photos.map((url, i) => (
                  <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-700">
                    <img src={url} alt="evidencia" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removePhoto(i)} className="absolute top-0 right-0 bg-black/70 text-white p-0.5 rounded-bl">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className={`flex items-center justify-center gap-2 h-10 rounded-lg border border-dashed border-slate-600 text-slate-400 text-xs font-medium cursor-pointer hover:bg-slate-800 hover:text-slate-200 transition-colors ${uploadingPhoto ? 'opacity-50 pointer-events-none' : ''}`}>
              {uploadingPhoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              {uploadingPhoto ? 'Subiendo...' : 'Agregar foto'}
              <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} className="hidden" />
            </label>
          </div>

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

          {/* Materiales faltantes — motivo OBLIGATORIO */}
          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-1.5 mb-1">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" /> Materiales Faltantes
            </label>
            <p className="text-[10px] text-amber-400/70 mb-2">El motivo es obligatorio para cada faltante</p>
            {faltantes.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {faltantes.map((m, i) => (
                  <div key={i} className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-amber-200">{m.material_name} · {m.cantidad_faltante}u</p>
                      <p className="text-xs text-amber-400/80">{m.motivo}</p>
                    </div>
                    <button type="button" onClick={() => removeFaltante(i)} className="text-slate-500 hover:text-red-400 mt-0.5">
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
              <select
                value={faltanteMotivo}
                onChange={e => setFaltanteMotivo(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Seleccionar motivo *</option>
                {MOTIVOS_PREDEFINIDOS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
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
            className="w-full h-12 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Enviar al Jefe de Sitio'}
          </button>
        </div>
      </form>
    </div>
  );
}