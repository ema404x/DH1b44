import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { desdeHace7Dias } from '@/lib/optimizaciones';

// Solo administradores: total de diferencias que registró la verificación
// silenciosa de los demás usuarios en los últimos 7 días.
export default function VerificacionesResumen({ onVer }) {
  const desde = useMemo(desdeHace7Dias, []);
  const { data } = useQuery({
    queryKey: ['verificaciones-optimizacion-resumen'],
    queryFn: async () => {
      const { rows } = await base44.entities.VerificacionOptimizacion.aggregate({
        query: { fecha: { $gte: desde } },
        groupBy: 'mejora',
        sum: ['cantidad_diferencias'],
      });
      return (rows || []).reduce((s, r) => s + (r.sum_cantidad_diferencias || 0), 0);
    },
    staleTime: 60000,
  });

  const resumen = data === undefined
    ? '…'
    : data > 0
      ? `${data} diferencia${data !== 1 ? 's' : ''} en los últimos 7 días`
      : 'sin diferencias';

  return (
    <button
      onClick={onVer}
      className={`w-full flex items-start gap-1.5 px-3 pb-2 text-left text-[11px] transition-colors ${
        data > 0 ? 'font-semibold text-amber-400 hover:text-amber-300' : 'text-muted-foreground hover:text-popover-foreground'
      }`}
    >
      <ClipboardCheck className="h-3.5 w-3.5 mt-px flex-shrink-0" />
      <span>Verificaciones de otros usuarios: {resumen}</span>
    </button>
  );
}