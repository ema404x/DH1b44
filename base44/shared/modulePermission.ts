// base44/shared/modulePermission.ts
//
// Chequeo de una acción de un módulo según Control de Acceso (RolePermission).
// - Admin de plataforma (user.role === 'admin'): siempre puede.
// - Resto: rol de su ficha Employee (misma resolución canónica que usan las otras
//   funciones: email → user_id) y RolePermission[rol].permissions[modulo][accion].
// Fail-closed: sin ficha, ficha inactiva, rol sin configurar o error de lectura → false.
import { resolveCallerSectorCanonical } from './callerIdentity.ts';
import { loadRolePermissions, norm } from './visibilityResolver.ts';

export async function tienePermisoModulo(base44: any, user: any, moduleKey: string, action: string, employee?: any) {
  if (user?.role === 'admin') return true;
  const emp = employee !== undefined
    ? employee
    : (await resolveCallerSectorCanonical(base44.asServiceRole, user)).employee;
  if (!emp?.role || emp.status === 'inactivo') return false;
  const rps = await loadRolePermissions(base44.asServiceRole);
  const rp = rps.find((r: any) => norm(r.role_name) === norm(emp.role) && r.is_active !== false);
  return rp?.permissions?.[moduleKey]?.[action] === true;
}