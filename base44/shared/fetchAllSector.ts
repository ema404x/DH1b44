// base44/shared/fetchAllSector.ts
//
// Carga COMPLETA de registros de una entidad dentro de un sector, para
// funciones backend asServiceRole. Aplica a AMBOS sectores (escuela y bapro)
// de forma idéntica — el sector_id va en la query y el SDK lo respeta.
//
// REGLA DE ORO (determinismo + completitud):
//   Una sola llamada con un límite alto. El SDK respeta el parámetro limit y
//   devuelve TODOS los registros matching sin tope oculto (verificado: con
//   572 registros, limit 2000 y 5000 devuelven los 572). Esto reemplaza la
//   paginación por cursor anterior ($gte + $nin sobre created_date), que
//   estaba ROTA: el SDK NO soporta operadores de query ($gte, $gt, $lt, $nin)
//   sobre campos built-in (created_date, id) → la página 2+ devolvía 0 y se
//   perdían todos los registros más allá de la página 1 (máx 500). Ese bug
//   hacía que el contador de OTs se estancara y subreportara TODOS los
//   módulos que usaban fetchAll.
//
//   Sin cursor no hay saltos en boundaries de created_date idéntico (el bug
//   original que motivó $gte+$nin), y sin operadores no hay silenciosidad.
//   El orden lo define el caller vía `sort` (típicamente -updated_date para
//   preservar el burbujeo de OTs recién tocadas).
//
// Techo de seguridad: LIMIT. Si un sector supera LIMIT registros, la llamada
// devuelve LIMIT (degradación graceful — mejor que perder registros
// silenciosamente). En la práctica ningún sector se acerca: escuela ~572.
// Si algún día se supera, subir LIMIT.

const LIMIT = 5000;

/**
 * Carga todos los registros de `entity` que matcheen `query`, en una sola
 * llamada con límite alto. Devuelve el array completo (sin paginar).
 *
 * @param sb        client service-role (base44.asServiceRole) o scoped.
 * @param entity    nombre de la entidad (ej: 'WorkOrder', 'Asset').
 * @param query     filtro de igualdad (ej: { sector_id: 'escuela' }). Los
 *                  operadores ($gte, $nin, ...) sobre campos built-in NO
 *                  funcionan en el SDK — usar sólo igualdades.
 * @param sort      campo de orden (ej: '-updated_date'). Default 'created_date'.
 */
export async function fetchAll(
  sb: any,
  entity: string,
  query: Record<string, any> = {},
  sort = 'created_date',
): Promise<any[]> {
  try {
    const batch = await sb.entities[entity].filter(query, sort, LIMIT);
    return Array.isArray(batch) ? batch : [];
  } catch {
    // fail-safe: si la query falla, devolver vacío (el caller decide qué hacer).
    return [];
  }
}