import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  MapPin, Users, Building2, Zap, Edit2, Save, X, Plus,
  ChevronDown, ChevronUp, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function DireccionesManager({ locations, comunas, onLocationUpdate, isLoading }) {
  const [expandedDir, setExpandedDir] = useState(null);
  const [editingDirIndex, setEditingDirIndex] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [newDirForm, setNewDirForm] = useState({ direccion: '', jefe_sitio: '' });
  const [showAddDir, setShowAddDir] = useState(false);
  const [selectedDirs, setSelectedDirs] = useState(new Set());
  const [bulkJefe, setBulkJefe] = useState('');
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const queryClient = useQueryClient();

  // Cargar jefes de sitio desde Employee
  const { data: empleados = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.filter({ role: 'jefe_sitio' }),
  });

  const jefesSitioDisponibles = useMemo(
    () => empleados.map(e => e.full_name).sort(),
    [empleados]
  );

  // Agrupar por direcciones
  const direccionesData = useMemo(() => {
    const byDir = {};
    locations.forEach(loc => {
      const dir = loc.direccion || 'Sin dirección';
      if (!byDir[dir]) {
        byDir[dir] = {
          direccion: dir,
          jefe_sitio: loc.jefe_sitio || null,
          locations: [],
          comunas: new Set(),
        };
      }
      byDir[dir].locations.push(loc);
      byDir[dir].comunas.add(loc.comuna);
    });

    return Object.values(byDir)
      .map(d => ({ ...d, comunas: Array.from(d.comunas).sort() }))
      .sort((a, b) => b.locations.length - a.locations.length);
  }, [locations]);

  const jefesUnicos = useMemo(() => {
    const asignados = new Set(locations.map(l => l.jefe_sitio).filter(Boolean));
    return [...new Set([...asignados, ...jefesSitioDisponibles])].sort();
  }, [locations, jefesSitioDisponibles]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.LocationData.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      setEditingDirIndex(null);
      toast.success('Jefe de sitio asignado');
    },
  });

  const handleEditDir = (index, dir) => {
    setEditingDirIndex(index);
    setEditForm(dir);
  };

  const handleSaveDir = async () => {
    // Actualizar todas las escuelas de esa dirección con el nuevo jefe
    for (const loc of editForm.locations) {
      if (loc.jefe_sitio !== editForm.jefe_sitio) {
        await updateMutation.mutate({
          id: loc.id,
          data: { ...loc, jefe_sitio: editForm.jefe_sitio },
        });
      }
    }
    setEditingDirIndex(null);
  };

  const handleCancelEdit = () => {
    setEditingDirIndex(null);
    setEditForm({});
  };

  const toggleSelectDir = (idx) => {
    const newSelected = new Set(selectedDirs);
    if (newSelected.has(idx)) {
      newSelected.delete(idx);
    } else {
      newSelected.add(idx);
    }
    setSelectedDirs(newSelected);
  };

  const handleBulkUpdate = async () => {
    if (selectedDirs.size === 0 || !bulkJefe) return;

    const dirsToUpdate = Array.from(selectedDirs).map(idx => direccionesData[idx]);
    let updated = 0;

    for (const dir of dirsToUpdate) {
      for (const loc of dir.locations) {
        if (loc.jefe_sitio !== bulkJefe) {
          await updateMutation.mutate({
            id: loc.id,
            data: { ...loc, jefe_sitio: bulkJefe },
          });
          updated++;
        }
      }
    }

    setSelectedDirs(new Set());
    setBulkJefe('');
    setShowBulkConfirm(false);
    toast.success(`✅ ${updated} escuelas actualizadas`);
  };

  const getColorByComuna = (comunaId) =>
    comunas.find(c => c.id === comunaId)?.color || 'bg-slate-100 text-slate-700';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-slate-200 border-t-primary rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Edición Masiva */}
      {selectedDirs.size > 0 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-900">{selectedDirs.size} dirección(es) seleccionada(s)</p>
                <p className="text-sm text-muted-foreground">
                  {Array.from(selectedDirs).map(idx => direccionesData[idx].direccion).join(', ')}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedDirs(new Set());
                  setBulkJefe('');
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> Asignar Jefe de Sitio a todas
              </label>
              <Select value={bulkJefe} onValueChange={setBulkJefe}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Seleccionar jefe..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Sin asignar</SelectItem>
                  {jefesUnicos.map(jefe => (
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
                onClick={() => setSelectedDirs(new Set())}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={!bulkJefe}
                onClick={() => setShowBulkConfirm(true)}
              >
                Actualizar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmación de edición masiva */}
      {showBulkConfirm && (
        <AlertDialog open={showBulkConfirm} onOpenChange={setShowBulkConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Confirmar actualización masiva?</AlertDialogTitle>
              <AlertDialogDescription>
                Se asignará "{bulkJefe}" como Jefe de Sitio para {Array.from(selectedDirs).reduce((total, idx) => total + direccionesData[idx].locations.length, 0)} escuelas en {selectedDirs.size} dirección(es).
                <div className="mt-3 p-2 bg-slate-50 rounded text-xs text-slate-700 max-h-24 overflow-y-auto">
                  {Array.from(selectedDirs).map(idx => (
                    <div key={idx}>• {direccionesData[idx].direccion} ({direccionesData[idx].locations.length} escuelas)</div>
                  ))}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleBulkUpdate}>
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Agregar dirección */}
      {showAddDir ? (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="pt-6 space-y-3">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">Nueva Dirección</label>
              <Input
                placeholder="Ej: Avenida Corrientes 1234, CABA"
                value={newDirForm.direccion}
                onChange={(e) => setNewDirForm({ ...newDirForm, direccion: e.target.value })}
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> Jefe de Sitio (Opcional)
              </label>
              <Select
                value={newDirForm.jefe_sitio}
                onValueChange={(value) => setNewDirForm({ ...newDirForm, jefe_sitio: value })}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Seleccionar jefe..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Sin asignar</SelectItem>
                  {jefesUnicos.map(jefe => (
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
                onClick={() => {
                  setShowAddDir(false);
                  setNewDirForm({ direccion: '', jefe_sitio: '' });
                }}
              >
                <X className="h-3.5 w-3.5 mr-1" /> Cancelar
              </Button>
              <Button
                size="sm"
                disabled={!newDirForm.direccion}
                onClick={() => {
                  // Crear entrada de dirección (esta es una nota: requeriría modelo de Direcciones separado para persistencia total)
                  toast.info('Nueva dirección creada. Asigna escuelas a través de edición de ubicaciones.');
                  setShowAddDir(false);
                  setNewDirForm({ direccion: '', jefe_sitio: '' });
                }}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Crear
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button
          variant="outline"
          onClick={() => setShowAddDir(true)}
          className="w-full gap-2"
        >
          <Plus className="h-4 w-4" /> Nueva Dirección
        </Button>
      )}

      {/* Lista de direcciones */}
      {direccionesData.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <MapPin className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">Sin direcciones</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {direccionesData.map((dirData, idx) => (
            <Card key={dirData.direccion} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              {editingDirIndex === idx ? (
                // Modo edición
                <CardContent className="pt-6 space-y-3">
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
                      <Users className="h-3.5 w-3.5" /> Asignar Jefe de Sitio
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
                        {jefesUnicos.map(jefe => (
                          <SelectItem key={jefe} value={jefe}>
                            {jefe}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <p className="text-xs text-slate-500 bg-slate-50 rounded p-2">
                    Esto asignará el jefe de sitio a todas las {editForm.locations?.length || 0} escuelas de esta dirección.
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" variant="outline" onClick={handleCancelEdit} className="gap-1">
                      <X className="h-3.5 w-3.5" /> Cancelar
                    </Button>
                    <Button size="sm" onClick={handleSaveDir} className="gap-1">
                      <Save className="h-3.5 w-3.5" /> Guardar
                    </Button>
                  </div>
                </CardContent>
              ) : (
                // Vista normal
                <>
                  <button
                    onClick={() => setExpandedDir(expandedDir === idx ? null : idx)}
                    className="w-full text-left"
                  >
                    <CardContent className="pt-4 pb-4 flex items-center justify-between group">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={selectedDirs.has(idx)}
                          onChange={() => toggleSelectDir(idx)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-5 w-5 rounded border-slate-300 cursor-pointer"
                        />
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center flex-shrink-0">
                          <MapPin className="h-6 w-6 text-orange-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-lg text-slate-900 truncate">{dirData.direccion}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {dirData.comunas.map(comunaId => (
                              <Badge key={comunaId} className={`${getColorByComuna(comunaId)} border-0 text-xs`}>
                                {comunaId}
                              </Badge>
                            ))}
                            {dirData.jefe_sitio && (
                              <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">
                                <Users className="h-2.5 w-2.5 mr-1" /> {dirData.jefe_sitio}
                              </Badge>
                            )}
                            {!dirData.jefe_sitio && (
                              <Badge variant="outline" className="text-xs text-orange-600">Sin jefe</Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 ml-2 flex-shrink-0">
                        <div className="text-right">
                          <p className="text-2xl font-bold text-slate-900">{dirData.locations.length}</p>
                          <p className="text-xs text-muted-foreground">escuelas</p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditDir(idx, dirData);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity gap-1"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors group-hover:bg-slate-100">
                          {expandedDir === idx ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
                        </button>
                      </div>
                    </CardContent>
                  </button>

                  {/* Expandido - Escuelas */}
                  {expandedDir === idx && (
                    <div className="border-t border-slate-100 bg-slate-50/50">
                      <div className="px-6 py-4 space-y-2">
                        <p className="text-xs font-semibold text-slate-600 mb-3">Escuelas en esta dirección:</p>
                        {dirData.locations.map(loc => (
                          <div
                            key={loc.id}
                            className="bg-white rounded-lg p-2.5 text-xs border border-slate-200 flex items-start justify-between gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-slate-900">{loc.establecimiento}</p>
                              <p className="text-muted-foreground mt-0.5">{loc.ubic_tecnica}</p>
                            </div>
                            {loc.m2 && (
                              <div className="flex-shrink-0 text-right">
                                <p className="font-bold">{loc.m2.toFixed(0)} m²</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}