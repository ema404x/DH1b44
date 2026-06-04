import { useContext } from 'react';
import { AuthContext } from '@/lib/AuthContext';

/**
 * Retorna si el usuario actual tiene permiso para una acción en un módulo.
 * Los admins de plataforma (user.role === 'admin') siempre tienen acceso total.
 *
 * @param {string} moduleKey - Clave del módulo (ej: 'WorkOrder', 'Certificado')
 * @param {string} action - Acción a verificar: 'read' | 'create' | 'update' | 'delete' | 'export' | 'approve'
 * @returns {{ allowed: boolean, loading: boolean }}
 */
export function usePermission(moduleKey, action = 'read') {
  const { user, userPermissions, isLoadingAuth } = useContext(AuthContext);

  if (isLoadingAuth) return { allowed: false, loading: true };

  // Los admins de plataforma tienen acceso total
  if (user?.role === 'admin') return { allowed: true, loading: false };

  // Si no hay permisos cargados y auth aún está cargando → esperar
  // Si auth ya terminó pero no hay permisos (vinculación falló), denegar sin bloquearse
  if (userPermissions === null) return { allowed: false, loading: false };

  // Sin permisos configurados para este usuario → denegar
  if (!moduleKey) {
    return { allowed: false, loading: false };
  }

  const allowed = userPermissions?.[moduleKey]?.[action] === true;
  return { allowed, loading: false };
}