// Regla única del módulo: solo cuentan los empleados con rol operario u operario_portal
// (sin importar mayúsculas, acentos, espacios o guiones). Todo otro rol queda afuera.
import { normalizeRole } from '../../shared/roles.ts';
import { dniOf } from './util.ts';
import { norm } from '../../shared/visibilityResolver.ts';

const ROLES_OPERARIO = ['operario', 'operario_portal'];

export function esOperario(role: any): boolean {
  return ROLES_OPERARIO.includes(normalizeRole(role).replace(/[\s-]+/g, '_'));
}

// Clasifica fichajes contra TODAS las fichas del sector: DNI primero, después nombre.
// - ficha de operario → se muestra
// - ficha con otro rol → se excluye
// - sin ficha → se muestra (etiqueta "Sin ficha")
export function clasificadorFichas(employees: any[], variantesNombre: (n: string) => string[]) {
  const byDni = new Map(); const byName = new Map();
  for (const e of employees) {
    const op = esOperario(e.role);
    const d = dniOf(e.dni);
    if (d && (!byDni.has(d) || op)) byDni.set(d, e);
    const n = norm(e.full_name);
    if (n && (!byName.has(n) || op)) byName.set(n, e);
  }
  const fichaDe = (f: any) => byDni.get(dniOf(f.dni)) || byName.get(norm(f.operario_nombre)) || null;
  const excluido = (f: any) => { const e = fichaDe(f); return Boolean(e) && !esOperario(e.role); };
  const sinFicha = (f: any) => !fichaDe(f);

  // Misma regla como cláusula de consulta (Asistencias y Excel).
  const operarios = employees.filter((e) => esOperario(e.role));
  const otros = employees.filter((e) => !esOperario(e.role));
  const dnis = (l: any[]) => [...new Set(l.flatMap((e) => [dniOf(e.dni), e.dni]).filter(Boolean))];
  const opDnis = dnis(operarios);
  const otrosDnis = dnis(otros).filter((d) => !opDnis.includes(d));
  const opNombres = new Set(operarios.map((e) => norm(e.full_name)));
  const otrosNombres = [...new Set(otros.filter((e) => !opNombres.has(norm(e.full_name)))
    .flatMap((e) => variantesNombre(e.full_name)))];
  const clausula = () => {
    if (!otrosDnis.length && !otrosNombres.length) return null;
    const resto: any[] = [];
    if (otrosDnis.length) resto.push({ dni: { $nin: otrosDnis } });
    if (otrosNombres.length) resto.push({ operario_nombre: { $nin: otrosNombres } });
    const alt = resto.length === 1 ? resto[0] : { $and: resto };
    return opDnis.length ? { $or: [{ dni: { $in: opDnis } }, alt] } : alt;
  };
  return { excluido, sinFicha, clausula, esNoOperarioNombre: (v: any) => {
    const n = norm(v); if (!n) return false;
    const e = byName.get(n) || employees.find((x) => x.id === v);
    return Boolean(e) && !esOperario(e.role);
  } };
}