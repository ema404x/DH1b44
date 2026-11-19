// Fichaje con cuenta guardado en el teléfono sin señal y enviado después.
// Lo usa ficharConCuenta (modo 'sin_conexion'). La identidad, el lugar y el
// client_op_id ya vienen validados por quien llama.
import { getArDateStr, reconcileExpiredOpenFichajes } from './fichajeAutoCierre.ts';

const MIN = 60 * 1000;
const HORA = 60 * MIN;
const TOLERANCIA_FUTURO_MS = MIN;
const MAX_ANTIGUEDAD_MS = 72 * HORA;
const REVISAR_DESFASE_MS = 5 * MIN;
const REVISAR_DEMORA_MS = 12 * HORA;

const lista = (r) => (Array.isArray(r) ? r : (r?.items || []));
const fmtAr = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const sumarNota = (previas, nota) => { const p = String(previas || '').trim(); return p ? `${p} | ${nota}` : nota; };

/**
 * Corrige la hora del teléfono con el desfasaje de su reloj:
 * desfasaje = hora del servidor − hora del teléfono al enviar.
 * Devuelve { error } o { horaMs, desfaseMs, desfaseSeg, demoraMs }.
 */
export function corregirHoraSinConexion(horaDispositivo, horaEnvioDispositivo, nowMs) {
  const hd = Date.parse(horaDispositivo);
  const he = Date.parse(horaEnvioDispositivo);
  if (!Number.isFinite(hd) || !Number.isFinite(he)) return { error: 'Al fichaje guardado le falta la hora del teléfono. No se pudo registrar.', code: 'hora_invalida' };
  const desfaseMs = nowMs - he;
  let horaMs = hd + desfaseMs;
  if (horaMs > nowMs + TOLERANCIA_FUTURO_MS) {
    return { error: 'La hora del fichaje guardado queda en el futuro aun corrigiendo el reloj del teléfono. No se registró.', code: 'hora_futura' };
  }
  horaMs = Math.min(horaMs, nowMs);
  const demoraMs = nowMs - horaMs;
  if (demoraMs > MAX_ANTIGUEDAD_MS) {
    return { error: 'El fichaje guardado tiene más de 72 horas. Ya no se puede registrar desde el teléfono: avisá a tu jefe de sitio.', code: 'hora_vieja' };
  }
  return { horaMs, desfaseMs, desfaseSeg: Math.round(desfaseMs / 1000), demoraMs };
}

function motivosRevision({ desfaseMs, desfaseSeg, demoraMs }, distancia) {
  const m = [];
  if (Math.abs(desfaseMs) > REVISAR_DESFASE_MS) m.push(`Reloj del teléfono desfasado ${desfaseSeg} s`);
  if (demoraMs > REVISAR_DEMORA_MS) m.push(`Llegó ${Math.round(demoraMs / HORA)} h después del fichaje`);
  if (distancia?.status === 'far') m.push(`Fuera de radio (${distancia.text})`);
  return m;
}

/**
 * Registra un fichaje sin conexión. La decisión entrada/salida es la misma
 * regla de siempre, pero evaluada a la hora corregida. Si la salida llega para
 * una entrada del mismo día ya cerrada automáticamente, reemplaza ese cierre.
 * Devuelve { ok:false, code, error } o { ok:true, tipo, jornada, ... }.
 */
export async function ficharSinConexion({ scoped, body, emp, user, loc, dni, opId, lat, lng, accuracy, distancia, rawOpen, now }) {
  const hora = corregirHoraSinConexion(body.hora_dispositivo, body.hora_envio_dispositivo, now.getTime());
  if (hora.error) return { ok: false, code: hora.code, error: hora.error };

  const T = new Date(hora.horaMs);
  const tIso = T.toISOString();
  const tDia = getArDateStr(T);
  const nowIso = now.toISOString();
  const motivos = motivosRevision(hora, distancia);
  const extra = { hora_corregida: tIso, desfasaje_reloj_seg: hora.desfaseSeg, para_revisar: motivos.length > 0 };

  // Jornadas de días anteriores a la hora del fichaje: cierre automático de siempre.
  const vencidas = rawOpen.filter((j) => getArDateStr(j.entrada_timestamp) < tDia);
  if (vencidas.length) await reconcileExpiredOpenFichajes(scoped, vencidas, T, { throwOnFailure: true });
  const abiertasDelDia = rawOpen.filter((j) => getArDateStr(j.entrada_timestamp) === tDia);
  const aqui = abiertasDelDia.find((j) => j.location_qr_id === loc.id);
  const otra = aqui ? null : abiertasDelDia[0];
  if (otra) return { ok: false, code: 'otra_ubicacion', error: `Ese día ya tenías una entrada abierta en "${otra.location_name || 'otro lugar'}". El fichaje sin conexión no se registró.` };

  const salidaBase = {
    salida_timestamp: tIso, salida_latitude: lat, salida_longitude: lng, salida_accuracy: accuracy,
    estado: 'cerrada', salida_client_op_id: opId,
    salida_sin_conexion: true, salida_recibido_en: nowIso, salida_desfasaje_reloj_seg: hora.desfaseSeg,
  };

  if (aqui) {
    if (aqui.entrada_timestamp > tIso) return { ok: false, code: 'hora_invalida', error: 'La hora de la salida guardada es anterior a la entrada registrada. No se registró.' };
    const upd = { ...salidaBase };
    if (motivos.length) {
      upd.notas_admin = sumarNota(aqui.notas_admin, `Salida sin conexión: ${motivos.join('; ')}`);
      if (aqui.estado_admin !== 'incidencia') upd.estado_admin = 'pendiente';
    }
    const jornada = await scoped.entities.FichajeUbicacion.update(aqui.id, upd);
    return { ok: true, tipo: 'salida', jornada, ...extra };
  }

  // Salida real para una entrada del mismo día cerrada automáticamente (salida omitida).
  if (body.tipo_pensado === 'salida') {
    const cerradas = lista(await scoped.entities.FichajeUbicacion.filter(
      { dni, location_qr_id: loc.id, estado: 'salida_omitida' }, { sort: '-entrada_timestamp', limit: 20 },
    ));
    const omitida = cerradas.find((j) => j.salida_omitida === true
      && getArDateStr(j.entrada_timestamp) === tDia && j.entrada_timestamp <= tIso);
    if (omitida) {
      const nota = `Salida real registrada sin conexión (recibida ${fmtAr.format(now)}): reemplazó el cierre automático de las 23:59`;
      const jornada = await scoped.entities.FichajeUbicacion.update(omitida.id, {
        ...salidaBase, salida_omitida: false, estado_admin: 'pendiente',
        notas_admin: sumarNota(omitida.notas_admin, motivos.length ? `${nota}. ${motivos.join('; ')}` : nota),
      });
      return { ok: true, tipo: 'salida', reemplazo_cierre_automatico: true, jornada, ...extra, para_revisar: true };
    }
  }

  const jornada = await scoped.entities.FichajeUbicacion.create({
    location_qr_id: loc.id, location_name: loc.name,
    operario_nombre: emp.full_name, dni,
    entrada_timestamp: tIso, entrada_latitude: lat, entrada_longitude: lng, entrada_accuracy: accuracy,
    estado: 'abierta', estado_admin: 'pendiente',
    ...(motivos.length ? { notas_admin: `Entrada sin conexión: ${motivos.join('; ')}` } : {}),
    jefe_sitio_email: loc.jefe_sitio_email || null,
    device_info: String(body.deviceInfo || '').slice(0, 500),
    user_id: user.id, employee_id: emp.id, metodo: 'cuenta', client_op_id: opId,
    sin_conexion: true, recibido_en: nowIso, desfasaje_reloj_seg: hora.desfaseSeg,
  });
  return { ok: true, tipo: 'entrada', jornada, ...extra };
}