import { fetchPaged } from './util.ts';
import { arInfo, inicioDia, sumarDias } from './tiempo.ts';

// Cada establecimiento visible con asignados, quién fichó hoy y en los últimos 7 días.
export async function accionLugares(sb: any, scope: any) {
  const hoy = (arInfo(new Date()) as any).fecha;
  const raw = await fetchPaged(sb, 'FichajeUbicacion', {
    sector_id: scope.sector, entrada_timestamp: { $gte: inicioDia(sumarDias(hoy, -6)) },
  }, '-entrada_timestamp');
  const porLugar = new Map();
  for (const f of raw.filter(scope.fichajeVisible)) {
    const g = porLugar.get(f.location_qr_id) || { hoy: new Map(), semana: new Set(), total: 0 };
    const nombre = f.operario_nombre || 'Sin nombre';
    g.total += 1;
    g.semana.add(nombre);
    if ((arInfo(f.entrada_timestamp) as any).fecha === hoy && !g.hoy.has(nombre)) {
      g.hoy.set(nombre, { nombre, entrada: f.entrada_timestamp, abierta: f.estado === 'abierta' });
    }
    porLugar.set(f.location_qr_id, g);
  }
  const lugares = scope.visibleLocations.map((l: any) => {
    const g = porLugar.get(l.id);
    return {
      id: l.id, name: l.name, address: l.address || '', color: l.color || 'blue', is_active: l.is_active !== false,
      latitude: l.latitude, longitude: l.longitude, jefe_sitio: l.jefe_sitio || '',
      assigned_employees: (l.assigned_employees || []).filter((n: any) => !scope.fichas.esNoOperarioNombre(n)),
      hoy: g ? [...g.hoy.values()] : [], semana: g ? [...g.semana].sort() : [], total: g?.total || 0,
    };
  }).sort((a: any, b: any) => String(a.name).localeCompare(String(b.name), 'es'));
  return { lugares };
}