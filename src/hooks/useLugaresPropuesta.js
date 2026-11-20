import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUbicaciones } from '@/hooks/useUbicaciones';
import { useVeTodosLosActivos, fetchActivosPropios } from '@/hooks/useActivosVisibles';

/**
 * Activos y ubicaciones para elegir dónde va una propuesta. Activos con la
 * misma fuente que CrearOT (escuela por servidor; el resto con la lista normal).
 */
export function useLugaresPropuesta() {
  const { employeeSector } = useCurrentUser();
  const veTodo = useVeTodosLosActivos();
  // Servidor (regla de visibilidad) para escuela y para todo usuario que no es admin/gerente.
  const usaServidor = employeeSector === 'escuela' || !veTodo;
  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['assets-ot-select', usaServidor ? 'escuela-resolver' : 'rls', veTodo ? 'todo' : 'propios'],
    queryFn: usaServidor ? fetchActivosPropios : () => base44.entities.Asset.list('-name', 500),
    staleTime: 120000,
  });
  const { locationQRs, isLoading: loadingLoc } = useUbicaciones();

  const lugares = [
    ...assets.map((a) => ({ tipo: 'asset', id: a.id, nombre: a.name, detalle: [a.sede, a.area].filter(Boolean).join(' · ') })),
    ...locationQRs.filter((l) => l.is_active !== false).map((l) => ({ tipo: 'loc', id: l.id, nombre: l.name, detalle: l.address || '' })),
  ];
  return { lugares, isLoading: isLoading || loadingLoc };
}