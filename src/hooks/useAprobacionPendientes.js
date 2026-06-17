import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

/**
 * Devuelve cuántas solicitudes de certificado están esperando aprobación
 * (estado 'enviada' o 'en_revision'). Solo relevante para superadmins/admins.
 */
export function useAprobacionPendientes() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const { data: solicitudes = [] } = useQuery({
    queryKey: ['solicitudes-cert-badge'],
    queryFn: () => base44.entities.SolicitudCertificado.filter({ estado: 'enviada' }),
    enabled: isAdmin,
    refetchInterval: 60_000, // refresca cada 60 segundos
    staleTime: 30_000,
  });

  const { data: enRevision = [] } = useQuery({
    queryKey: ['solicitudes-cert-badge-revision'],
    queryFn: () => base44.entities.SolicitudCertificado.filter({ estado: 'en_revision' }),
    enabled: isAdmin,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const total = solicitudes.length + enRevision.length;

  return { pendientesAprobacion: total };
}