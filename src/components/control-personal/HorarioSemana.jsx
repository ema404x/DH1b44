import React from 'react';
import { Copy } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const SEMANA = [
  { key: 'lun', label: 'Lunes' }, { key: 'mar', label: 'Martes' }, { key: 'mie', label: 'Miércoles' },
  { key: 'jue', label: 'Jueves' }, { key: 'vie', label: 'Viernes' }, { key: 'sab', label: 'Sábado' }, { key: 'dom', label: 'Domingo' },
];

// Tabla lunes a domingo: laborable + entrada + salida por día.
function HorarioSemana({ value, onChange, disabled }) {
  const setDia = (k, patch) => onChange({ ...value, [k]: { ...value[k], ...patch } });
  const copiar = (k) => {
    const { hora_entrada, hora_salida } = value[k];
    onChange(Object.fromEntries(SEMANA.map((d) => [d.key, d.key === k ? value[k] : { ...value[d.key], hora_entrada, hora_salida }])));
  };
  return (
    <div className="rounded-xl border border-border/60 divide-y divide-border/40 overflow-hidden">
      {SEMANA.map((d) => {
        const v = value[d.key] || {};
        return (
          <div key={d.key} className={cn('flex flex-wrap items-center gap-3 px-3 py-2.5', !v.laborable && 'bg-muted/30')}>
            <div className="flex items-center gap-3 w-36 shrink-0">
              <Switch checked={!!v.laborable} onCheckedChange={(c) => setDia(d.key, { laborable: c })} disabled={disabled} aria-label={`Laborable ${d.label}`} />
              <span className={cn('text-sm font-medium', !v.laborable && 'text-muted-foreground')}>{d.label}</span>
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-[220px]">
              <Input type="time" value={v.hora_entrada || ''} disabled={disabled || !v.laborable} onChange={(e) => setDia(d.key, { hora_entrada: e.target.value })} className="h-10" aria-label={`Entrada ${d.label}`} />
              <span className="text-muted-foreground text-sm">a</span>
              <Input type="time" value={v.hora_salida || ''} disabled={disabled || !v.laborable} onChange={(e) => setDia(d.key, { hora_salida: e.target.value })} className="h-10" aria-label={`Salida ${d.label}`} />
            </div>
            {!disabled && (
              <Button type="button" variant="ghost" size="sm" onClick={() => copiar(d.key)} disabled={!v.laborable} className="gap-1.5 text-xs text-muted-foreground">
                <Copy className="h-3.5 w-3.5" /> Copiar a los demás días
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default React.memo(HorarioSemana);