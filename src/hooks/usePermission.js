import { useContext } from 'react';
import { AuthContext } from '@/lib/AuthContext';
import { hasModulePermission } from '@/lib/roles';

/**
 * Retorna si el usuario actual tiene permiso para una acción en un módulo.
 * Los admins de plataforma (user.role === 'admin') siempre tienen acceso total.
 *
 * @param {string} moduleKey - Clave del módulo (ej: 'WorkOrder', 'Certificado')
 * @param {string} action - Acción a verificar: 'read' | 'create' | 'update' | 'delete' | 'export' | 'approve' | 'admin_view'
 * @returns {{ allowed: boolean, loading: boolean }}
 */
export function usePermission(moduleKey, action = 'read') {
  const { user, userPermissions, isLoadingAuth, vinculationFailed } = useContext(AuthContext);

  if (isLoadingAuth) return { allowed: false, loading: true };

  // Los admins de plataforma tienen acceso total
  if (user?.role === 'admin') return { allowed: true, loading: false, vinculationFailed: false };

  // Si la vinculación falló (timeout/error de red), la UI ofrece reintentar
  // en lugar de mostrar "acceso denegado" — el usuario podría tener permisos válidos
  if (vinculationFailed) return { allowed: false, loading: false, vinculationFailed: true };

  // Estado inconsistente: auth terminó, no hubo error de red, pero los permisos
  // nunca llegaron. Conceder acceso mínimo al Dashboard para no bloquear al usuario.
  // El reintento en background completará los permisos reales.
  if (userPermissions === null) {
    if (moduleKey === 'Dashboard') return { allowed: true, loading: false, vinculationFailed: false };
    return { allowed: false, loading: false, vinculationFailed: false };
  }

  // Sin permisos configurados para este usuario → denegar
  if (!moduleKey) {
    return { allowed: false, loading: false, vinculationFailed: false };
  }

  const allowed = hasModulePermission(userPermissions?.[moduleKey], action);
  return { allowed, loading: false, vinculationFailed: false };
}