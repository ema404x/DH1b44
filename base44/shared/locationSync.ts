// base44/shared/locationSync.ts
//
// Núcleo de sincronización bidireccional LocationData ↔ Edificio.
//
// PROBLEMA
//   Dos modelos paralelos representan la misma realidad física:
//     - LocationData (módulo Mapa, fuente SAP): ubic_tecnica, elem_pep, m2, gps.
//     - Edificio (selector de Activos/Rutinas): direccion, activo.
//   Había drift: un activo podía referencing un Edificio sin LocationData, o
//   viceversa, y los campos compartidos (nombre, comuna, jefe_sitio) se
//   desincronizaban al editar uno solo.
//
// SOLUCIÓN
//   Un único módulo con la normalización canónica y el mapeo de campos por
//   propietario. TODAS las funciones de match (importer, reconciliador, motor
//   bidireccional) usan normalizeName() de aquí — nunca re-implementar.
//
// PROPIEDAD DE CAMPOS (evita conflictos bidireccionales)
//   - LocationData es dueño de: ubic_tecnica, elem_pep, m2, gps_latitude, gps_longitude, direccion_id, inspector.
//   - Edificio es dueño de: direccion, activo (booleano).
//   - COMPARTIDOS (se sincronizan bidireccionalmente): nombre↔establecimiento, comuna, jefe_sitio.
//   - DERIVADO: Edificio.activo = (LocationData.estado === 'activo').

// Normalización canónica de nombres para match robusto.
// lowercase + sin acentos (NFD) + trim + collapse espacios.
export function normalizeName(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Mapea un LocationData → payload de Edificio (solo campos compartidos + link).
// No toca campos propios de Edificio (direccion) salvo que vengan del LocationData.
export function locationDataToEdificioPayload(ld) {
  return {
    nombre: ld.establecimiento || ld.ubic_tecnica || '',
    comuna: ld.comuna || undefined,
    jefe_sitio: ld.jefe_sitio || '',
    activo: ld.estado !== 'inactivo',
    location_id: ld.id,
  };
}

// Mapea un Edificio → payload de LocationData (solo campos compartidos).
// NO crea ubic_tecnica ni comuna si faltan (son required en LocationData):
// el llamador decide si puede crear un LocationData nuevo o solo actualizar.
export function edificioToLocationDataPayload(ed) {
  return {
    establecimiento: ed.nombre || '',
    comuna: ed.comuna || undefined,
    jefe_sitio: ed.jefe_sitio || '',
    estado: ed.activo === false ? 'inactivo' : 'activo',
  };
}

// Compara dos valores primitivos de forma tolerante (null/undefined iguales).
function sameValue(a, b) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

// Dado el estado actual del destino y el payload deseado, devuelve solo los
// campos que realmente cambian. Si {} → no hay diff → la escritura se omite
// (idempotencia: corta loops de automatización sin flags ni locks).
export function diffPayload(existing, desired, fields) {
  const changes = {};
  for (const f of fields) {
    if (desired[f] === undefined) continue;
    if (!sameValue(existing?.[f], desired[f])) {
      changes[f] = desired[f];
    }
  }
  return changes;
}

// Campos compartidos que viajan LocationData → Edificio.
export const LD_TO_EDIFICIO_FIELDS = ['nombre', 'comuna', 'jefe_sitio', 'activo', 'location_id'];
// Campos compartidos que viajan Edificio → LocationData.
export const EDIFICIO_TO_LD_FIELDS = ['establecimiento', 'comuna', 'jefe_sitio', 'estado'];