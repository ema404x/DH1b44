import { createScopedClient, SectorError } from './sectorGuard.ts';
import { resolveCallerSectorCanonical } from './callerIdentity.ts';

// La raíz del QR/portal es la única fuente del sector, nunca el payload.
export async function resolvePublicRecordScope(base44, entityName, id) {
  if (typeof id !== 'string' || !id.trim()) throw new SectorError('Identificador requerido', 400);
  const record = await base44.asServiceRole.entities[entityName].get(id).catch(error => {
    if (error.status === 404 || error.response?.status === 404) return null;
    throw error;
  });
  if (!record) throw new SectorError('Registro no encontrado', 404);
  const sb = createScopedClient(base44, record.sector_id);
  if (entityName === 'LocationQR' && record.is_active === false) throw new SectorError('Punto de fichaje desactivado');
  if (await base44.auth.isAuthenticated()) {
    const user = await base44.auth.me();
    const { sector } = await resolveCallerSectorCanonical(base44.asServiceRole, user);
    if (sector !== record.sector_id) throw new SectorError('Registro fuera del sector activo');
  }
  return { record, sb, sector: record.sector_id };
}