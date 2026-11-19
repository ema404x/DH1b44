// Alcance del usuario en Control de Personal (se aplica en servidor).
// - Admin / gerente: todo su sector.
// - Jefe de sitio: operarios con Employee.assigned_jefe_sitio = él, y fichajes
//   de las ubicaciones donde es jefe (LocationQR.jefe_sitio / jefe_sitio_email)
//   o de sus operarios.
import { resolveCallerSectorCanonical } from '../../shared/callerIdentity.ts';
import { isAdminLevelRole, isJefeSitioRole, isFieldRole } from '../../shared/roles.ts';
import { loadRolePermissions, norm } from '../../shared/visibilityResolver.ts';
import { fetchPaged, dniOf, esOmitida } from './util.ts';
import { distanciaFichaje } from './geo.ts';

export async function resolveAcceso(sb: any, user: any) {
  const { sector, employee } = await resolveCallerSectorCanonical(sb, user);
  const rol = employee?.role || '';
  const rps = rol ? await loadRolePermissions(sb) : [];
  const perm = rps.find((r: any) => norm(r.role_name) === norm(rol))?.permissions?.ControlPersonal;
  const esAdmin = user.role === 'admin';
  const porDefecto = isAdminLevelRole(rol) || isJefeSitioRole(rol) || user.role === 'gerente';
  const canAccess = Boolean(sector) && (esAdmin || (perm ? (perm.read === true || perm.admin_view === true) : porDefecto));
  const verTodo = (esAdmin && !isFieldRole(rol)) || isAdminLevelRole(rol) || user.role === 'gerente' || perm?.admin_view === true;
  const canEditHorario = esAdmin || user.role === 'gerente' || isAdminLevelRole(rol);
  return { user, sector, employee, canAccess, verTodo, canEditHorario };
}

const variantesNombre = (n: string) => {
  const s = String(n || '').trim();
  if (!s) return [];
  const sinAcento = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return [...new Set([s, s.toUpperCase(), s.toLowerCase(), sinAcento, sinAcento.toUpperCase(), sinAcento.toLowerCase()])];
};

export async function resolveScope(sb: any, acceso: any) {
  const { user, sector, employee, verTodo } = acceso;
  const [employees, locations] = await Promise.all([
    fetchPaged(sb, 'Employee', { sector_id: sector }),
    fetchPaged(sb, 'LocationQR', { sector_id: sector }),
  ]);
  const email = String(user.email || '').toLowerCase().trim();
  const jefe = norm(employee?.full_name || user.full_name || '');
  const esMio = (v: any) => { const n = norm(v); return Boolean(n) && (n === jefe || n === norm(email)); };

  const visibleEmployees = verTodo ? employees : employees.filter((e: any) => e.id !== employee?.id && esMio(e.assigned_jefe_sitio));
  const visibleLocations = verTodo ? locations : locations.filter((l: any) =>
    (l.jefe_sitio_email && String(l.jefe_sitio_email).toLowerCase().trim() === email) || esMio(l.jefe_sitio) ||
    // En los datos actuales el jefe suele figurar en la cuadrilla asignada de la ubicación.
    (l.assigned_employees || []).some(esMio));

  const coords = new Map();
  for (const l of locations) if (Number.isFinite(l.latitude) && Number.isFinite(l.longitude)) coords.set(l.id, { lat: l.latitude, lng: l.longitude });

  const byDni = new Map(); const byName = new Map();
  for (const e of visibleEmployees) {
    const d = dniOf(e.dni); if (d) byDni.set(d, e);
    const n = norm(e.full_name); if (n && !byName.has(n)) byName.set(n, e);
  }
  const matchEmployee = (f: any) => byDni.get(dniOf(f.dni)) || byName.get(norm(f.operario_nombre)) || null;
  const locIds = new Set(visibleLocations.map((l: any) => l.id));

  const fichajeVisible = (f: any) => {
    if (f.sector_id !== sector) return false;
    if (verTodo) return true;
    return locIds.has(f.location_qr_id) ||
      (f.jefe_sitio_email && String(f.jefe_sitio_email).toLowerCase().trim() === email) ||
      Boolean(matchEmployee(f));
  };

  // Cláusula para consultas paginadas (Asistencias / Excel). false = nada visible.
  const visibilityClause = () => {
    if (verTodo) return null;
    const or: any[] = [];
    if (locIds.size) or.push({ location_qr_id: { $in: [...locIds] } });
    if (email) or.push({ jefe_sitio_email: { $in: [...new Set([email, user.email])] } });
    const dnis = [...new Set(visibleEmployees.flatMap((e: any) => [dniOf(e.dni), e.dni]).filter(Boolean))];
    if (dnis.length) or.push({ dni: { $in: dnis } });
    const nombres = [...new Set(visibleEmployees.flatMap((e: any) => variantesNombre(e.full_name)))];
    if (nombres.length) or.push({ operario_nombre: { $in: nombres } });
    return or.length ? { $or: or } : false;
  };

  const leanFichaje = (f: any) => {
    const emp = matchEmployee(f);
    const d = distanciaFichaje(f, coords);
    return {
      id: f.id, operario_nombre: f.operario_nombre || '', dni: f.dni || '',
      location_qr_id: f.location_qr_id, location_name: f.location_name || 'Sin ubicación',
      entrada_timestamp: f.entrada_timestamp, salida_timestamp: f.salida_timestamp || null,
      estado: f.estado, estado_admin: f.estado_admin || 'pendiente', salida_omitida: esOmitida(f),
      far: d.status === 'far', distancia: d.text, employee_id: emp?.id || null,
      persona: emp ? `e:${emp.id}` : `f:${dniOf(f.dni) || norm(f.operario_nombre)}`, tarde: false,
    };
  };

  return { ...acceso, visibleEmployees, visibleLocations, coords, matchEmployee, fichajeVisible, visibilityClause, leanFichaje, variantesNombre };
}

export const leanEmpleado = (e: any) => ({
  id: e.id, full_name: e.full_name || '', dni: e.dni || '', role: e.role || '',
  status: e.status || 'activo', specialty: e.specialty || '', assigned_location: e.assigned_location || '',
  assigned_jefe_sitio: e.assigned_jefe_sitio || '', hire_date: e.hire_date || null,
});