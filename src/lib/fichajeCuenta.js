/**
 * Fichaje con cuenta (aditivo). Con FICHAJE_CON_CUENTA = false el escáner vuelve
 * a mandar siempre al fichaje público, sin tocar nada más.
 */
export const FICHAJE_CON_CUENTA = true;

/**
 * Fichaje con cuenta SIN conexión (aditivo). En false todo vuelve al
 * comportamiento anterior: sin señal se ofrece el QR público, no se guarda
 * nada en el teléfono y la app no abre sin red para fichar.
 */
export const FICHAJE_SIN_CONEXION = true;

const ROLES_FICHAJE_CUENTA = ['operario', 'operario_portal'];

// Chequeo rápido del lado del teléfono. El servidor vuelve a validar todo
// (ficha activa, DNI, rol, sector); si no corresponde, la pantalla manda al público.
export function puedeFicharConCuenta({ isAuthenticated, hasEmployeeRecord, userPermissions }) {
  if (!FICHAJE_CON_CUENTA || !isAuthenticated || hasEmployeeRecord !== true) return false;
  const rol = String(userPermissions?._employeeRole || '').toLowerCase().trim();
  return ROLES_FICHAJE_CUENTA.includes(rol);
}

/** Texto de la columna Método en Asistencias y en el Excel. */
export function metodoFichajeLabel(f) {
  if (f?.metodo === 'cuenta_sin_conexion') return 'Cuenta (sin conexión)';
  if (f?.metodo !== 'cuenta') return 'QR público';
  return f.sin_conexion || f.salida_sin_conexion ? 'Cuenta (sin conexión)' : 'Cuenta';
}

export function nuevoOpId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `op-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}