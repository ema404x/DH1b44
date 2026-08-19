/**
 * sectorContext.js — Resolución central del sector activo de la sesión.
 *
 * Fuente única de verdad para "en qué sector está operando el usuario actual".
 * Todos los módulos que necesiten scopear datos por sector DEBEN usar
 * getActiveSectorId() en lugar de leer campos sueltos del user o inventar defaults.
 *
 * Fail-closed: si no se puede resolver el sector, devuelve null.
 * NUNCA cae a un default como 'escuela' — eso contaminaría el sector destino
 * (bug histórico: empleados creados en BAPRO que terminaban en escuela).
 *
 * El sector se estampa en el User desde el backend (cambiarSectorActivo /
 * vincularEmpleado) y se lee en user.data.sector_id (canónico) o
 * user.sector_id (legacy / plano).
 */

/**
 * Devuelve el sector activo del usuario actual, o null si no está resuelto.
 * @param {object|null} user — usuario actual (de useCurrentUser / auth.me)
 * @returns {string|null}
 */
export function getActiveSectorId(user, employeeSector = null) {
  if (!user) return employeeSector || null;
  // Cadena de resolución completa (espejo de filterByUser en useCurrentUser):
  //   1. data.sector_id — canónico, escrito por cambiarSectorActivo (lo lee la RLS)
  //   2. sector_id — legacy / top-level
  //   3. employeeSector — sector de la ficha Employee, reconciliado por vincularEmpleado
  //      Es la señal más confiable para platform admins (linkEmployee los saltea, así
  //      que data.sector_id puede estar vacío y employeeSector resuelve desde la ficha).
  return user.data?.sector_id || user.sector_id || employeeSector || null;
}

/**
 * Estampa sector_id en un payload de creación, fail-closed.
 * - Si el payload ya trae sector_id, lo respeta.
 * - Si el usuario actual tiene sector resuelto, lo estampa.
 * - Si no se resuelve, NO inventa default: devuelve el payload sin tocar
 *   y deja que stampSectorOnCreate (backend) lo marque SIN_SECTOR.
 *
 * @param {object} payload — datos a crear
 * @param {object|null} user — usuario actual
 * @returns {object} payload con sector_id estampado si corresponde
 */
export function withActiveSector(payload, user, employeeSector = null) {
  if (!payload || payload.sector_id) return payload;
  const sectorId = getActiveSectorId(user, employeeSector);
  if (!sectorId) return payload;
  return { ...payload, sector_id: sectorId };
}