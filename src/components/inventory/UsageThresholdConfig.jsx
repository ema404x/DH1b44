import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, AlertTriangle, CheckCircle2, Save, Pencil } from 'lucide-react';
import { toast } from 'sonner';

const norm = (s) => (s || '').toLowerCase().trim();

export default function UsageThresholdConfig({ sectorId, usedNames, onClose }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null); // {id?, material_name, threshold, activo}
  const [showForm, setShowForm] = useState(false);

  const { data: alerts = [] } = useQuery({
    queryKey: ['material-usage-alerts'],
    queryFn: () => base44.entities.MaterialUsageAlert.list('-created_date'),
  });

  const { data: materials = [] } = useQuery({
    queryKey: ['materials'],
    queryFn: () => base44.entities.Material.list('-name'),
  });

  // Sugerencias: nombres ya usados en OTs + catálogo de materiales, sin duplicar existentes.
  const existingKeys = useMemo(() => new Set(alerts.map((a) => norm(a.material_name))), [alerts]);
  const suggestions = useMemo(() => {
    const set = new Map();
    for (const n of usedNames) if (!existingKeys.has(norm(n))) set.set(norm(n), n);
    for (const m of materials) if (m.name && !existingKeys.has(norm(m.name))) set.set(norm(m.name), m.name);
    return Array.from(set.values()).sort();
  }, [usedNames, materials, existingKeys]);

  const saveMutation = useMutation({
    mutationFn: (data) =>
      data.id
        ? base44.entities.MaterialUsageAlert.update(data.id, {
            material_name: data.material_name,
            threshold: Number(data.threshold) || 0,
            activo: data.activo,
          })
        : base44.entities.MaterialUsageAlert.create({
            material_name: data.material_name,
            threshold: Number(data.threshold) || 0,
            activo: data.ativo !== undefined ? data.activo : true,
            sector_id: sectorId,
          }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-usage-alerts'] });
      setEditing(null);
      setShowForm(false);
      toast.success('Alerta guardada');
    },
    onError: () => toast.error('Error al guardar la alerta'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.MaterialUsageAlert.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-usage-alerts'] });
      toast.success('Alerta eliminada');
    },
  });

  const startNew = () => {
    setEditing({ material_name: '', threshold: 0, activo: true });
    setShowForm(true);
  };
  const startEdit = (a) => {
    setEditing({ id: a.id, material_name: a.material_name, threshold: a.threshold, activo: a.activo });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!editing.material_name.trim()) {
      toast.error('Ingresá un nombre de material');
      return;
    }
    if (!editing.threshold || Number(editing.threshold) <= 0) {
      toast.error('Ingresá un umbral válido');
      return;
    }
    saveMutation.mutate(editing);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-slate-900 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-400" /> Alertas de utilización de materiales
          </DialogTitle>
          <p className="text-sm text-slate-400 mt-1">
            Configurá un umbral por material. Cuando el uso acumulado en OTs lo supere, se generará una alerta.
          </p>
        </DialogHeader>

        {showForm ? (
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase">Material</label>
              <Input
                list="usage-material-suggestions"
                value={editing.material_name}
                onChange={(e) => setEditing({ ...editing, material_name: e.target.value })}
                placeholder="Ej: Cerradura"
                className="bg-slate-800 border-slate-700 text-white mt-1"
                disabled={!!editing.id}
              />
              <datalist id="usage-material-suggestions">
                {suggestions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase">Umbral (cantidad)</label>
              <Input
                type="number"
                value={editing.threshold || ''}
                onChange={(e) => setEditing({ ...editing, threshold: e.target.value })}
                placeholder="Ej: 200"
                className="bg-slate-800 border-slate-700 text-white mt-1"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={editing.activo}
                onChange={(e) => setEditing({ ...editing, activo: e.target.checked })}
                className="h-4 w-4 rounded accent-emerald-500"
              />
              Alerta activa
            </label>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto py-1">
            {alerts.length === 0 ? (
              <div className="text-center py-6 text-sm text-slate-400">
                No hay alertas configuradas. Creá la primera.
              </div>
            ) : (
              alerts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-800/60 border border-slate-700/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">{a.material_name}</p>
                    <p className="text-xs text-slate-400">Umbral: {a.threshold} ud.</p>
                  </div>
                  <Badge
                    className={
                      a.activo
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-slate-700 text-slate-400'
                    }
                  >
                    {a.activo ? <><CheckCircle2 className="h-3 w-3 mr-1" /> Activa</> : 'Inactiva'}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400" onClick={() => startEdit(a)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={() => deleteMutation.mutate(a.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {showForm ? (
            <>
              <Button variant="outline" onClick={() => { setShowForm(false); setEditing(null); }}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-1.5 bg-emerald-600 hover:bg-emerald-500">
                <Save className="h-4 w-4" /> Guardar
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>Cerrar</Button>
              <Button onClick={startNew} className="gap-1.5 bg-emerald-600 hover:bg-emerald-500">
                <Plus className="h-4 w-4" /> Nueva alerta
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}