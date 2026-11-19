import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { puedeVerPropuestas, resolverPropuesta } from '@/lib/propuestasOT';

/** Conteo de propuestas por estado (solo para quien puede revisarlas). */
export function usePropuestasPendientes() {
  const { user, userPermissions } = useAuth();
  const puede = puedeVerPropuestas(user, userPermissions);
  const { data } = useQuery({
    queryKey: ['propuestas-ot-contar'],
    queryFn: () => resolverPropuesta({ action: 'contar' }),
    enabled: puede,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: false,
  });
  return { puede, enviadas: puede ? data?.enviada ?? 0 : 0, conteos: data };
}