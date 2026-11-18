import { useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { tieneArranqueRapido, useArranqueEstado } from '@/lib/arranqueRapido';
import { verificarArranque } from '@/lib/arranqueVerificacion';

// Solo administradores con Arranque rápido encendido: lanza la verificación
// en segundo plano y devuelve su resultado para el indicador.
export function useArranqueVerificacion() {
  const { user, offlineMode } = useAuth();
  const estado = useArranqueEstado();
  const activo = user?.role === 'admin' && tieneArranqueRapido(user) && !offlineMode;

  useEffect(() => {
    if (!activo) return;
    const t = setTimeout(() => verificarArranque({ user }), 6000);
    return () => clearTimeout(t);
  }, [activo, user?.id]);

  if (!activo || estado.userId !== user.id) return null;
  if (estado.diferencias.length > 0) return { estado: 'diferencias', diferencias: estado.diferencias };
  if (Object.keys(estado.hechos).length > 0) return { estado: 'ok', diferencias: [] };
  return null;
}