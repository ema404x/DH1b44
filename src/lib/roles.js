/**
 * Espejo frontend de base44/shared/roles.ts.
 * Única fuente de verdad de roles para el frontend.
 * Mantener sincronizado con el módulo backend.
 */

export const ADMIN_LEVEL_ROLES = ['admin', 'gerente', 'gerencia', 'administrativo'];
export const GERENTE_SYNC_ROLES = ['gerente', 'gerencia', 'administrativo'];
export const FIELD_ROLES = ['jefe_sitio', 'jefe de sitio', 'inspector', 'tecnico', 'supervisor', 'operario', 'operario_portal'];
export const JEFE_SITIO_ROLES = ['jefe_sitio', 'jefe de sitio'];

export function normalizeRole(role) {
  return (role || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function isAdminLevelRole(employeeRole) {
  return ADMIN_LEVEL_ROLES.includes(normalizeRole(employeeRole));
}

export function shouldSyncToGerente(employeeRole) {
  return GERENTE_SYNC_ROLES.includes(normalizeRole(employeeRole));
}

export function isFieldRole(employeeRole) {
  return FIELD_ROLES.includes(normalizeRole(employeeRole));
}

export function isJefeSitioRole(employeeRole) {
  return JEFE_SITIO_ROLES.includes(normalizeRole(employeeRole));
}

export function canManageOT(employeeRole) {
  return isAdminLevelRole(employeeRole) || isJefeSitioRole(employeeRole);
}

/**
 * Evalúa si un módulo tiene permiso para una acción.
 * admin_view implica read: un rol que puede "ver todo" también puede ver (read).
 * Centraliza la lógica usada por ProtectedPage (usePermission), Sidebar y la
 * barra inferior móvil, para que los tres puntos de control sean consistentes.
 */
export function hasModulePermission(modulePerms, action) {
  if (!modulePerms) return false;
  if (modulePerms[action] === true) return true;
  if (action === 'read' && modulePerms.admin_view === true) return true;
  return false;
}