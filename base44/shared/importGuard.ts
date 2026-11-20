// Reglas comunes de la importación de datos (pantalla ImportarDatos y rollback).
//
// 1. Solo admin o gerente pueden importar (chequeo en ese orden, con auth.me()).
// 2. Lista blanca de entidades: exactamente las que ofrece la pantalla ImportarDatos.
//    Cualquier otra (RolePermission, User, SecurityConfig, Sector, Tablet, ...) se rechaza.

export const IMPORTABLE_ENTITIES = new Set([
  'InformePlaneacion',
  'Client',
  'Employee',
  'Material',
  'Project',
  'WorkOrder',
  'Asset',
  'LocationData',
  'PrecarioMinisterio',
  'Invoice',
  'Informe',
  'Emergencia',
  'RiesgoControl',
  'ObraCertificacion',
  'Direccion',
]);

// Devuelve una Response 401/403 si el usuario no puede importar, o null si puede.
export function importRoleError(user) {
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role === 'admin') return null;
  if (user.role === 'gerente') return null;
  return Response.json(
    { error: 'No tenés permiso para importar datos. Solo un administrador o gerente puede hacerlo.' },
    { status: 403 },
  );
}

// Devuelve una Response 400 si alguna entidad no está permitida, o null si todas lo están.
export function entityNotAllowedError(entityNames) {
  const bad = [...new Set(entityNames.filter((e) => !IMPORTABLE_ENTITIES.has(e)))];
  if (bad.length === 0) return null;
  return Response.json(
    { error: `No se permite importar en: ${bad.join(', ')}. Entidades permitidas: ${[...IMPORTABLE_ENTITIES].join(', ')}` },
    { status: 400 },
  );
}