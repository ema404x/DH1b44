import { useMemo } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { fetchAllList } from '@/lib/fetchAllList';
import { calcularResumenLegacy, compararResumenes } from '@/lib/panelRapidoLegacy';

const STALE_3MIN = 3 * 60 * 1000;
const STALE_5MIN = 5 * 60 * 1000;

/**
 * Panel rápido (beta). Con activo=false no hace NADA (ninguna consulta).
 *
 * Con activo=true pide getDashboardSummary para el filtro actual. Si además
 * esAdmin, una vez por sesión y por filtro pide en segundo plano los datos
 * completos de siempre, calcula el resumen "como hoy" y lo compara valor por
 * valor. Si algo difiere, `resumen` pasa a ser el del cálculo de siempre.
 */
export function usePanelRapido({ activo, scope, filters, esAdmin }) {
  const queryClient = useQueryClient();
  const { dateRange, jefeSitio, priority } = filters;
  const filtroKey = [scope ?? 'all', dateRange, jefeSitio, priority];
  const resumenKey = ['dashboard-summary', ...filtroKey];

  // Mismas consultas (clave y función) que usa hoy el Dashboard clásico.
  const dashQuery = {
    queryKey: ['dashboard-metrics', scope],
    queryFn: async () => (await base44.functions.invoke('getDashboardMetrics', { scope })).data,
  };
  const direccionesQuery = {
    queryKey: ['direcciones-jefes'],
    queryFn: () => fetchAllList('Direccion', '-created_date'),
  };
  const certsQuery = {
    queryKey: ['certificados-dash'],
    queryFn: () => base44.entities.Certificado.list('-created_date', 200),
  };

  const resumenQ = useQuery({
    queryKey: resumenKey,
    queryFn: async () => {
      const nowMs = Date.now();
      const { data } = await base44.functions.invoke('getDashboardSummary', {
        scope, dateRange, jefeSitio, priority, nowMs,
        tzOffsetMin: new Date().getTimezoneOffset(),
      });
      return {
        ...data,
        nowMs,
        jefesOptions: [...(data.jefesOptions || [])].sort((a, b) => a.localeCompare(b, 'es')),
      };
    },
    enabled: activo,
    staleTime: STALE_3MIN,
    retry: 1,
    placeholderData: keepPreviousData,
  });

  const resumenListo = activo && esAdmin && !!resumenQ.data
    && !resumenQ.isPlaceholderData && !resumenQ.isFetching;

  // Verificación: una vez por sesión y por filtro.
  const verifQ = useQuery({
    queryKey: ['panel-rapido-verificacion', ...filtroKey],
    queryFn: async () => {
      const nuevo = queryClient.getQueryData(resumenKey);
      const [dash, direcciones, certs] = await Promise.all([
        queryClient.fetchQuery({ ...dashQuery, staleTime: 30000 }),
        queryClient.fetchQuery({ ...direccionesQuery, staleTime: 30000 }),
        queryClient.fetchQuery({ ...certsQuery, staleTime: 30000 }),
      ]);
      const viejo = calcularResumenLegacy({ dash, direcciones, certs }, { dateRange, jefeSitio, priority }, nuevo.nowMs);
      return { diferencias: compararResumenes(viejo, nuevo) };
    },
    enabled: resumenListo,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  // Con diferencias: se muestran los valores del cálculo de siempre, que se
  // mantiene al día con las consultas de siempre.
  const hayDiferencias = (verifQ.data?.diferencias?.length || 0) > 0;
  const usarViejo = activo && hayDiferencias;
  const dashQ = useQuery({ ...dashQuery, staleTime: STALE_3MIN, retry: 1, enabled: usarViejo });
  const dirQ = useQuery({ ...direccionesQuery, staleTime: STALE_5MIN, enabled: usarViejo });
  const certQ = useQuery({ ...certsQuery, staleTime: STALE_5MIN, enabled: usarViejo });
  const viejo = useMemo(() => {
    if (!usarViejo || !dashQ.data) return null;
    return calcularResumenLegacy(
      { dash: dashQ.data, direcciones: dirQ.data || [], certs: certQ.data || [] },
      { dateRange, jefeSitio, priority },
      Date.now(),
    );
  }, [usarViejo, dashQ.data, dirQ.data, certQ.data, dateRange, jefeSitio, priority]);

  let verificacion = null;
  if (activo && esAdmin && resumenQ.data) {
    if (verifQ.isError) verificacion = { estado: 'error', diferencias: [] };
    else if (!verifQ.data) verificacion = { estado: 'verificando', diferencias: [] };
    else verificacion = { estado: hayDiferencias ? 'diferencias' : 'ok', diferencias: verifQ.data.diferencias };
  }

  return {
    resumen: !activo ? null : (usarViejo && viejo) ? viejo : (resumenQ.data || null),
    cargando: activo && (resumenQ.isLoading || resumenQ.isPlaceholderData),
    // Si el resumen no se puede pedir, el Dashboard vuelve solo al camino de siempre.
    fallo: activo && resumenQ.isError,
    verificacion,
  };
}