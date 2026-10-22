// base44/shared/fichajeAutoCierre.ts
//
// Utilidad canónica para el cierre automático al cambio de día (23:59:59 hora Argentina)
// de los fichajes que quedaron abiertos porque el operario no registró salida.

const AR_OFFSET_MS = -3 * 60 * 60 * 1000; // UTC-3 (Argentina, sin horario de verano)
const PAGE_LIMIT = 200;
const MAX_PAGES = 50;

export function getArDateStr(dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (!Number.isFinite(d.getTime())) return '';
  return new Date(d.getTime() + AR_OFFSET_MS).toISOString().split('T')[0];
}

export function getEndOfArDayIso(arDateStr) {
  // 23:59:59 en hora de Buenos Aires (UTC-3)
  return new Date(`${arDateStr}T23:59:59-03:00`).toISOString();
}

export function isExpiredOpenFichaje(fichaje, now = new Date()) {
  if (!fichaje || fichaje.estado !== 'abierta' || !fichaje.entrada_timestamp) return false;
  const entryDay = getArDateStr(fichaje.entrada_timestamp);
  const todayAr = getArDateStr(now);
  return Boolean(entryDay && todayAr && entryDay < todayAr);
}

export function buildAutoCierrePayload(fichaje, now = new Date()) {
  const entryDay = getArDateStr(fichaje.entrada_timestamp);
  const autoSalidaIso = entryDay ? getEndOfArDayIso(entryDay) : now.toISOString();
  const notaAuto = 'Cierre automático al cambio de día (23:59hs): el operario jamás fichó la salida.';
  const notasPrevias = (fichaje.notas_admin || '').trim();
  const notas_admin = notasPrevias
    ? (notasPrevias.includes('jamás fichó la salida') ? notasPrevias : `${notasPrevias} | ${notaAuto}`)
    : notaAuto;

  return {
    salida_timestamp: autoSalidaIso,
    salida_omitida: true,
    estado: 'salida_omitida',
    estado_admin: fichaje.estado_admin === 'revisado' ? 'revisado' : 'incidencia',
    notas_admin,
  };
}

/**
 * Carga todos los registros de FichajeUbicacion que coincidan con `query` mediante paginación
 * por cursor de SDK (sin truncarse en 500 ni usar operadores sobre campos integrados).
 * No silencia errores de lectura.
 */
export async function fetchAllFichajesPaginated(dataClient, query = {}, sort = 'entrada_timestamp') {
  const all = [];
  const seenIds = new Set();
  let cursor = undefined;

  for (let pageIdx = 0; pageIdx < MAX_PAGES; pageIdx++) {
    const opts = { sort, limit: PAGE_LIMIT };
    if (cursor) opts.cursor = cursor;

    const res = await dataClient.entities.FichajeUbicacion.filter(query, opts);

    if (Array.isArray(res)) {
      for (const item of res) {
        if (item?.id && !seenIds.has(item.id)) {
          seenIds.add(item.id);
          all.push(item);
        }
      }
      break;
    }

    const items = Array.isArray(res?.items) ? res.items : [];
    for (const item of items) {
      if (item?.id && !seenIds.has(item.id)) {
        seenIds.add(item.id);
        all.push(item);
      }
    }

    if (!res?.has_more || !res?.next_cursor || items.length === 0) {
      break;
    }
    cursor = res.next_cursor;
  }

  return all;
}

/**
 * Cierra automáticamente cualquier fichaje abierto de días anteriores dentro de una lista
 * usando el cliente con scope de sector provisto.
 * Solo considera cerrado un registro tras confirmar su persistencia.
 * Si alguna actualización falla, propaga un error accionable (o devuelve `failed` si throwOnFailure=false)
 * y mantiene los registros no confirmados dentro de `activeToday` para impedir estados inconsistentes.
 */
export async function reconcileExpiredOpenFichajes(
  dataClient,
  openRecords = [],
  now = new Date(),
  options = { throwOnFailure: true }
) {
  const activeToday = [];
  const expired = [];

  for (const rec of openRecords) {
    if (isExpiredOpenFichaje(rec, now)) {
      expired.push(rec);
    } else {
      activeToday.push(rec);
    }
  }

  const closedIds = [];
  const failed = [];

  if (expired.length > 0) {
    for (let i = 0; i < expired.length; i += 6) {
      const batch = expired.slice(i, i + 6);
      const batchResults = await Promise.all(
        batch.map(async (rec) => {
          try {
            // Re-verificar estado actual para prevenir inconsistencias por escrituras concurrentes
            const current = await dataClient.entities.FichajeUbicacion.get(rec.id);
            if (!current || current.estado !== 'abierta') {
              return { ok: true, id: rec.id, alreadyClosed: true };
            }
            const payload = buildAutoCierrePayload(current, now);
            const updated = await dataClient.entities.FichajeUbicacion.update(rec.id, payload);
            if (!updated || updated.estado !== 'salida_omitida') {
              throw new Error('No se confirmó el cambio de estado a salida_omitida');
            }
            return { ok: true, id: rec.id, updated };
          } catch (err) {
            return {
              ok: false,
              id: rec.id,
              record: rec,
              error: err?.message || 'Error al cerrar jornada vencida',
            };
          }
        })
      );

      for (const r of batchResults) {
        if (r.ok) {
          closedIds.push(r.id);
        } else {
          failed.push({ id: r.id, operario_nombre: r.record?.operario_nombre, error: r.error });
          // Si no se confirmó el cierre, el registro sigue abierto y no debe descartarse
          activeToday.push(r.record);
        }
      }
    }
  }

  if (failed.length > 0 && options?.throwOnFailure !== false) {
    const err = new Error(
      `No se pudo cerrar automáticamente ${failed.length} jornada(s) vencida(s) previa(s). Intentá nuevamente antes de registrar un nuevo fichaje.`
    );
    err.failed = failed;
    err.closedCount = closedIds.length;
    throw err;
  }

  return {
    activeToday,
    closedCount: closedIds.length,
    closedIds,
    failedCount: failed.length,
    failed,
  };
}