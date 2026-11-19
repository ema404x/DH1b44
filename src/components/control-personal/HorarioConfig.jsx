import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { controlPersonal } from './api';
import EstadoCarga from './EstadoCarga';
import HorarioSemana, { SEMANA } from './HorarioSemana';

const dia = (laborable, hora_entrada, hora_salida) => ({ laborable, hora_entrada, hora_salida });
const POR_DEFECTO = {
  lun: dia(true, '08:00', '17:30'), mar: dia(true, '08:00', '17:30'), mie: dia(true, '08:00', '17:30'),
  jue: dia(true, '08:00', '17:30'), vie: dia(true, '08:00', '16:30'), sab: dia(false, '08:00', '17:30'), dom: dia(false, '08:00', '17:30'),
};

// Si el sector todavía usa el horario único, se arma la semana con esos valores.
function semanaDesde(h) {
  if (!h) return POR_DEFECTO;
  if (h.horarios_por_dia) return Object.fromEntries(SEMANA.map((d) => [d.key, { ...POR_DEFECTO[d.key], ...h.horarios_por_dia[d.key] }]));
  return Object.fromEntries(SEMANA.map((d) => [d.key, dia((h.dias_laborales || []).includes(d.key), h.hora_entrada, h.hora_salida)]));
}

const formDesde = (h) => ({
  horarios_por_dia: semanaDesde(h),
  tolerancia_minutos: h?.tolerancia_minutos ?? 10,
  activo: h?.activo ?? true,
});
// Firma estable del horario guardado: solo cambia si cambia el registro en el servidor.
const firmaDe = (h) => (h ? `${h.id}|${h.updated_date || ''}` : '');

export default function HorarioConfig() {
  const qc = useQueryClient();
  const queryKey = ['control-personal', 'horario'];
  // Inicialización perezosa: se calcula una sola vez (desde la caché si ya está).
  const [form, setForm] = useState(() => formDesde(qc.getQueryData(queryKey)?.horario));
  const { data, isLoading, error } = useQuery({ queryKey, queryFn: () => controlPersonal('horario') });
  const firma = firmaDe(data?.horario);
  const ultimaFirma = useRef(firmaDe(qc.getQueryData(queryKey)?.horario));
  useEffect(() => {
    // Dependencia primitiva (string): solo re-inicializa si llega un horario distinto.
    if (!firma || firma === ultimaFirma.current) return;
    ultimaFirma.current = firma;
    setForm(formDesde(data.horario));
  }, [firma]); // eslint-disable-line react-hooks/exhaustive-deps
  const setSemana = useCallback((v) => setForm((f) => ({ ...f, horarios_por_dia: v })), []);
  const guardar = useMutation({
    mutationFn: () => controlPersonal('guardarHorario', form),
    onSuccess: () => { toast.success('Horario guardado'); qc.invalidateQueries({ queryKey: ['control-personal'] }); },
    onError: (e) => toast.error(e?.response?.data?.error || e?.message || 'No se pudo guardar'),
  });

  if (isLoading || error) return <EstadoCarga error={error} />;
  const ro = !data.puedeEditar;
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="max-w-3xl rounded-2xl border border-border/60 bg-card p-5 space-y-5">
      <div>
        <h3 className="text-base font-semibold">Horario del sector por día</h3>
        <p className="text-sm text-muted-foreground mt-0.5">Se usa para calcular llegadas tarde, ausencias y salidas anticipadas (hora de Argentina).</p>
        {!data.horario && <p className="text-xs text-amber-400 mt-2">Todavía no hay horario cargado: no se calculan tardanzas ni ausencias.</p>}
        {ro && <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Solo admin y gerente pueden editarlo.</p>}
      </div>
      <HorarioSemana value={form.horarios_por_dia} onChange={setSemana} disabled={ro} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tolerancia general (min)</p>
          <Input type="number" min={0} max={240} value={form.tolerancia_minutos} disabled={ro} onChange={(e) => set('tolerancia_minutos')(e.target.value)} className="h-11" />
        </div>
        <label className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-4 py-3 self-end">
          <span className="text-sm">Horario activo</span>
          <Switch checked={form.activo} onCheckedChange={set('activo')} disabled={ro} />
        </label>
      </div>
      {!ro && (
        <Button onClick={() => guardar.mutate()} disabled={guardar.isPending} className="gap-2 h-11">
          {guardar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar horario
        </Button>
      )}
    </div>
  );
}