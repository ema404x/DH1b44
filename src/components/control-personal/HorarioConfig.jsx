import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { controlPersonal } from './api';
import EstadoCarga from './EstadoCarga';
import DiasSelector from './DiasSelector';

const VACIO = { hora_entrada: '08:00', hora_salida: '17:00', dias_laborales: ['lun', 'mar', 'mie', 'jue', 'vie'], tolerancia_minutos: 10, activo: true };

export default function HorarioConfig() {
  const qc = useQueryClient();
  const [form, setForm] = useState(VACIO);
  const { data, isLoading, error } = useQuery({ queryKey: ['control-personal', 'horario'], queryFn: () => controlPersonal('horario') });
  useEffect(() => { if (data?.horario) setForm({ ...VACIO, ...data.horario }); }, [data]);
  const guardar = useMutation({
    mutationFn: () => controlPersonal('guardarHorario', form),
    onSuccess: () => { toast.success('Horario guardado'); qc.invalidateQueries({ queryKey: ['control-personal'] }); },
    onError: (e) => toast.error(e?.response?.data?.error || e?.message || 'No se pudo guardar'),
  });

  if (isLoading || error) return <EstadoCarga error={error} />;
  const ro = !data.puedeEditar;
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="max-w-2xl rounded-2xl border border-border/60 bg-card p-5 space-y-5">
      <div>
        <h3 className="text-base font-semibold">Horario general del sector</h3>
        <p className="text-sm text-muted-foreground mt-0.5">Se usa para calcular llegadas tarde y ausencias (hora de Argentina).</p>
        {!data.horario && <p className="text-xs text-amber-400 mt-2">Todavía no hay horario cargado: no se calculan tardanzas ni ausencias.</p>}
        {ro && <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Solo admin y gerente pueden editarlo.</p>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Campo label="Entrada"><Input type="time" value={form.hora_entrada} disabled={ro} onChange={(e) => set('hora_entrada')(e.target.value)} className="h-11" /></Campo>
        <Campo label="Salida"><Input type="time" value={form.hora_salida} disabled={ro} onChange={(e) => set('hora_salida')(e.target.value)} className="h-11" /></Campo>
        <Campo label="Tolerancia (min)"><Input type="number" min={0} max={240} value={form.tolerancia_minutos} disabled={ro} onChange={(e) => set('tolerancia_minutos')(e.target.value)} className="h-11" /></Campo>
      </div>
      <Campo label="Días laborales"><DiasSelector value={form.dias_laborales} onChange={set('dias_laborales')} disabled={ro} /></Campo>
      <label className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-4 py-3">
        <span className="text-sm">Horario activo</span>
        <Switch checked={form.activo} onCheckedChange={set('activo')} disabled={ro} />
      </label>
      {!ro && (
        <Button onClick={() => guardar.mutate()} disabled={guardar.isPending} className="gap-2 h-11">
          {guardar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar horario
        </Button>
      )}
    </div>
  );
}

const Campo = ({ label, children }) => (
  <div className="space-y-1.5"><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>{children}</div>
);