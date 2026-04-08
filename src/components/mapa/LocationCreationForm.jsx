import React, { useState } from 'react';
import { X, Save, Loader2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const COLOR_OPTIONS = [
  { value: 'blue', label: 'Azul', bg: 'bg-blue-500' },
  { value: 'green', label: 'Verde', bg: 'bg-green-500' },
  { value: 'purple', label: 'Púrpura', bg: 'bg-purple-500' },
  { value: 'orange', label: 'Naranja', bg: 'bg-orange-500' },
  { value: 'red', label: 'Rojo', bg: 'bg-red-500' },
  { value: 'yellow', label: 'Amarillo', bg: 'bg-yellow-500' },
  { value: 'pink', label: 'Rosa', bg: 'bg-pink-500' },
];

export default function LocationCreationForm({
  initialCoords,
  onSave,
  onCancel,
  isLoading = false,
}) {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    description: '',
    latitude: initialCoords?.latitude || 0,
    longitude: initialCoords?.longitude || 0,
    color: 'blue',
    event_type: 'ambos',
    is_active: true,
  });

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    try {
      await onSave(formData);
      toast.success('Ubicación creada exitosamente');
    } catch (error) {
      toast.error('Error al crear ubicación');
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-card border-l border-border shadow-2xl flex flex-col z-50 animate-in slide-in-from-right">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-card/50 sticky top-0">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Nueva Ubicación QR</h2>
        </div>
        <button
          onClick={onCancel}
          className="p-1.5 hover:bg-accent rounded-lg transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Nombre */}
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">
            Nombre *
          </label>
          <Input
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Ej: Obra Norte, Depósito Central"
            className="h-10"
            autoFocus
          />
        </div>

        {/* Dirección */}
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">
            Dirección
          </label>
          <Input
            value={formData.address}
            onChange={(e) => handleChange('address', e.target.value)}
            placeholder="Dirección física"
            className="h-10"
          />
        </div>

        {/* Descripción */}
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">
            Descripción
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Detalles adicionales"
            className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-background"
            rows="3"
          />
        </div>

        {/* Coordenadas */}
        <div className="bg-muted/50 rounded-lg p-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase">
            Coordenadas GPS
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Latitud</label>
              <Input
                type="number"
                value={formData.latitude}
                onChange={(e) => handleChange('latitude', parseFloat(e.target.value))}
                step="0.00001"
                className="h-9 text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Longitud</label>
              <Input
                type="number"
                value={formData.longitude}
                onChange={(e) => handleChange('longitude', parseFloat(e.target.value))}
                step="0.00001"
                className="h-9 text-xs font-mono"
              />
            </div>
          </div>
        </div>

        {/* Color */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">Color</label>
          <div className="grid grid-cols-4 gap-2">
            {COLOR_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleChange('color', opt.value)}
                className={`h-10 rounded-lg border-2 transition-all ${
                  formData.color === opt.value
                    ? `border-foreground ${opt.bg} text-white`
                    : `border-border ${opt.bg} opacity-50 hover:opacity-100`
                }`}
                title={opt.label}
              />
            ))}
          </div>
        </div>

        {/* Tipo de Evento */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">Tipo</label>
          <select
            value={formData.event_type}
            onChange={(e) => handleChange('event_type', e.target.value)}
            className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="entrada">Solo Entrada</option>
            <option value="salida">Solo Salida</option>
            <option value="ambos">Ambos</option>
          </select>
        </div>

        {/* Estado */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.is_active}
            onChange={(e) => handleChange('is_active', e.target.checked)}
            className="rounded border-border"
          />
          <span className="text-sm">Ubicación activa</span>
        </label>
      </form>

      {/* Footer */}
      <div className="border-t border-border p-4 bg-card/50 space-y-2">
        <Button
          onClick={handleSubmit}
          disabled={!formData.name.trim() || isLoading}
          className="w-full gap-2 h-10"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Crear Ubicación
        </Button>
        <Button variant="outline" onClick={onCancel} className="w-full h-10">
          Cancelar
        </Button>
      </div>
    </div>
  );
}