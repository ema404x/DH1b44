/**
 * Única fuente de verdad para clasificación de roles del sistema.
 *
 * IMPORTACIÓN (backend):
 *   import { isAdminLevelRole, shouldSyncToGerente, ... } from "../../shared/roles.ts";
 *
 * ESPEJO FRONTEND: src/lib/roles.js — mantener sincronizado.
 *
 * Para agregar un nuevo rol admin-level: agregarlo a ADMIN_LEVEL_ROLES y,
 * si debe sincronizarse a plataforma 'gerente', también a GERENTE_SYNC_ROLES.
 * Todas las funciones y hooks que importan de aquí se actualizan automáticamente.
 */

// Roles de empleado con visibilidad total — ven todos los registros de su sector.
export const ADMIN_LEVEL_ROLES = ['admin', 'gerente', 'gerencia', 'administrativo'];

// Roles que se sincronizan a plataforma 'gerente' en vincularEmpleado.
// 'admin' se excluye: los platform admins ya tienen acceso total.
export const GERENTE_SYNC_ROLES = ['gerente', 'gerencia', 'administrativo'];

// Roles de campo — ven solo sus propias OTs/registros.
export const FIELD_ROLES = ['jefe_sitio', 'jefe de sitio', 'inspector', 'tecnico', 'supervisor', 'operario', 'operario_portal'];

// Roles que pueden ejecutar acciones de cierre en OTs (jefe de sitio).
export const JEFE_SITIO_ROLES = ['jefe_sitio', 'jefe de sitio'];

/** Normaliza: lowercase, sin acentos, sin espacios extra. */
export function normalizeRole(role?: string | null): string {
  return (role || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/** True si el rol de empleado tiene visibilidad total (admin-level). */
export function isAdminLevelRole(employeeRole?: string | null): boolean {
  return ADMIN_LEVEL_ROLES.includes(normalizeRole(employeeRole));
}

/** True si el rol debe sincronizarse a plataforma 'gerente'. */
export function shouldSyncToGerente(employeeRole?: string | null): boolean {
  return GERENTE_SYNC_ROLES.includes(normalizeRole(employeeRole));
}

/** True si el rol es de campo (visibilidad limitada a propios registros). */
export function isFieldRole(employeeRole?: string | null): boolean {
  return FIELD_ROLES.includes(normalizeRole(employeeRole));
}

/** True si el rol es jefe de sitio. */
export function isJefeSitioRole(employeeRole?: string | null): boolean {
  return JEFE_SITIO_ROLES.includes(normalizeRole(employeeRole));
}

/** True si el rol puede gestionar OTs (admin-level o jefe de sitio). */
export function canManageOT(employeeRole?: string | null): boolean {
  return isAdminLevelRole(employeeRole) || isJefeSitioRole(employeeRole);
}