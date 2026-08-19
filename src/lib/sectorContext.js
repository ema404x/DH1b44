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
export function getActiveSectorId(user) {
  if (!user) return null;
  return user.data?.sector_id || user.sector_id || null;
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
export function withActiveSector(payload, user) {
  if (!payload || payload.sector_id) return payload;
  const sectorId = getActiveSectorId(user);
  if (!sectorId) return payload;
  return { ...payload, sector_id: sectorId };
}