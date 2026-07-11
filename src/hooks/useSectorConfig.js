import { useContext } from 'react';
import { AuthContext } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Hook que retorna la configuración del sector actual.
 * Permite adaptar terminología y entidades según el sector (ej: BAPRO mide por Activos, Escuela por Colegios).
 */
export function useSectorConfig() {
  const { user, userPermissions } = useContext(AuthContext);
  const employeeSector = userPermissions?._employeeSector || 'escuela';
  const sectorId = user?.sector_id || user?.data?.sector_id || employeeSector || 'escuela';

  const { data: sectores = [] } = useQuery({
    queryKey: ['sectores'],
    queryFn: () => base44.entities.Sector.list('orden', 100),
    staleTime: 300000,
  });

  const sector = sectores.find(s => s.clave === sectorId);
  const config = sector?.config || {};
  const unidad = config.unidad_medida || {
    singular: sectorId === 'bapro' ? 'Activo' : 'Escuela',
    plural: sectorId === 'bapro' ? 'Activos' : 'Escuelas',
    entidad: sectorId === 'bapro' ? 'Asset' : 'LocationData',
  };

  return {
    sectorId,
    sector,
    unidad,
    // Etiquetas listas para usar
    singular: unidad.singular,
    plural: unidad.plural,
    entidadMedicion: unidad.entidad,
    // Helper para pluralizar según cantidad
    label: (count) => count === 1 ? unidad.singular : unidad.plural,
  };
}