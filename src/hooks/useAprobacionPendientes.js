import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePermission } from '@/hooks/usePermission';

/**
 * Devuelve cuántas solicitudes de certificado están esperando aprobación
 * (estado 'enviada' o 'en_revision'). Visible para cualquier usuario con
 * permiso de lectura en AprobacionCertificados (admins y gerentes).
 */
export function useAprobacionPendientes() {
  const { allowed: canView } = usePermission('AprobacionCertificados', 'read');

  const { data: all = [] } = useQuery({
    queryKey: ['solicitudes-cert-badge'],
    queryFn: () => base44.entities.SolicitudCertificado.list('-created_date', 200),
    enabled: canView,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const total = canView
    ? all.filter(s => s.estado === 'enviada' || s.estado === 'en_revision').length
    : 0;

  return { pendientesAprobacion: total };
}