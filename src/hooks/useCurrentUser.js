import { useContext } from 'react';
import { AuthContext } from '@/lib/AuthContext';
import { resolveDisplayName } from '@/lib/utils';
import { queryClientInstance } from '@/lib/query-client';
import { isAdminLevelRole, isFieldRole, canSwitchSector } from '@/lib/roles';

/**
 * Hook que retorna el usuario actual y helpers de permisos.
 * Reutiliza el AuthContext — sin hacer llamadas API duplicadas.
 *
 * isAdmin:      true solo si el rol de la plataforma es 'admin' Y el rol de empleado
 *               NO es 'jefe_sitio', 'inspector', 'tecnico' u otro rol de campo.
 *               Los admins de plataforma vinculados como jefe_sitio ven solo sus datos.
 * isSuperAdmin: true si el rol de plataforma es 'admin' Y no tiene rol de empleado de campo.
 */
export function useCurrentUser() {
  const { user: currentUser, userPermissions, isLoadingAuth: loading } = useContext(AuthContext);

  // Rol y nombre del empleado vinculado (viene de AuthContext vía vincularEmpleado)
  const employeeRole = userPermissions?._employeeRole || null;
  // Nombre del empleado configurado en el módulo de Empleados (tiene prioridad sobre full_name de plataforma)
  const employeeName = userPermissions?._employeeName || null;
  // Sector/unidad de negocio del empleado (aislamiento de datos entre sectores)
  // Fail-closed: NUNCA defaultear a 'escuela'. Si el sector no está resuelto,
  // devolver null para que getActiveSectorId/withActiveSector no estampen un
  // sector equivocado en silencio (bug histórico: empleados BAPRO creados en escuela).
  const employeeSector = userPermissions?._employeeSector || null;
  // Nombre a mostrar: nombre en ficha de empleado > nombre de plataforma
  const displayName = employeeName || currentUser?.full_name || currentUser?.email || 'Usuario';

  // Es "super admin" si:
  // 1. Tiene role=admin en la plataforma y NO tiene rol de campo, O
  // 2. Tiene un rol de empleado con visibilidad total
  // (Definiciones centralizadas en @/lib/roles — espejo de base44/shared/roles.ts)
  const isSuperAdmin = 
    (currentUser?.role === 'admin' && !isFieldRole(employeeRole)) ||
    currentUser?.role === 'gerente' ||
    isAdminLevelRole(employeeRole);

  // Alias para compatibilidad — si es superAdmin se llama "admin"
  const isAdmin = isSuperAdmin;

  /**
   * Filtro client-side de aislamiento por sector. NO aplica ownership: la
   * visibilidad real (created_by_id, jefe_sitio, establecimientos asignados,
   * admin_view) la define el backend en las funciones get*ForUser — este helper
   * solo restringe por sector_id como red de seguridad. Los argumentos extra
   * (fields) se ignoran por compatibilidad con llamadas legacy.
   */
  function filterByUser(list) {
    if (!currentUser) return list;

    // Aislar por sector_id — un admin en sector BAPRO no debe ver registros del sector escuela.
    // data.sector_id es el campo CANÓNICO que lee la RLS ({{user.data.sector_id}}).
    // El top-level sector_id es legacy y puede quedar desincronizado — nunca priorizarlo.
    const userSector = currentUser?.data?.sector_id || currentUser?.sector_id || employeeSector || 'escuela';
    return list.filter(item => {
      const itemSector = item.sector_id || 'escuela';
      return itemSector === userSector;
    });
  }

  /**
   * Resuelve cualquier string (nombre o email) al nombre real del empleado.
   * Usa el cache de React Query de 'employees' para la búsqueda — sin llamadas API.
   * Si el string no es un email, lo retorna tal cual.
   *
   * @param {string} nameOrEmail
   * @param {string} [fallback]
   * @returns {string}
   */
  function resolveUserName(nameOrEmail, fallback) {
    const employees = queryClientInstance.getQueryData(['employees']) || [];
    return resolveDisplayName(nameOrEmail, employees, fallback);
  }

  return {
    currentUser,
    user: currentUser,
    isAdmin,
    isSuperAdmin,
    employeeRole,
    employeeName,
    employeeSector,
    displayName,
    loading,
    filterByUser,
    userPermissions,
    resolveUserName,
    canSwitchSector: canSwitchSector(currentUser?.role, employeeRole),
  };
}