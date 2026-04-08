import React, { useState, useEffect } from 'react';
import {
  X, MapPin, Phone, Mail, FileText, Save, Loader2, AlertCircle,
  Eye, EyeOff, Trash2, Copy
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function LocationDetailPanel({
  location,
  onClose,
  onUpdate,
  onDelete,
  isLoading = false,
}) {
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState(location || {});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setFormData(location || {});
    setEditMode(false);
    setHasChanges(false);
  }, [location]);

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!onUpdate) return;
    
    try {
      await onUpdate(location.id, formData);
      setHasChanges(false);
      setEditMode(false);
      toast.success('Ubicación actualizada');
    } catch (error) {
      toast.error('Error al actualizar');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('¿Eliminar esta ubicación?')) return;
    
    try {
      await onDelete(location.id);
      onClose();
      toast.success('Ubicación eliminada');
    } catch (error) {
      toast.error('Error al eliminar');
    }
  };

  const copyCoordinates = () => {
    const coords = `${location.latitude}, ${location.longitude}`;
    navigator.clipboard.writeText(coords);
    toast.success('Coordenadas copiadas');
  };

  if (!location) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-card border-l border-border shadow-2xl flex flex-col z-40 animate-in slide-in-from-right">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0">
        <div className="flex-1">
          <h2 className="font-semibold text-foreground line-clamp-1">{formData.name}</h2>
          <p className="text-xs text-muted-foreground mt-1">ID: {location.id}</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-accent rounded-lg transition-colors ml-2 flex-shrink-0"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Status Badge */}
        <div className="flex items-center justify-between">
          <Badge className={formData.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}>
            {formData.is_active ? '✓ Activo' : '✗ Inactivo'}
          </Badge>
          <div className="text-xs text-muted-foreground">
            {formData.total_scans || 0} escaneos
          </div>
        </div>

        {/* Coordinates Card */}
        <Card className="border-dashed">
          <CardContent className="pt-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Coordenadas GPS</label>
                <button
                  onClick={copyCoordinates}
                  className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Latitud</p>
                  <p className="text-sm font-mono font-semibold">{location.latitude?.toFixed(6)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Longitud</p>
                  <p className="text-sm font-mono font-semibold">{location.longitude?.toFixed(6)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Edit Form */}
        {editMode ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Nombre</label>
              <Input
                value={formData.name || ''}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                placeholder="Nombre de la ubicación"
                className="h-9"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Dirección</label>
              <Input
                value={formData.address || ''}
                onChange={(e) => handleFieldChange('address', e.target.value)}
                placeholder="Dirección física"
                className="h-9"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Descripción</label>
              <Input
                value={formData.description || ''}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                placeholder="Descripción adicional"
                className="h-9"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Color</label>
              <div className="grid grid-cols-4 gap-2">
                {['blue', 'green', 'purple', 'orange', 'red', 'yellow', 'pink'].map(color => (
                  <button
                    key={color}
                    onClick={() => handleFieldChange('color', color)}
                    className={cn(
                      'h-8 rounded-lg border-2 transition-all capitalize text-xs font-semibold',
                      formData.color === color
                        ? 'border-foreground scale-110'
                        : 'border-border hover:border-foreground/50'
                    )}
                    style={{
                      backgroundColor: {
                        blue: '#3b82f6', green: '#10b981', purple: '#a855f7',
                        orange: '#f97316', red: '#ef4444', yellow: '#eab308', pink: '#ec4899'
                      }[color],
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active || false}
                onChange={(e) => handleFieldChange('is_active', e.target.checked)}
                className="rounded border-border"
              />
              <label htmlFor="is_active" className="text-sm font-medium cursor-pointer">
                Ubicación activa
              </label>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Nombre</p>
              <p className="text-foreground">{formData.name}</p>
            </div>
            {formData.address && (
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold mb-1 flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Dirección
                </p>
                <p className="text-foreground text-sm">{formData.address}</p>
              </div>
            )}
            {formData.description && (
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold mb-1 flex items-center gap-1">
                  <FileText className="h-3 w-3" /> Descripción
                </p>
                <p className="text-foreground text-sm">{formData.description}</p>
              </div>
            )}
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <div className={cn(
                'h-6 w-6 rounded-full border-2 border-white shadow-md',
                formData.color === 'blue' && 'bg-blue-500',
                formData.color === 'green' && 'bg-green-500',
                formData.color === 'purple' && 'bg-purple-500',
                formData.color === 'orange' && 'bg-orange-500',
                formData.color === 'red' && 'bg-red-500',
                formData.color === 'yellow' && 'bg-yellow-500',
                formData.color === 'pink' && 'bg-pink-500',
                !formData.color && 'bg-blue-500',
              )} />
              <span className="text-xs text-muted-foreground capitalize">{formData.color || 'blue'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="border-t border-border p-4 bg-card/50 backdrop-blur-sm space-y-2">
        {editMode ? (
          <>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || isLoading}
              className="w-full gap-2 h-9"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar Cambios
            </Button>
            <Button
              onClick={() => {
                setFormData(location);
                setEditMode(false);
                setHasChanges(false);
              }}
              variant="outline"
              className="w-full h-9"
            >
              Cancelar
            </Button>
          </>
        ) : (
          <>
            <Button
              onClick={() => setEditMode(true)}
              variant="default"
              className="w-full h-9"
            >
              Editar Ubicación
            </Button>
            <Button
              onClick={handleDelete}
              variant="destructive"
              className="w-full gap-2 h-9"
              disabled={isLoading}
            >
              <Trash2 className="h-4 w-4" />
              Eliminar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}