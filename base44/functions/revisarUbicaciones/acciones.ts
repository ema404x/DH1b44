// Acciones manuales: solo se ejecutan cuando un admin/gerente toca un botón.
import { cargarItems, okCoord, firmaCoords } from './datos.ts';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

async function buscarItem(sb: any, clave: any) {
  if (typeof clave !== 'string' || !clave) throw new HttpError(400, 'Falta la ubicación.');
  const { items } = await cargarItems(sb);
  const item = items.find((i: any) => i.clave === clave);
  if (!item) throw new HttpError(404, 'Ubicación no encontrada.');
  return item;
}

// Cambia coordenadas en la misma entidad y campos que lee el mapa y el fichaje (radio 350 m).
export async function aplicarCoordenadas(sb: any, ctx: any, body: any) {
  const item = await buscarItem(sb, body.clave);
  let lat: number; let lng: number;
  if (body.modo === 'sugerida') {
    if (!item.sugerida) throw new HttpError(400, 'No hay ubicación sugerida para esta dirección.');
    ({ lat, lng } = item.sugerida);
  } else if (body.modo === 'manual') {
    lat = Number(body.lat); lng = Number(body.lng);
    if (!okCoord(lat, lng)) throw new HttpError(400, 'Coordenadas inválidas.');
  } else throw new HttpError(400, 'Modo inválido.');
  lat = Math.round(lat * 1e7) / 1e7; lng = Math.round(lng * 1e7) / 1e7;

  const fecha = new Date().toISOString();
  await Promise.all(item.targets.map((t: any) => t.entidad === 'LocationData'
    ? sb.entities.LocationData.update(t.id, { gps_latitude: lat, gps_longitude: lng })
    : sb.entities.LocationQR.update(t.id, { latitude: lat, longitude: lng })));
  await sb.entities.HistorialUbicacion.bulkCreate(item.targets.map((t: any) => ({
    entidad: t.entidad, entidad_id: t.id, nombre: t.nombre || item.nombre, direccion: item.direccion, modo: body.modo,
    ...(t.tieneCoords ? { lat_anterior: t.lat, lng_anterior: t.lng } : {}),
    lat_nueva: lat, lng_nueva: lng, usuario_nombre: ctx.nombre, usuario_email: ctx.email, fecha,
  })));
  await sb.entities.RevisionUbicacion.create({
    clave: item.clave, nombre: item.nombre, resultado: 'corregida', fecha,
    firma_coords: firmaCoords(item.targets.map((t: any) => ({ ...t, lat, lng }))),
    revisado_por: ctx.nombre, revisado_por_email: ctx.email,
  });
  return { ok: true, lat, lng };
}

export async function marcarBien(sb: any, ctx: any, body: any) {
  const item = await buscarItem(sb, body.clave);
  await sb.entities.RevisionUbicacion.create({
    clave: item.clave, nombre: item.nombre, resultado: 'esta_bien', fecha: new Date().toISOString(),
    firma_coords: firmaCoords(item.targets), revisado_por: ctx.nombre, revisado_por_email: ctx.email,
  });
  return { ok: true };
}

export async function historial(sb: any) {
  const res = await sb.entities.HistorialUbicacion.filter({}, { sort: '-created_date', limit: 30 });
  const items = Array.isArray(res) ? res : res?.items || [];
  return { items: items.map((h: any) => ({
    id: h.id, entidad: h.entidad, nombre: h.nombre, modo: h.modo, fecha: h.fecha || h.created_date,
    lat_anterior: h.lat_anterior, lng_anterior: h.lng_anterior, lat_nueva: h.lat_nueva, lng_nueva: h.lng_nueva,
    usuario_nombre: h.usuario_nombre,
  })) };
}