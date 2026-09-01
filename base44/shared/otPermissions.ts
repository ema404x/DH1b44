// base44/shared/otPermissions.ts
//
// Única fuente de verdad para permisos del módulo WorkOrder (OT).
//
// PROBLEMA QUE RESUELVE
//   actualizarOT / eliminarOT / transicionEstadoOT concedían permisos de escritura
//   según user.role (rol de PLATAFORMA). Un jefe_sitio con platformRole='admin'
//   (caso común en la app) podía editar/eliminar/aprobar CUALQUIER OT de su sector,
//   ignorando el toggle admin_view del Control de Acceso — el mismo bypass que ya
//   habíamos cerrado para visibilidad (resolveAdminView).
//
// SOLUCIÓN
//   Los permisos se resuelven desde la ficha de Empleado (rol + sector) +
//   RolePermission[role_name].permissions['WorkOrder']. El rol de plataforma NO
//   concede permisos — sólo la ficha. Un super-admin puro (sin ficha de empleado)
//   conserva acceso total (trusted). Esto es consistente con resolveAdminView y
//   con useCurrentUser.isSuperAdmin en el cliente.
//
//   Fail-safe: si RolePermission no define una acción para el rol/módulo, se usa
//   el comportamiento legacy (admin-level para update/delete/admin_view,
//   canManageOT para approve). Un admin puede REVOKEr tildando la acción en false
//   sin romper roles que no la tengan configurada.
//
// Aislamiento: el sector canónico viene de la ficha (igual que getWorkOrdersForUser,
// eliminarOT, transicionEstadoOT). Las funciones que llaman acá re-chequean
// ot.sector_id === callerSector antes de escribir.

import { isAdminLevelRole, canManageOT } from "./roles.ts";

export interface OtPermissions {
  user: any;
  employee: any | null;
  callerSector: string | null;
  /** True si el caller no tiene ficha de empleado → super-admin puro (trusted). */
  superAdmin: boolean;
  /** RolePermission.permissions['WorkOrder'] (o null si no hay configuración). */
  perms: any | null;
  /** Visibilidad total del sector (admin_view). */
  adminView: boolean;
  /** Update de cualquier OT del sector (admin-level write). No incluye dueño. */
  canUpdateAny: boolean;
  /** Cierre de OT (aprobar/rechazar/completar). */
  canApprove: boolean;
  /** Legacy: rol jefe_sitio o admin-level. */
  isJefeLevel: boolean;
}

const norm = (s: any): string =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

/**
 * Explicit true/false vence; undefined cae al legacy.
 * Permite revocar un permiso (false) sin romper roles que no lo configuran.
 */
export function explicitOrLegacy(perms: any, action: string, legacy: boolean): boolean {
  if (perms && perms[action] === false) return false;
  if (perms && perms[action] === true) return true;
  return legacy;
}

/** Resuelve la ficha de Empleado del caller por email y luego por user_id. */
export async function resolveEmployee(sb: any, user: any): Promise<any | null> {
  const userEmail = (user.email || '').toLowerCase().trim();
  let employee: any = null;
  if (userEmail) {
    const byEmail = await sb.asServiceRole.entities.Employee
      .filter({ email: userEmail }).catch(() => []);
    employee = byEmail && byEmail.length > 0 ? byEmail[0] : null;
  }
  if (!employee && user.id) {
    const byUid = await sb.asServiceRole.entities.Employee
      .filter({ user_id: user.id }).catch(() => []);
    employee = byUid && byUid.length > 0 ? byUid[0] : null;
  }
  return employee;
}

/**
 * Resuelve el contexto de permisos del caller para WorkOrder.
 * - Sin ficha (super-admin puro) → acceso total.
 * - Con ficha → RolePermission[employee.role].permissions['WorkOrder'] con
 *   fallback legacy. Fail-closed si el lookup de RolePermission lanza.
 */
export async function resolveOtPermissions(sb: any, user: any): Promise<OtPermissions> {
  const employee = await resolveEmployee(sb, user);
  const callerSector = employee?.sector_id || user?.data?.sector_id || user?.sector_id || null;

  // Super-admin puro: sin ficha de empleado → acceso total (trusted).
  if (!employee || !employee.role) {
    return {
      user, employee, callerSector, superAdmin: true, perms: null,
      adminView: true, canUpdateAny: true, canApprove: true, isJefeLevel: true,
    };
  }

  // RolePermission por rol del empleado (case-insensitive, normalizado).
  let perms: any = null;
  try {
    const allRps = await sb.asServiceRole.entities.RolePermission.list('created_date', 500);
    const rp = (allRps || []).find((r: any) => norm(r.role_name) === norm(employee.role));
    perms = rp?.permissions?.['WorkOrder'] || null;
  } catch {
    perms = null; // fail-closed en lookup
  }

  const isJefeLevel = canManageOT(employee.role);
  const adminLevel = isAdminLevelRole(employee.role);

  return {
    user, employee, callerSector, superAdmin: false, perms,
    adminView: explicitOrLegacy(perms, 'admin_view', adminLevel),
    canUpdateAny: explicitOrLegacy(perms, 'update', adminLevel),
    canApprove: explicitOrLegacy(perms, 'approve', isJefeLevel),
    isJefeLevel,
  };
}