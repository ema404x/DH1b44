/**
 * Espejo frontend de base44/shared/roles.ts.
 * Única fuente de verdad de roles para el frontend.
 * Mantener sincronizado con el módulo backend.
 */

export const ADMIN_LEVEL_ROLES = ['admin', 'gerente', 'gerencia', 'administrativo', 'gerente_general'];
export const GERENTE_SYNC_ROLES = ['gerente', 'gerencia', 'administrativo', 'gerente_general'];
export const FIELD_ROLES = ['jefe_sitio', 'jefe de sitio', 'inspector', 'tecnico', 'supervisor', 'operario', 'operario_portal'];
export const JEFE_SITIO_ROLES = ['jefe_sitio', 'jefe de sitio'];
export const SECTOR_SWITCHER_ROLES = ['gerente_general'];

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
 * True si el usuario puede cambiar de sector activo.
 * Platform admins pueden cambiar siempre (super-user).
 * Empleados con rol gerente_general están autorizados vía cambiarSectorActivo.
 */
export function canSwitchSector(platformRole, employeeRole) {
  if (platformRole === 'admin') return true;
  return SECTOR_SWITCHER_ROLES.includes(normalizeRole(employeeRole));
}

/**
 * Evalúa si un módulo tiene permiso para una acción.
 * admin_view implica read: un rol que puede "ver todo" también puede ver (read).
 * Centraliza la lógica usada por ProtectedPage (usePermission), Sidebar y la
 * barra inferior móvil, para que los tres puntos de control sean consistentes.
 */
// Módulos que eran de acceso libre antes de tener su propia clave de permiso.
// Mientras un rol no los tenga configurados explícitamente, se concede read
// (migración no-rompe-nada). Una vez que el admin guarda, el valor explícito persiste.
const MIGRATION_DEFAULT_READ = new Set(['MisOrdenes']);

export function hasModulePermission(modulePerms, action, moduleKey) {
  // Módulo ausente de los permisos del rol (rol creado antes de la clave).
  if (!modulePerms) {
    return action === 'read' && MIGRATION_DEFAULT_READ.has(moduleKey);
  }
  if (modulePerms[action] === true) return true;
  if (action === 'read' && modulePerms.admin_view === true) return true;
  // Módulo presente pero sin la acción definida (rol viejo sin la clave read).
  if (action === 'read' && modulePerms.read === undefined && MIGRATION_DEFAULT_READ.has(moduleKey)) return true;
  return false;
}