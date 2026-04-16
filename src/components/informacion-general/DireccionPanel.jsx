import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, ChevronUp, MapPin, Building2, Zap, Edit2, Save, X, Users } from 'lucide-react';

export default function DireccionPanel({ direccionData, isExpanded, onToggle, comunas, onEdit, onDelete, jefesDisponibles }) {
  const getColorByComuna = (comunaId) => 
    comunas.find(c => c.id === comunaId)?.color || 'bg-slate-100 text-slate-700';
  
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const handleEditClick = (loc) => {
    setEditingId(loc.id);
    setEditForm(loc);
  };

  const handleSave = () => {
    if (onEdit) {
      onEdit(editingId, editForm);
    }
    setEditingId(null);
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full text-left"
      >
        <CardContent className="pt-4 pb-4 flex items-center justify-between group">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center flex-shrink-0">
              <MapPin className="h-6 w-6 text-orange-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-lg text-slate-900 truncate">{direccionData.direccion || 'Sin dirección'}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {Object.keys(direccionData.comunas).sort().map(comunaId => (
                  <Badge key={comunaId} className={`${getColorByComuna(comunaId)} border-0`}>
                    {comunaId}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 ml-2 flex-shrink-0">
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-900">{direccionData.locations.length}</p>
              <p className="text-xs text-muted-foreground">escuelas</p>
            </div>
            <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors group-hover:bg-slate-100">
              {isExpanded ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
            </button>
          </div>
        </CardContent>
      </button>

      {/* Content expandido */}
      {isExpanded && (
        <div className="border-t border-slate-100 bg-slate-50/50">
          <div className="px-6 py-4 space-y-3">
            {direccionData.locations.map(loc => (
              <div key={loc.id}>
                {editingId === loc.id ? (
                  // Modo edición
                  <div className="bg-white rounded-lg p-4 border border-primary space-y-3">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-700">Establecimiento</label>
                      <Input
                        value={editForm.establecimiento || ''}
                        onChange={(e) => setEditForm({ ...editForm, establecimiento: e.target.value })}
                        className="text-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-700">Dirección</label>
                      <Input
                        value={editForm.direccion || ''}
                        onChange={(e) => setEditForm({ ...editForm, direccion: e.target.value })}
                        className="text-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" /> Jefe de Sitio
                      </label>
                      <Select
                        value={editForm.jefe_sitio || ''}
                        onValueChange={(value) => setEditForm({ ...editForm, jefe_sitio: value })}
                      >
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="Seleccionar jefe..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={null}>Sin asignar</SelectItem>
                          {jefesDisponibles?.map(jefe => (
                            <SelectItem key={jefe} value={jefe}>
                              {jefe}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancel}
                        className="gap-1"
                      >
                        <X className="h-3.5 w-3.5" /> Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSave}
                        className="gap-1"
                      >
                        <Save className="h-3.5 w-3.5" /> Guardar
                      </Button>
                    </div>
                  </div>
                ) : (
                  // Vista normal
                  <div
                    className="bg-white rounded-lg p-3 border border-slate-200 hover:border-primary/30 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 text-sm">{loc.establecimiento}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{loc.direccion}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {loc.ubic_tecnica && (
                            <Badge variant="outline" className="text-[10px]">{loc.ubic_tecnica}</Badge>
                          )}
                          <Badge className={getColorByComuna(loc.comuna)}>
                            {loc.comuna}
                          </Badge>
                          {loc.jefe_sitio && (
                            <Badge className="bg-blue-100 text-blue-700 border-0 text-[10px]">
                              <Users className="h-2.5 w-2.5 mr-1" /> {loc.jefe_sitio}
                            </Badge>
                          )}
                          {!loc.jefe_sitio && (
                            <Badge variant="outline" className="text-[10px] text-orange-600">Sin jefe</Badge>
                          )}
                          {loc.estado === 'activo' && (
                            <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px]">
                              <Zap className="h-2.5 w-2.5 mr-0.5" /> Activo
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {loc.m2 && (
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Superficie</p>
                            <p className="font-bold text-sm text-slate-900">{loc.m2.toFixed(0)} m²</p>
                          </div>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditClick(loc)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity gap-1"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}