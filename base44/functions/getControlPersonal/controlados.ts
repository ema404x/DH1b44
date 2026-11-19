// Quiénes cuentan para asistencia (tardanzas, ausencias y aviso de la campana):
// solo empleados activos que cumplen esOperario, excluyendo cuentas de tablet
// (nombre igual al de una Tablet del sector).
import { fetchPaged, dniOf } from './util.ts';
import { esOperario } from './operario.ts';

const nombreNorm = (s: any) => String(s || '').toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

export async function cargarControlados(sb: any, scope: any) {
  const tablets = await fetchPaged(sb, 'Tablet', { sector_id: scope.sector });
  const nombresTablet = new Set(tablets.map((t: any) => nombreNorm(t.nombre)).filter(Boolean));
  const empleados = scope.visibleEmployees.filter((e: any) =>
    (e.status || 'activo') === 'activo' &&
    esOperario(e.role) &&
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