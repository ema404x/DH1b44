import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePermission } from '@/hooks/usePermission';

/**
 * Devuelve cuántas solicitudes de certificado están esperando aprobación
 * (estado 'enviada' o 'en_revision'). Usa la función backend para evitar
 * el bloqueo de RLS en usuarios con rol de plataforma 'user' (gerentes).
 */
export function useAprobacionPendientes() {
  const { allowed: canView } = usePermission('AprobacionCertificados', 'read');

  const { data } = useQuery({
    queryKey: ['solicitudes-cert-badge'],
    queryFn: async () => {
      const res = await base44.functions.invoke('gestionarSolicitudesCert', { operation: 'list' });
      return res.data;
    },
    enabled: canView,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const all = data?.solicitudes || [];
  const total = canView
    ? all.filter(s => s.estado === 'enviada' || s.estado === 'en_revision').length
    : 0;

  return { pendientesAprobacion: total };
}