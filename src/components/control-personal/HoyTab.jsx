import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { controlPersonal } from './api';
import { fechaLarga } from './formato';
import EstadoCarga from './EstadoCarga';
import SinHorarioAviso from './SinHorarioAviso';
import HoyContadores from './HoyContadores';
import HoyLista from './HoyLista';

export default function HoyTab({ onConfigurarHorario }) {
  const [filtro, setFiltro] = useState('enLugar');
  const { data, isLoading, error, isFetching, refetch } = useQuery({
    queryKey: ['control-personal', 'hoy'],
    queryFn: () => controlPersonal('hoy'),
    refetchInterval: 60000,
    staleTime: 30000,
  });
  if (isLoading || error) return <EstadoCarga error={error} />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground first-letter:uppercase">
          {fechaLarga(data.fecha)}
          {data.horario && (data.horarioHoy || !data.horario.horarios_por_dia) && ` · Horario ${(data.horarioHoy || data.horario).hora_entrada} a ${(data.horarioHoy || data.horario).hora_salida} (tolerancia ${data.horario.tolerancia_minutos} min)`}
          {data.horario && !data.laboral && ' · Hoy no es día laboral'}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
          <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} /> Actualizar
        </Button>
      </div>
      {!data.horario && <SinHorarioAviso onConfigurar={onConfigurarHorario} />}
      <HoyContadores contadores={data.contadores} sinHorario={!data.horario} activo={filtro} onSelect={setFiltro} />
      <HoyLista data={data} filtro={filtro} />
    </div>
  );
}