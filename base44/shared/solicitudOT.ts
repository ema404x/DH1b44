// base44/shared/solicitudOT.ts — utilidades comunes de las propuestas de OT.
import { resolveCallerSectorCanonical } from './callerIdentity.ts';
import { createScopedClient, SectorError } from './sectorGuard.ts';
import { isAdminLevelRole } from './roles.ts';

export const toArr = (r) => (Array.isArray(r) ? r : r?.items || []);
export const norm = (s) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ');

export const PRIORIDADES = ['baja', 'media', 'alta', 'urgente'];
export const TIPOS = ['mantenimiento_preventivo', 'mantenimiento_correctivo', 'instalacion', 'inspeccion', 'reparacion', 'emergencia'];

// Identidad canónica del caller: sector desde su ficha Employee, cliente con
// aislamiento por sector y si es admin/gerente (ve todo el sector).
export async function identidadCaller(base44, user) {
  const { sector, employee } = await resolveCallerSectorCanonical(base44.asServiceRole, user);
  if (!sector) throw new SectorError('Sin sector asignado');
  const sb = createScopedClient(base44, sector);
  const esGestor = user.role === 'admin' || user.role === 'gerente' || isAdminLevelRole(employee?.role);
  return { sector, employee, sb, esGestor, email: (user.email || '').toLowerCase().trim() };
}

// Fotos: solo URLs https, máximo 20.
export function limpiarFotos(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((u) => typeof u === 'string' && /^https:\/\//.test(u)).slice(0, 20);
}

export function entradaHistorial(user, accion, cambios = {}) {
  return { fecha: new Date().toISOString(), usuario: user.full_name || user.email || '', accion, cambios };
}