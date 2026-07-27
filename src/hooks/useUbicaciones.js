import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * useUbicaciones — hook compartido que trae todas las ubicaciones,
 * direcciones y QRs desde la función backend obtenerUbicaciones
 * (service role, sin RLS). Garantiza que TODOS los usuarios vean
 * el listado completo sin depender de su sector_id o rol.
 *
 * Retorna:
 *   locations   — LocationData con dirección real resuelta (join Direccion)
 *   direcciones — Lista cruda de Direccion
 *   locationQRs — Lista cruda de LocationQR
 *   isLoading   — true mientras carga
 */
export function useUbicaciones() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['ubicaciones-unificadas'],
    queryFn: async () => {
      const res = await base44.functions.invoke('obtenerUbicaciones', {});
      return res.data;
    },
    staleTime: 300_000, // 5 minutos
  });

  return {
    locations: data?.locations || [],
    direcciones: data?.direcciones || [],
    locationQRs: data?.locationQRs || [],
    isLoading,
    error,
    refetch,
  };
}