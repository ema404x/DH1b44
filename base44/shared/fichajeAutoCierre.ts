// base44/shared/fichajeAutoCierre.ts
//
// Utilidad canónica para el cierre automático al cambio de día (23:59:59 hora Argentina)
// de los fichajes que quedaron abiertos porque el operario no registró salida.

const AR_OFFSET_MS = -3 * 60 * 60 * 1000; // UTC-3 (Argentina, sin horario de verano)

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
 * Cierra automáticamente cualquier fichaje abierto de días anteriores dentro de una lista
 * usando el cliente con scope de sector provisto, y devuelve solo los fichajes abiertos del día actual.
 */
export async function reconcileExpiredOpenFichajes(dataClient, openRecords = [], now = new Date()) {
  const activeToday = [];
  const expired = [];

  for (const rec of openRecords) {
    if (isExpiredOpenFichaje(rec, now)) {
      expired.push(rec);
    } else {
      activeToday.push(rec);
    }
  }

  if (expired.length > 0) {
    const updates = expired.map(rec => ({
      id: rec.id,
      ...buildAutoCierrePayload(rec, now),
    }));
    for (let i = 0; i < updates.length; i += 6) {
      const batch = updates.slice(i, i + 6);
      await Promise.allSettled(
        batch.map(u => {
          const { id, ...payload } = u;
          return dataClient.entities.FichajeUbicacion.update(id, payload);
        })
      );
    }
  }

  return { activeToday, closedCount: expired.length };
}