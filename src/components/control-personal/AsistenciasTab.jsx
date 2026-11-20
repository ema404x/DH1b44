import React, { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AsistenciasPanel from '@/components/mapa/AsistenciasPanel';
import { controlPersonal } from './api';
import EstadoCarga from './EstadoCarga';

// Mismo panel de Asistencias del Mapa, pero leyendo y revisando por servidor
// (limitado a lo que el usuario puede ver).
export default function AsistenciasTab() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['control-personal', 'lugares'],
    queryFn: () => controlPersonal('lugares'),
    staleTime: 60000,
  });
  const fetchPage = useCallback((query, opts) => controlPersonal('fichajes', { query, ...opts }), []);
  const onSaveRevision = useCallback(async (id, payload) => {
    await controlPersonal('revisar', { id, ...payload });
    qc.invalidateQueries({ queryKey: ['control-personal'] });
  }, [qc]);

  if (isLoading || error) return <EstadoCarga error={error} />;
  return <AsistenciasPanel locations={data.lugares} fetchPage={fetchPage} onSaveRevision={onSaveRevision} tarjetasEnMovil />;
}