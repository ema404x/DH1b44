import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

/**
 * Devuelve cuántas solicitudes de certificado están esperando aprobación
 * (estado 'enviada' o 'en_revision'). Solo relevante para admins.
 * Una sola query para minimizar requests — filtra en cliente.
 */
export function useAprobacionPendientes() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const { data: all = [] } = useQuery({
    queryKey: ['solicitudes-cert-badge'],
    queryFn: () => base44.entities.SolicitudCertificado.list('-created_date', 200),
    enabled: isAdmin,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const total = isAdmin
    ? all.filter(s => s.estado === 'enviada' || s.estado === 'en_revision').length
    : 0;

  return { pendientesAprobacion: total };
}