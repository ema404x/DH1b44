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
   * - SuperAdmins y usuarios sin rol de campo: ven todo.
   * - Roles de campo (jefe_sitio, inspector, etc.): ven solo sus registros
   *   (donde su nombre/email aparece en alguno de los campos indicados,
   *    O donde ellos mismos crearon el registro).
   */
  function filterByUser(list, fields = []) {
    if (!currentUser) return list;

    // Aislar SIEMPRE por sector_id — incluso para admins.
    // Un admin en sector BAPRO no debe ver registros del sector escuela.
    const userSector = currentUser?.sector_id || currentUser?.data?.sector_id || employeeSector || 'escuela';
    let result = list.filter(item => {
      const itemSector = item.sector_id || 'escuela';
      return itemSector === userSector;
    });

    // SuperAdmins ven todo dentro de su sector (no se filtra por assigned_name, etc.)
    if (isSuperAdmin) return result;
    // Si no tiene employeeRole asignado, no restringir más allá del sector
    if (!employeeRole) return result;
    // Solo restringir por campos si es un rol de campo explícito
    if (!FIELD_ROLES.includes(employeeRole?.toLowerCase?.())) return result;

    // IMPORTANTE: usar employeeName (ficha de empleado) como fuente principal de nombre.
    // Caer en full_name de plataforma solo si no hay ficha vinculada.
    // Normaliza acentos: "Gastón Massá" debe matchear "Gaston Massa" y viceversa.
    const normalize = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const employeeNameNorm = normalize(employeeName);
    const platformNameNorm = normalize(currentUser.full_name);
    const email = currentUser.email?.toLowerCase().trim() || '';
    const userId = currentUser.id || '';

    // Partes del nombre (longitud > 3) para fuzzy matching.
    // Permite que "Marco Tarqui" matchee "MARCOS TARQUI LOZANO".
    const nameParts = employeeNameNorm.split(/\s+/).filter(p => p.length > 3);
    const platformNameParts = platformNameNorm.split(/\s+/).filter(p => p.length > 3);

    return result.filter(item => {
      // 1. Creado por este usuario
      if (userId && item.created_by_id && item.created_by_id === userId) return true;

      // 2. Email exact match — SIEMPRE verificar campos de email.
      //    Esto alinea el filtro cliente con el RLS (jefe_sitio_email === user.email).
      const emailFields = ['jefe_sitio_email', 'assigned_to', 'assigned_name'];
      for (const f of emailFields) {
        const val = (item[f] || '').toString().toLowerCase().trim();
        if (val && email && val === email) return true;
      }

      // 3. Verificar campos especificados por matching de nombres
      return fields.some(field => {
        const val = normalize(item[field]);
        if (!val) return false;

        // Nombre exacto contenido (comportamiento existente)
        if (employeeNameNorm && val.includes(employeeNameNorm)) return true;
        if (platformNameNorm && val.includes(platformNameNorm)) return true;

        // Fuzzy: todas las partes del nombre (longitud > 3) aparecen en el valor.
        // Ej: "marco" + "tarqui" ambos en "marcos tarqui lozano" → match.
        if (nameParts.length >= 2 && nameParts.every(p => val.includes(p))) return true;
        if (platformNameParts.length >= 2 && platformNameParts.every(p => val.includes(p))) return true;

        return false;
      });
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