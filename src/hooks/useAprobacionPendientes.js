import { useContext, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePermission } from '@/hooks/usePermission';
import { AuthContext } from '@/lib/AuthContext';
import { useUsaRapido, marcarFallback } from '@/lib/arranqueRapido';

/**
 * Devuelve cuántas solicitudes de certificado están esperando aprobación
 * (estado 'enviada' o 'en_revision'). Usa la función backend para evitar
 * el bloqueo de RLS en usuarios con rol de plataforma 'user' (gerentes).
 *
 * Arranque rápido (beta): con el interruptor encendido pide solo el número
 * (contarSolicitudesPendientes). Apagado, la consulta es la de siempre.
 */
export function useAprobacionPendientes() {
  const { allowed: canView } = usePermission('AprobacionCertificados', 'read');
  const { user } = useContext(AuthContext);
  const rapido = useUsaRapido(user, 'contador');

  const { data } = useQuery({
    queryKey: ['solicitudes-cert-badge'],
    queryFn: async () => {
      const res = await base44.functions.invoke('gestionarSolicitudesCert', { operation: 'list' });
      return res.data;
    },
    enabled: canView && !rapido,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const contador = useQuery({
    queryKey: ['solicitudes-cert-contador'],
    queryFn: async () => {
      const res = await base44.functions.invoke('contarSolicitudesPendientes', {});
      if (typeof res.data?.pendientes !== 'number') throw new Error('Contador no disponible');
      return res.data.pendientes;
    },
    enabled: canView && rapido,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // Si el contador nuevo falla, la insignia vuelve a la consulta de siempre.
  useEffect(() => {
    if (rapido && contador.isError) marcarFallback(user.id, 'contador');
  }, [rapido, contador.isError, user?.id]);

  if (rapido) return { pendientesAprobacion: canView ? contador.data ?? 0 : 0 };

  const all = data?.solicitudes || [];
  const total = canView
    ? all.filter(s => s.estado === 'enviada' || s.estado === 'en_revision').length
    : 0;

  return { pendientesAprobacion: total };
}