import { useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { tieneArranqueRapido, useArranqueEstado, estadoDe } from '@/lib/arranqueRapido';
import { verificarArranque } from '@/lib/arranqueVerificacion';
import { buenaConexion, tomarTurnoHoy, reportarDiferencias, datosUsuario } from '@/lib/optimizaciones';

// Administradores con Arranque rápido encendido: lanza la verificación en
// segundo plano (una vez por sesión) y devuelve su resultado para el indicador.
// Resto de los usuarios: la misma verificación, silenciosa, como máximo una
// vez por día; nunca devuelve nada para mostrar.
export function useArranqueVerificacion() {
  const { user, offlineMode } = useAuth();
  const { employeeRole, employeeSector } = useCurrentUser();
  const estado = useArranqueEstado();
  const encendido = tieneArranqueRapido(user) && !offlineMode;
  const esAdmin = user?.role === 'admin';
  const activo = esAdmin && encendido;

  useEffect(() => {
    if (!activo) return;
    const t = setTimeout(() => verificarArranque({ user }), 6000);
    return () => clearTimeout(t);
  }, [activo, user?.id]);

  useEffect(() => {
    if (!encendido || esAdmin || !user?.id) return undefined;
    const t = setTimeout(async () => {
      if (!buenaConexion() || !tomarTurnoHoy(user.id, 'arranque')) return;
      const antes = estadoDe(user.id).diferencias.length;
      await verificarArranque({ user });
      reportarDiferencias(
        datosUsuario(user, employeeRole, employeeSector),
        'arranque',
        estadoDe(user.id).diferencias.slice(antes),
      );
    }, 20000);
    return () => clearTimeout(t);
  }, [encendido, esAdmin, user?.id]);

  if (!activo || estado.userId !== user.id) return null;
  if (estado.diferencias.length > 0) return { estado: 'diferencias', diferencias: estado.diferencias };
  if (Object.keys(estado.hechos).length > 0) return { estado: 'ok', diferencias: [] };
  return null;
}