import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import VacioModulo from '@/components/shared/VacioModulo';
import { PROPUESTAS_OT } from '@/lib/modulosNuevos';

const VACIO_TEXTO = {
  enviada: 'Cuando un operario proponga una OT desde su teléfono, aparece acá para que la revises.',
  aprobada: 'Las propuestas que apruebes se convierten en OT y quedan listadas acá.',
  rechazada: 'Las propuestas que rechaces quedan acá con el motivo.',
};
import PageHeader from '@/components/shared/PageHeader';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PropuestaCard from '@/components/propuestas/PropuestaCard';
import PropuestaDetalleDialog from '@/components/propuestas/PropuestaDetalleDialog';
import { ESTADOS, resolverPropuesta } from '@/lib/propuestasOT';
import { usePropuestasPendientes } from '@/hooks/usePropuestasPendientes';

export default function PropuestasOT() {
  const [estado, setEstado] = useState('enviada');
  const [seleccion, setSeleccion] = useState(null);
  const { conteos } = usePropuestasPendientes();

  const { data: propuestas = [], isLoading, isError, error } = useQuery({
    queryKey: ['propuestas-ot', estado],
    queryFn: async () => (await resolverPropuesta({ action: 'listar', estado })).solicitudes || [],
    staleTime: 20_000,
  });

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader icon={PROPUESTAS_OT.icon} title={PROPUESTAS_OT.label} subtitle="Revisá, editá y aprobá las OT que proponen los operarios" />

      <Tabs value={estado} onValueChange={setEstado} className="mb-4">
        <TabsList className="w-full grid grid-cols-3 h-11">
          {ESTADOS.map((e) => (
            <TabsTrigger key={e.key} value={e.key} className="text-xs sm:text-sm gap-1.5 h-9">
              {e.label}
              {typeof conteos?.[e.key] === 'number' && (
                <span className="tabular-nums text-[10px] font-bold opacity-80">{conteos[e.key]}</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : isError ? (
        <p className="text-sm text-destructive text-center py-12">{error?.message || 'No se pudieron cargar las propuestas'}</p>
      ) : propuestas.length === 0 ? (
        <VacioModulo
          icon={PROPUESTAS_OT.icon}
          titulo={`No hay propuestas ${ESTADOS.find((e) => e.key === estado)?.label.toLowerCase()}.`}
          texto={VACIO_TEXTO[estado]}
        />
      ) : (
        <div className="space-y-2">
          {propuestas.map((p) => (
            <PropuestaCard key={p.id} propuesta={p} onClick={() => setSeleccion(p)} />
          ))}
        </div>
      )}

      <PropuestaDetalleDialog
        propuesta={seleccion}
        open={!!seleccion}
        onOpenChange={(o) => !o && setSeleccion(null)}
        onUpdated={setSeleccion}
      />
    </div>
  );
}