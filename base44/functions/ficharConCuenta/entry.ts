import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import { createScopedClient } from '../../shared/sectorGuard.ts';
import { fetchAllFichajesPaginated, reconcileExpiredOpenFichajes, isExpiredOpenFichaje } from '../../shared/fichajeAutoCierre.ts';
import { getDistanceStatus, hasCoordinates } from '../../shared/geoDistance.ts';
import { ficharSinConexion } from '../../shared/fichajeSinConexion.ts';

// Fichaje con cuenta: la identidad sale SOLO de la sesión (auth.me) y de la ficha
// Employee vinculada. Nunca se acepta del cliente nombre, DNI, user_id ni employee_id.
// No toca el fichaje público (fichajeUbicacion / publicFichar).
// Siempre responde 200: { ok: true, ... } o { ok: false, code?, error }.

const ROLES_OK = ['operario', 'operario_portal'];
const lista = (r) => (Array.isArray(r) ? r : (r?.items || []));
const dniDe = (s) => String(s || '').replace(/\D/g, '');
const fail = (error, code = 'error') => Response.json({ ok: false, code, error });
const nf = (e) => (e?.status === 404 ? null : Promise.reject(e));

async function resolverEmpleado(sb, user) {
  const byId = lista(await sb.entities.Employee.filter({ user_id: user.id }));
  if (byId.length) return byId[0];
  const email = String(user.email || '').toLowerCase().trim();
  if (!email) return null;
  const byEmail = lista(await sb.entities.Employee.filter({ email: user.email }))
    .filter((e) => String(e.email || '').toLowerCase().trim() === email);
  const sector = user.data?.sector_id || user.sector_id;
  return byEmail.find((e) => e.user_id === user.id)
    || (sector ? byEmail.find((e) => e.sector_id === sector) : null)
    || byEmail.find((e) => e.status === 'activo')
    || byEmail[0] || null;
}

function elegibilidad(emp) {
  if (!emp) return 'Tu cuenta no tiene una ficha de empleado vinculada.';
  if (emp.status !== 'activo') return 'Tu ficha de empleado no está activa.';
  if (!ROLES_OK.includes(String(emp.role || '').toLowerCase().trim())) return 'Tu rol no usa el fichaje con cuenta.';
  if (dniDe(emp.dni).length < 7) return 'Tu ficha de empleado no tiene DNI cargado.';
  if (!emp.sector_id) return 'Tu ficha de empleado no tiene sector asignado.';
  return null;
}

const leanLoc = (l) => ({ id: l.id, name: l.name, address: l.address || '', latitude: l.latitude ?? null, longitude: l.longitude ?? null });

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e?.status === 401 ? null : Promise.reject(e)));
    if (!user) return fail('Tenés que iniciar sesión para fichar con tu cuenta.', 'no_elegible');
    const body = await req.json().catch(() => ({}));
    const { action, locationId } = body || {};
    if (action !== 'estado' && action !== 'fichar' && action !== 'preparar') return fail('Acción no válida.');
    if (action !== 'preparar' && (typeof locationId !== 'string' || !locationId.trim())) return fail('El código QR no tiene una ubicación válida.');

    const sb = base44.asServiceRole;
    const emp = await resolverEmpleado(sb, user);
    const motivo = elegibilidad(emp);
    if (motivo) return fail(motivo, 'no_elegible');
    const dni = dniDe(emp.dni);

    // Preparación para fichar sin señal: lugares activos del sector + jornada abierta de hoy.
    if (action === 'preparar') {
      const locs = [];
      let cursor;
      for (let i = 0; i < 20; i++) {
        const page = await sb.entities.LocationQR.filter({ sector_id: emp.sector_id, is_active: true }, { sort: 'name', limit: 500, ...(cursor ? { cursor } : {}) });
        locs.push(...lista(page));
        if (Array.isArray(page) || !page?.has_more || !page?.next_cursor) break;
        cursor = page.next_cursor;
      }
      const scopedP = createScopedClient(base44, emp.sector_id);
      const ahora = new Date();
      const abiertas = (await fetchAllFichajesPaginated(scopedP, { dni, estado: 'abierta' }, '-entrada_timestamp'))
        .filter((j) => !isExpiredOpenFichaje(j, ahora));
      const ab = abiertas[0];
      return Response.json({
        ok: true, user_id: user.id, operario_nombre: emp.full_name, employee_role: emp.role, sector_id: emp.sector_id,
        locations: locs.map(leanLoc),
        abierta: ab ? { location_qr_id: ab.location_qr_id, location_name: ab.location_name || '', entrada_timestamp: ab.entrada_timestamp } : null,
        server_time: ahora.toISOString(),
      });
    }

    const loc = await sb.entities.LocationQR.get(locationId).catch(nf);
    if (!loc) return fail('No encontramos ese punto de fichaje. Revisá el QR.');
    if (!loc.is_active) return fail('Este punto de fichaje está desactivado.');
    if (loc.sector_id !== emp.sector_id) return fail('Este punto de fichaje no pertenece a tu sector.');

    const scoped = createScopedClient(base44, emp.sector_id);
    const now = new Date();
    const rawOpen = await fetchAllFichajesPaginated(scoped, { dni, estado: 'abierta' });

    if (action === 'estado') {
      const abiertas = rawOpen.filter((j) => !isExpiredOpenFichaje(j, now));
      const aqui = abiertas.find((j) => j.location_qr_id === loc.id);
      const otra = aqui ? null : abiertas[0];
      return Response.json({
        ok: true, location: leanLoc(loc), operario_nombre: emp.full_name,
        tipo: aqui ? 'salida' : 'entrada',
        entrada_timestamp: aqui?.entrada_timestamp || null,
        otra_ubicacion: otra ? (otra.location_name || 'otro lugar') : null,
      });
    }

    // ── fichar ──
    const opId = body.client_op_id;
    if (typeof opId !== 'string' || opId.length < 8 || opId.length > 100) return fail('Falta el identificador de la operación. Volvé a intentar.');
    const lat = body.latitude, lng = body.longitude;
    if (!hasCoordinates(lat, lng)) return fail('Para fichar, activá la ubicación y permití el acceso al GPS.');
    const accuracy = Number.isFinite(body.accuracy) && body.accuracy > 0 ? Math.round(body.accuracy) : null;
    const distancia = getDistanceStatus(lat, lng, loc.latitude, loc.longitude, accuracy);

    const previo = lista(await scoped.entities.FichajeUbicacion.filter({ $or: [{ client_op_id: opId }, { salida_client_op_id: opId }] }, { limit: 1 }))[0];
    if (previo) {
      return Response.json({ ok: true, repetido: true, tipo: previo.salida_client_op_id === opId ? 'salida' : 'entrada', jornada: previo, location: leanLoc(loc), distancia });
    }

    if (body.modo === 'sin_conexion') {
      const r = await ficharSinConexion({ scoped, body, emp, user, loc, dni, opId, lat, lng, accuracy, distancia, rawOpen, now });
      return Response.json(r.ok ? { ...r, location: leanLoc(loc), distancia } : r);
    }

    const { activeToday } = await reconcileExpiredOpenFichajes(scoped, rawOpen, now, { throwOnFailure: true });
    const aqui = activeToday.find((j) => j.location_qr_id === loc.id);
    const otra = aqui ? null : activeToday[0];
    if (otra) return fail(`Tenés una entrada abierta en "${otra.location_name || 'otro lugar'}". Registrá primero la salida allí.`, 'otra_ubicacion');

    const lejos = distancia.status === 'far';
    const nota = `Fuera de radio (${distancia.text})`;
    const nowIso = now.toISOString();

    if (aqui) {
      const upd = { salida_timestamp: nowIso, salida_latitude: lat, salida_longitude: lng, salida_accuracy: accuracy, estado: 'cerrada', salida_client_op_id: opId };
      if (lejos) {
        const previas = (aqui.notas_admin || '').trim();
        upd.notas_admin = previas ? `${previas} | ${nota} en salida` : `${nota} en salida`;
        if (aqui.estado_admin !== 'incidencia') upd.estado_admin = 'pendiente';
      }
      const jornada = await scoped.entities.FichajeUbicacion.update(aqui.id, upd);
      return Response.json({ ok: true, tipo: 'salida', jornada, location: leanLoc(loc), distancia });
    }

    const jornada = await scoped.entities.FichajeUbicacion.create({
      location_qr_id: loc.id, location_name: loc.name,
      operario_nombre: emp.full_name, dni,
      entrada_timestamp: nowIso, entrada_latitude: lat, entrada_longitude: lng, entrada_accuracy: accuracy,
      estado: 'abierta', estado_admin: 'pendiente', ...(lejos ? { notas_admin: nota } : {}),
      jefe_sitio_email: loc.jefe_sitio_email || null,
      device_info: String(body.deviceInfo || '').slice(0, 500),
      user_id: user.id, employee_id: emp.id, metodo: 'cuenta', client_op_id: opId,
    });
    return Response.json({ ok: true, tipo: 'entrada', jornada, location: leanLoc(loc), distancia });
  } catch (error) {
    console.error('[ficharConCuenta]', error);
    return fail(error?.message ? `No se pudo registrar el fichaje: ${error.message}` : 'No se pudo registrar el fichaje. Volvé a intentar.');
  }
}