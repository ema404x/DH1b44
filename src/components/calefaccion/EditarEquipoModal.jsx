import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Save } from 'lucide-react';

const TIPO_LABELS = {
  estufas: 'Estufas', radiadores: 'Radiadores', conductos: 'Conductos',
  calderas: 'Calderas', vrv: 'VRV', vrv_bajo_silueta: 'VRV Bajo Silueta',
  aire_acondicionado_calor: 'Aire Acond.', otros: 'Otros',
};

function calcEstado(pct) {
  if (pct < 50)  return 'critico';
  if (pct < 75)  return 'alerta';
  if (pct < 95)  return 'normal';
  return 'optimo';
}

export default function EditarEquipoModal({ equipo, open, onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({});

  useEffect(() => {
    if (equipo) setForm({ ...equipo });
  }, [equipo]);

  const set = (key, val) => {
    setForm(prev => {
      const next = { ...prev, [key]: val };
      // Recalcular derivados automáticamente
      const total = Number(key === 'cantidad_total'    ? val : next.cantidad_total)    || 0;
      const func  = Number(key === 'cantidad_funciona' ? val : next.cantidad_funciona) || 0;
      const noFunc = Math.max(0, total - func);
      const pct    = total > 0 ? Math.round((func / total) * 100) : 0;
      return { ...next, cantidad_no_funciona: noFunc, porcentaje_operativo: pct, estado: calcEstado(pct) };
    });
  };

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.EquipamientoCalefaccion.update(equipo.id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['calefaccion'] }); onClose(); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => base44.entities.EquipamientoCalefaccion.delete(equipo.id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['calefaccion'] }); onClose(); },
  });

  if (!equipo) return null;

  const estadoColors = { critico: 'text-red-400', alerta: 'text-orange-400', normal: 'text-blue-400', optimo: 'text-emerald-400' };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">Editar Equipamiento</DialogTitle>
          <p className="text-xs text-slate-400 truncate">{equipo.escuela} · {TIPO_LABELS[equipo.tipo_equipo] || equipo.tipo_equipo}</p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tipo */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400 uppercase">Tipo de Equipo</label>
            <Select value={form.tipo_equipo} onValueChange={v => set('tipo_equipo', v)}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white text-sm h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cantidades */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase">Total</label>
              <Input
                type="number" min="0"
                value={form.cantidad_total ?? ''}
                onChange={e => set('cantidad_total', e.target.value)}
                className="bg-slate-800 border-slate-700 text-white h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase">Funcionando</label>
              <Input
                type="number" min="0"
                value={form.cantidad_funciona ?? ''}
                onChange={e => set('cantidad_funciona', e.target.value)}
                className="bg-slate-800 border-slate-700 text-white h-9 text-sm"
              />
            </div>
          </div>

          {/* Calculados (lectura) */}
          <div className="grid grid-cols-3 gap-2 text-center bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
            <div>
              <p className="text-xs text-slate-500">Con falla</p>
              <p className="text-sm font-bold text-red-400">{form.cantidad_no_funciona ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">% operativo</p>
              <p className="text-sm font-bold text-white">{form.porcentaje_operativo ?? 0}%</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Estado</p>
              <p className={`text-sm font-bold capitalize ${estadoColors[form.estado] || 'text-slate-300'}`}>{form.estado}</p>
            </div>
          </div>

          {/* Periodo y observaciones */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400 uppercase">Período</label>
            <Input
              value={form.periodo ?? ''}
              onChange={e => set('periodo', e.target.value)}
              placeholder="ej: Mayo 2026"
              className="bg-slate-800 border-slate-700 text-white h-9 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400 uppercase">Observaciones</label>
            <Input
              value={form.observaciones ?? ''}
              onChange={e => set('observaciones', e.target.value)}
              placeholder="Notas adicionales..."
              className="bg-slate-800 border-slate-700 text-white h-9 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { if (confirm('¿Eliminar este registro?')) deleteMutation.mutate(); }}
            disabled={deleteMutation.isPending}
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" /> Eliminar
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="border-slate-700 bg-transparent text-slate-300">
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => saveMutation.mutate(form)}
              disabled={saveMutation.isPending}
              className="gap-1.5 bg-orange-500 hover:bg-orange-600 text-white"
            >
              <Save className="h-3.5 w-3.5" />
              {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}