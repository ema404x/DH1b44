import { useContext } from 'react';
import { AuthContext } from '@/lib/AuthContext';
import { resolveDisplayName } from '@/lib/utils';
import { queryClientInstance } from '@/lib/query-client';

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
  const employeeSector = userPermissions?._employeeSector || 'escuela';
  // Nombre a mostrar: nombre en ficha de empleado > nombre de plataforma
  const displayName = employeeName || currentUser?.full_name || currentUser?.email || 'Usuario';

  // Roles que deben ver solo sus propios datos
  const FIELD_ROLES = ['jefe_sitio', 'jefe de sitio', 'inspector', 'tecnico', 'supervisor'];

  // Roles de empleado que tienen visibilidad total (como admin)
  const ADMIN_EMPLOYEE_ROLES = ['administrativo', 'admin', 'gerente', 'gerencia'];

  // Es "super admin" si:
  // 1. Tiene role=admin en la plataforma y NO tiene rol de campo, O
  // 2. Tiene un rol de empleado con visibilidad total
  const isSuperAdmin = 
    (currentUser?.role === 'admin' && !FIELD_ROLES.includes(employeeRole?.toLowerCase?.())) ||
    currentUser?.role === 'gerente' ||
    ADMIN_EMPLOYEE_ROLES.includes(employeeRole?.toLowerCase?.());

  // Alias para compatibilidad — si es superAdmin se llama "admin"
  const isAdmin = isSuperAdmin;

  /**
   * Filtra una lista de registros según el usuario actual.
   * El RLS del backend ya garantiza que el usuario solo reciba los registros
   * que puede ver (created_by_id, jefe_sitio_email, sector_id).
   * Este filtro solo aplica aislamiento por sector para admins/gerentes
   * que ven múltiples registros dentro de su sector.
   */
  function filterByUser(list, fields = []) {
    if (!currentUser) return list;

    // Aislar por sector_id — un admin en sector BAPRO no debe ver registros del sector escuela.
    const userSector = currentUser?.sector_id || currentUser?.data?.sector_id || employeeSector || 'escuela';
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

  return { currentUser, user: currentUser, isAdmin, isSuperAdmin, employeeRole, employeeName, employeeSector, displayName, loading, filterByUser, userPermissions, resolveUserName };
}