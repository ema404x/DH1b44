import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle, MapPin, Loader2, Camera, X, Phone, User, Building2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const TIPOS = [
  { id: 'incendio', label: '🔥 Incendio', color: 'border-red-500 bg-red-500/20 text-red-300' },
  { id: 'inundacion', label: '💧 Inundación', color: 'border-blue-500 bg-blue-500/20 text-blue-300' },
  { id: 'corte_electrico', label: '⚡ Corte Eléctrico', color: 'border-yellow-500 bg-yellow-500/20 text-yellow-300' },
  { id: 'derrumbe', label: '🧱 Derrumbe', color: 'border-orange-500 bg-orange-500/20 text-orange-300' },
  { id: 'rotura_gas', label: '💨 Rotura de Gas', color: 'border-purple-500 bg-purple-500/20 text-purple-300' },
  { id: 'vandalismo', label: '🚨 Vandalismo', color: 'border-pink-500 bg-pink-500/20 text-pink-300' },
  { id: 'accidente', label: '🏥 Accidente', color: 'border-rose-500 bg-rose-500/20 text-rose-300' },
  { id: 'otro', label: '⚠️ Otro', color: 'border-slate-500 bg-slate-500/20 text-slate-300' },
];

export default function EmergenciaForm({ onSuccess, onCancel }) {
  const [form, setForm] = useState({
    titulo: '',
    tipo: '',
    descripcion: '',
    establecimiento: '',
    direccion: '',
    comuna: '',
    reportado_por: '',
    telefono_contacto: '',
    jefe_sitio_asignado: '',
    fotos: [],
  });
  const [gps, setGps] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [estSearch, setEstSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const estRef = useRef(null);

  const { data: locations = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: () => base44.entities.LocationData.list('-created_date', 500),
  });

  const { data: direcciones = [] } = useQuery({
    queryKey: ['direcciones'],
    queryFn: () => base44.entities.Direccion.list(),
  });

  const jefes = [...new Set(locations.map(l => l.jefe_sitio).filter(Boolean))];

  const captureGPS = () => {
    setGpsLoading(true);
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsLoading(false);
        toast.success('Ubicación capturada');
      },
      () => {
        setGpsLoading(false);
        toast.error('No se pudo obtener la ubicación');
      },
      { timeout: 10000 }
    );
  };

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingPhoto(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, fotos: [...f.fotos, file_url] }));
    setUploadingPhoto(false);
  };

  const handleEstablecimientoSelect = (loc) => {
    setEstSearch(loc.establecimiento);
    setShowSuggestions(false);
    setForm(f => ({
      ...f,
      establecimiento: loc.establecimiento,
      direccion: loc.ubic_tecnica || f.direccion,
      comuna: loc.comuna || f.comuna,
      jefe_sitio_asignado: loc.jefe_sitio || f.jefe_sitio_asignado,
    }));
  };

  const estSuggestions = estSearch.length >= 1
    ? locations.filter(l =>
        l.establecimiento?.toLowerCase().includes(estSearch.toLowerCase())
      ).slice(0, 8)
    : [];

  const handleSubmit = async () => {
    if (!form.titulo || !form.tipo || !form.establecimiento) {
      toast.error('Completá los campos obligatorios');
      return;
    }
    setSaving(true);
    const codigo = `EMG-${Date.now().toString().slice(-6)}`;

    // Crear la emergencia
    const emergencia = await base44.entities.Emergencia.create({
      ...form,
      codigo,
      estado: 'activa',
      gps_latitude: gps?.lat || null,
      gps_longitude: gps?.lng || null,
    });

    // Crear OT vinculada automáticamente
    const ot = await base44.entities.WorkOrder.create({
      title: `[EMERGENCIA] ${form.titulo}`,
      type: 'emergencia',
      status: 'pendiente',
      priority: 'urgente',
      description: form.descripcion,
      location: `${form.establecimiento} - ${form.direccion}`,
      assigned_name: form.jefe_sitio_asignado,
      gps_latitude: gps?.lat || null,
      gps_longitude: gps?.lng || null,
      gps_status: gps ? 'capturado' : 'no_disponible',
      photos: form.fotos,
      notes: `Emergencia: ${codigo}`,
    });

    // Vincular OT a la emergencia
    await base44.entities.Emergencia.update(emergencia.id, { work_order_id: ot.id });

    setSaving(false);
    toast.success('Emergencia registrada y OT creada');
    onSuccess?.();
  };

  return (
    <div className="space-y-6">
      {/* Tipo de emergencia */}
      <div>
        <label className="text-sm font-semibold text-slate-300 mb-3 block">Tipo de emergencia *</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TIPOS.map(t => (
            <button
              key={t.id}
              onClick={() => setForm(f => ({ ...f, tipo: t.id }))}
              className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                form.tipo === t.id ? t.color : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Título */}
      <div>
        <label className="text-sm font-semibold text-slate-300 mb-2 block">Título / Resumen *</label>
        <Input
          placeholder="Ej: Pérdida de agua en baños planta baja"
          value={form.titulo}
          onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
          className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
        />
      </div>

      {/* Descripción */}
      <div>
        <label className="text-sm font-semibold text-slate-300 mb-2 block">Descripción detallada</label>
        <textarea
          rows={3}
          placeholder="Describí la situación con el mayor detalle posible..."
          value={form.descripcion}
          onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
          className="w-full rounded-md border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
      </div>

      {/* Establecimiento */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="relative" ref={estRef}>
          <label className="text-sm font-semibold text-slate-300 mb-2 block flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Establecimiento *
          </label>
          <Input
            placeholder="Escribí para buscar escuela..."
            value={estSearch}
            onChange={e => {
              setEstSearch(e.target.value);
              setShowSuggestions(true);
              if (!e.target.value) setForm(f => ({ ...f, establecimiento: '', direccion: '', comuna: '', jefe_sitio_asignado: '' }));
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            className={`bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 ${form.establecimiento ? 'border-emerald-500/50' : ''}`}
          />
          {showSuggestions && estSuggestions.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
              {estSuggestions.map(loc => (
                <button
                  key={loc.id}
                  type="button"
                  onMouseDown={() => handleEstablecimientoSelect(loc)}
                  className="w-full text-left px-3 py-2.5 hover:bg-slate-700 transition-colors border-b border-slate-700/50 last:border-0"
                >
                  <p className="text-sm text-white font-medium">{loc.establecimiento}</p>
                  <p className="text-xs text-slate-400">{loc.jefe_sitio ? `Jefe: ${loc.jefe_sitio}` : ''} {loc.comuna ? `· ${loc.comuna}` : ''}</p>
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-300 mb-2 block">Dirección</label>
          <Input
            placeholder="Se completa automáticamente"
            value={form.direccion}
            onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))}
            className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* Jefe de Sitio + GPS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-semibold text-slate-300 mb-2 block flex items-center gap-2">
            <User className="h-4 w-4" /> Jefe de Sitio asignado
          </label>
          <select
            value={form.jefe_sitio_asignado}
            onChange={e => setForm(f => ({ ...f, jefe_sitio_asignado: e.target.value }))}
            className="w-full h-9 rounded-md border border-slate-700 bg-slate-800/50 px-3 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500"
          >
            <option value="">Sin asignar</option>
            {jefes.map(j => <option key={j} value={j}>{j}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-300 mb-2 block flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Ubicación GPS
          </label>
          <Button
            type="button"
            onClick={captureGPS}
            disabled={gpsLoading}
            variant="outline"
            className={`w-full border-slate-700 ${gps ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10' : 'text-slate-400 bg-slate-800/50'}`}
          >
            {gpsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
            {gps ? `GPS capturado (${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)})` : 'Capturar ubicación'}
          </Button>
        </div>
      </div>

      {/* Contacto */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-semibold text-slate-300 mb-2 block flex items-center gap-2">
            <User className="h-4 w-4" /> Reportado por
          </label>
          <Input
            placeholder="Nombre del reportante"
            value={form.reportado_por}
            onChange={e => setForm(f => ({ ...f, reportado_por: e.target.value }))}
            className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
          />
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-300 mb-2 block flex items-center gap-2">
            <Phone className="h-4 w-4" /> Teléfono de contacto
          </label>
          <Input
            placeholder="Teléfono"
            value={form.telefono_contacto}
            onChange={e => setForm(f => ({ ...f, telefono_contacto: e.target.value }))}
            className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* Fotos */}
      <div>
        <label className="text-sm font-semibold text-slate-300 mb-2 block flex items-center gap-2">
          <Camera className="h-4 w-4" /> Fotos de la situación
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {form.fotos.map((url, i) => (
            <div key={i} className="relative group">
              <img src={url} alt="" className="h-20 w-20 object-cover rounded-lg border border-slate-700" />
              <button
                onClick={() => setForm(f => ({ ...f, fotos: f.fotos.filter((_, idx) => idx !== i) }))}
                className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <label className={`h-20 w-20 rounded-lg border-2 border-dashed border-slate-700 flex flex-col items-center justify-center cursor-pointer hover:border-slate-600 transition-colors ${uploadingPhoto ? 'opacity-50' : ''}`}>
            {uploadingPhoto ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" /> : <Camera className="h-5 w-5 text-slate-400" />}
            <span className="text-xs text-slate-500 mt-1">Agregar</span>
            <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} disabled={uploadingPhoto} />
          </label>
        </div>
      </div>

      {/* Botones */}
      <div className="flex gap-3 pt-2">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} className="flex-1 border-slate-700 text-slate-400">
            Cancelar
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={saving}
          className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold h-11"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <AlertTriangle className="h-5 w-5" />}
          {saving ? 'Registrando...' : 'Registrar Emergencia'}
        </Button>
      </div>
    </div>
  );
}