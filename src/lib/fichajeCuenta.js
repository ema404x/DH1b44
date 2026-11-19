/**
 * Fichaje con cuenta (aditivo). Con FICHAJE_CON_CUENTA = false el escáner vuelve
 * a mandar siempre al fichaje público, sin tocar nada más.
 */
export const FICHAJE_CON_CUENTA = true;

const ROLES_FICHAJE_CUENTA = ['operario', 'operario_portal'];

// Chequeo rápido del lado del teléfono. El servidor vuelve a validar todo
// (ficha activa, DNI, rol, sector); si no corresponde, la pantalla manda al público.
export function puedeFicharConCuenta({ isAuthenticated, hasEmployeeRecord, userPermissions }) {
  if (!FICHAJE_CON_CUENTA || !isAuthenticated || hasEmployeeRecord !== true) return false;
  const rol = String(userPermissions?._employeeRole || '').toLowerCase().trim();
  return ROLES_FICHAJE_CUENTA.includes(rol);
}

export function nuevoOpId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `op-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}