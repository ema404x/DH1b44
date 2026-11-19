// Quiénes cuentan para asistencia (tardanzas, ausencias y aviso de la campana):
// solo empleados activos con rol operario, operario_portal o tecnico, excluyendo
// cuentas de tablet (nombre igual al de una Tablet del sector).
import { normalizeRole } from '../../shared/roles.ts';
import { fetchPaged, dniOf } from './util.ts';

export const ROLES_CONTROL = ['operario', 'operario_portal', 'tecnico'];

const nombreNorm = (s: any) => String(s || '').toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
const rolNorm = (r: any) => normalizeRole(r).replace(/\s+/g, '_');

export async function cargarControlados(sb: any, scope: any) {
  const tablets = await fetchPaged(sb, 'Tablet', { sector_id: scope.sector });
  const nombresTablet = new Set(tablets.map((t: any) => nombreNorm(t.nombre)).filter(Boolean));
  const empleados = scope.visibleEmployees.filter((e: any) =>
    (e.status || 'activo') === 'activo' &&
    ROLES_CONTROL.includes(rolNorm(e.role)) &&
    !nombresTablet.has(nombreNorm(e.full_name)));

  // Cruce: por DNI (solo dígitos); si la ficha no tiene DNI, por nombre sin acentos.
  const byDni = new Map(); const byName = new Map();
  for (const e of empleados) {
    const d = dniOf(e.dni);
    if (d) { if (!byDni.has(d)) byDni.set(d, e); }
    else { const n = nombreNorm(e.full_name); if (n && !byName.has(n)) byName.set(n, e); }
  }
  const match = (f: any) => {
    const d = dniOf(f.dni);
    return (d && byDni.get(d)) || byName.get(nombreNorm(f.operario_nombre)) || null;
  };
  return { empleados, match };
}