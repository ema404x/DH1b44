import { useContext } from 'react';
import { AuthContext } from '@/lib/AuthContext';

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

  // Rol del empleado vinculado (viene de AuthContext vía vincularEmpleado)
  const employeeRole = userPermissions?._employeeRole || null;

  // Roles que deben ver solo sus propios datos
  const FIELD_ROLES = ['jefe_sitio', 'inspector', 'tecnico', 'supervisor'];

  // Es "super admin" solo si tiene role=admin en la plataforma y NO tiene rol de campo
  const isSuperAdmin = currentUser?.role === 'admin' && !FIELD_ROLES.includes(employeeRole?.toLowerCase?.());

  // Alias para compatibilidad — si es superAdmin se llama "admin"
  const isAdmin = isSuperAdmin;

  /**
   * Filtra una lista de registros según el usuario actual.
   * Para no-superAdmins, conserva solo los registros donde alguno de los campos
   * indicados contenga el nombre o email del usuario.
   */
  function filterByUser(list, fields = []) {
    if (isSuperAdmin || !currentUser) return list;
    const name = currentUser.full_name?.toLowerCase() || '';
    const email = currentUser.email?.toLowerCase() || '';
    return list.filter(item =>
      fields.some(field => {
        const val = (item[field] || '').toLowerCase();
        return (name && val.includes(name)) || (email && val === email);
      })
    );
  }

  return { currentUser, user: currentUser, isAdmin, isSuperAdmin, employeeRole, loading, filterByUser, userPermissions };
}