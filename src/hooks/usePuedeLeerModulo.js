import { useAuth } from '@/lib/AuthContext';
import { hasModulePermission } from '@/lib/roles';

/** Mismo criterio que el menú: admin, o permiso de lectura del módulo. */
export function usePuedeLeerModulo(moduleKey) {
  const { user, userPermissions } = useAuth();
  if (user?.role === 'admin') return true;
  if (!userPermissions) return false;
  return hasModulePermission(userPermissions[moduleKey], 'read', moduleKey, userPermissions._employeeRole);
}