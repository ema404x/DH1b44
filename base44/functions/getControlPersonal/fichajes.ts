// Asistencias paginadas y revisión administrativa, limitadas al alcance del usuario.
import { HttpError, lista } from './util.ts';

const ESTADOS = ['abierta', 'cerrada', 'salida_omitida'];
const ADMIN = ['pendiente', 'revisado', 'incidencia'];
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const fechaOk = (v: any) => typeof v === 'string' && Number.isFinite(new Date(v).getTime());

// Reconstruye en servidor el filtro que arma AsistenciasPanel, solo con campos permitidos.
export function construirFiltro(scope: any, q: any = {}) {
  const and: any[] = [{ sector_id: scope.sector }];
  const vis = scope.visibilityClause();
  if (vis === false) return null;
  if (vis) and.push(vis);
  if (typeof q.location_qr_id === 'string' && q.location_qr_id) and.push({ location_qr_id: q.location_qr_id });
  if (ESTADOS.includes(q.estado)) and.push({ estado: q.estado });
  if (ADMIN.includes(q.estado_admin)) and.push({ estado_admin: q.estado_admin });
  const r = q.entrada_timestamp;
  if (r && typeof r === 'object') {
    const t: any = {};
    if (fechaOk(r.$gte)) t.$gte = new Date(r.$gte).toISOString();
    if (fechaOk(r.$lte)) t.$lte = new Date(r.$lte).toISOString();
    if (Object.keys(t).length) and.push({ entrada_timestamp: t });
  }
  const search = Array.isArray(q.$or) ? q.$or[0]?.operario_nombre?.$regex : null;
  if (typeof search === 'string' && search.trim()) {
    const s = esc(search.trim().slice(0, 60));
    and.push({ $or: [{ operario_nombre: { $regex: s, $options: 'i' } }, { dni: { $regex: s, $options: 'i' } }] });
  }
  return and.length === 1 ? and[0] : { $and: and };
}

export async function accionFichajes(sb: any, scope: any, body: any) {
  const filtro = construirFiltro(scope, body.query || {});
  if (!filtro) return { items: [], has_more: false, next_cursor: null };
  const limit = Math.min(500, Math.max(1, Number(body.limit) || 200));
  const opts: any = { sort: '-entrada_timestamp', limit };
  if (typeof body.cursor === 'string' && body.cursor) opts.cursor = body.cursor;
  const res = await sb.entities.FichajeUbicacion.filter(filtro, opts);
  // Solo para mostrar: los fichajes sin ficha en Empleados llevan la etiqueta en el nombre.
  const items = lista(res).map((f: any) => (scope.fichas.sinFicha(f)
    ? { ...f, operario_nombre: `${f.operario_nombre || 'Sin nombre'} · Sin ficha` } : f));
  return { items, has_more: Boolean(res?.has_more), next_cursor: res?.next_cursor || null };
}

export async function accionRevisar(sb: any, scope: any, body: any) {
  if (!body.id) throw new HttpError(400, 'Falta el fichaje.');
  if (!ADMIN.includes(body.estado_admin)) throw new HttpError(400, 'Estado administrativo inválido.');
  const f = await sb.entities.FichajeUbicacion.get(body.id).catch((e: any) => (e?.status === 404 ? null : Promise.reject(e)));
  if (!f || !scope.fichajeVisible(f)) throw new HttpError(404, 'Fichaje no encontrado.');
  await sb.entities.FichajeUbicacion.update(f.id, {
    estado_admin: body.estado_admin,
    notas_admin: String(body.notas_admin || '').trim().slice(0, 2000),
    revisado_por: scope.employee?.full_name || scope.user.full_name || scope.user.email || 'Sistema',
    fecha_revision: new Date().toISOString(),
  });
  return { ok: true };
}