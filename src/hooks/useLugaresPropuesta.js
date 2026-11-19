import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUbicaciones } from '@/hooks/useUbicaciones';

/**
 * Activos y ubicaciones para elegir dónde va una propuesta. Activos con la
 * misma fuente que CrearOT (escuela por servidor; el resto con la lista normal).
 */
export function useLugaresPropuesta() {
  const { employeeSector } = useCurrentUser();
  const isEscuela = employeeSector === 'escuela';
  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['assets-ot-select', isEscuela ? 'escuela-resolver' : 'rls'],
    queryFn: isEscuela
      ? async () => (await base44.functions.invoke('getActivosSector')).data?.assets || []
      : () => base44.entities.Asset.list('-name', 500),
    staleTime: 120000,
  });
  const { locationQRs, isLoading: loadingLoc } = useUbicaciones();

  const lugares = [
    ...assets.map((a) => ({ tipo: 'asset', id: a.id, nombre: a.name, detalle: [a.sede, a.area].filter(Boolean).join(' · ') })),
    ...locationQRs.filter((l) => l.is_active !== false).map((l) => ({ tipo: 'loc', id: l.id, nombre: l.name, detalle: l.address || '' })),
  ];
  return { lugares, isLoading: isLoading || loadingLoc };
}