import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertTriangle, Loader2, Camera, X, Phone, User, Building2, Search
} from 'lucide-react';
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
    titulo: '', tipo: '', descripcion: '',
    establecimiento: '', direccion: '', comuna: '',
    reportado_por: '', telefono_contacto: '', jefe_sitio_asignado: '', fotos: [],
  });
  const [search, setSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [locationSelected, setLocationSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const { data: locations = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: () => base44.entities.LocationData.list('-created_date', 500),
  });

  const { data: direcciones = [] } = useQuery({
    queryKey: ['direcciones'],
    queryFn: () => base44.entities.Direccion.list('-created_date', 200),
  });

  // Mapa de direcciones por id para lookup rápido
  const direccionesMap = useMemo(() => {
    const map = {};
    direcciones.forEach(d => { map[d.id] = d; });
    return map;
  }, [direcciones]);

  // Suggestions: buscar por nombre de establecimiento O por nombre de dirección (calle)
  const suggestions = useMemo(() => {
    if (search.length < 1) return [];
    const q = search.toLowerCase();
    return locations.filter(loc => {
      const matchEstablecimiento = loc.establecimiento?.toLowerCase().includes(q);
      const dir = loc.direccion_id ? direccionesMap[loc.direccion_id] : null;
      const matchDireccion = dir?.direccion?.toLowerCase().includes(q);
      return matchEstablecimiento || matchDireccion;
    }).slice(0, 10);
  }, [search, locations, direccionesMap]);

  const jefes = useMemo(() => [...new Set(locations.map(l => l.jefe_sitio).filter(Boolean))], [locations]);

  const handleSelect = (loc) => {
    const dir = loc.direccion_id ? direccionesMap[loc.direccion_id] : null;
    setLocationSelected(loc);
    setSearch(loc.establecimiento);
    setShowSuggestions(false);
    setForm(f => ({
      ...f,
      establecimiento: loc.establecimiento || '',
      direccion: dir?.direccion || '',
      comuna: loc.comuna || '',
      jefe_sitio_asignado: loc.jefe_sitio || '',
    }));
  };

  const handleClearSelection = () => {
    setLocationSelected(null);
    setSearch('');
    setForm(f => ({ ...f, establecimiento: '', direccion: '', comuna: '', jefe_sitio_asignado: '' }));
  };

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingPhoto(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, fotos: [...f.fotos, file_url] }));
    setUploadingPhoto(false);
  };

  const handleSubmit = async () => {
    if (!form.titulo || !form.tipo || !form.establecimiento) {
      toast.error('Completá los campos obligatorios');
      return;
    }
    setSaving(true);
    const codigo = `EMG-${Date.now().toString().slice(-6)}`;
    const emergencia = await base44.entities.Emergencia.create({
      ...form, codigo, estado: 'activa',
    });
    const ot = await base44.entities.WorkOrder.create({
      title: `[EMERGENCIA] ${form.titulo}`,
      type: 'emergencia', status: 'pendiente', priority: 'urgente',
      description: form.descripcion,
      location: [form.establecimiento, form.direccion].filter(Boolean).join(' - '),
      assigned_name: form.jefe_sitio_asignado,
      gps_status: 'no_disponible',
      photos: form.fotos,
      notes: `Emergencia: ${codigo}`,
    });
    await base44.entities.Emergencia.update(emergencia.id, { work_order_id: ot.id });
    setSaving(false);
    toast.success('Emergencia registrada y OT creada');
    onSuccess?.();
  };

  return (
    <div className="space-y-6">
      {/* Tipo */}
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

      {/* Búsqueda de establecimiento */}
      <div>
        <label className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
          <Building2 className="h-4 w-4" /> Establecimiento *
        </label>
        <p className="text-xs text-slate-500 mb-2">Buscá por nombre del establecimiento o por dirección (calle)</p>

        {locationSelected ? (
          /* Selección confirmada */
          <div className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-white font-semibold text-sm">{form.establecimiento}</p>
              {form.direccion && <p className="text-slate-400 text-xs mt-0.5">📍 {form.direccion}</p>}
              <div className="flex gap-3 mt-1 text-xs text-slate-400">
                {form.comuna && <span>🏘️ {form.comuna}</span>}
                {form.jefe_sitio_asignado && <span>👤 {form.jefe_sitio_asignado}</span>}
              </div>
            </div>
            <button onClick={handleClearSelection} className="text-slate-400 hover:text-white transition-colors mt-0.5">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          /* Campo de búsqueda */
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Ej: Escuela N°5  o  Av. Rivadavia 1234..."
              value={search}
              onChange={e => { setSearch(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              className="pl-9 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                {suggestions.map(loc => {
                  const dir = loc.direccion_id ? direccionesMap[loc.direccion_id] : null;
                  return (
                    <button
                      key={loc.id}
                      type="button"
                      onMouseDown={() => handleSelect(loc)}
                      className="w-full text-left px-4 py-3 hover:bg-slate-700 transition-colors border-b border-slate-700/50 last:border-0"
                    >
                      <p className="text-sm text-white font-medium">{loc.establecimiento}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {dir?.direccion ? `📍 ${dir.direccion}` : ''}
                        {loc.jefe_sitio ? `  ·  👤 ${loc.jefe_sitio}` : ''}
                        {loc.comuna ? `  ·  ${loc.comuna}` : ''}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
            {showSuggestions && search.length >= 1 && suggestions.length === 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl px-4 py-3">
                <p className="text-sm text-slate-400">No se encontraron resultados para "{search}"</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Jefe de Sitio */}
      <div>
        <label className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
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

      {/* Contacto */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
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
          <label className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
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
        <label className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
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