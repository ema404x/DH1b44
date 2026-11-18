// Utilidades de Órdenes rápidas (beta): fusión de cambios y verificación.

const nulo = (v) => (v === undefined || v === null ? null : v);

/**
 * Deja la OT solo con los campos de tablero. Si ya los tiene (caso normal)
 * devuelve el mismo objeto, para no re-renderizar las tarjetas.
 */
export function recortar(ot, campos) {
  const permitidos = new Set(campos);
  if (Object.keys(ot).every((k) => permitidos.has(k))) return ot;
  const r = {};
  campos.forEach((c) => { if (ot[c] !== undefined) r[c] = ot[c]; });
  return r;
}

/**
 * Fusiona la lista guardada con la respuesta de cambios: reemplaza las
 * modificadas, agrega las nuevas y quita las que ya no están en `ids`.
 * El orden es el de `ids` (el del servidor). Devuelve null si falta alguna
 * OT (hay que pedir todo de nuevo).
 */
export function fusionar(previas, cambios, ids, campos) {
  const porId = new Map();
  previas.forEach((o) => porId.set(o.id, o));
  cambios.forEach((o) => porId.set(o.id, o));
  if (!ids.every((id) => porId.has(id))) return null;
  return ids.map((id) => recortar(porId.get(id), campos));
}

/**
 * Compara el tablero de siempre (viejo) con Órdenes rápidas (nuevo): mismo
 * conjunto de ids y mismos valores en los campos de tablero.
 * Una OT modificada entre las dos consultas (updated_date posterior en la
 * nueva) no cuenta como diferencia.
 */
export function compararOrdenes(viejo, nuevo) {
  const campos = (nuevo.board_fields || []).filter((c) => c !== 'id');
  const diferencias = [];
  const nuevas = new Map(nuevo.orders.map((o) => [o.id, o]));
  const idsViejos = new Set();

  viejo.orders.forEach((v) => {
    idsViejos.add(v.id);
    const n = nuevas.get(v.id);
    if (!n) {
      diferencias.push({ id: v.id, campo: '(orden)', viejo: 'presente', nuevo: 'ausente' });
      return;
    }
    if (n.updated_date && v.updated_date && n.updated_date > v.updated_date) return;
    campos.forEach((c) => {
      const a = nulo(v[c]);
      const b = nulo(n[c]);
      if (a !== b && JSON.stringify(a) !== JSON.stringify(b)) {
        diferencias.push({ id: v.id, campo: c, viejo: a, nuevo: b });
      }
    });
  });

  nuevo.orders.forEach((n) => {
    if (!idsViejos.has(n.id)) {
      diferencias.push({ id: n.id, campo: '(orden)', viejo: 'ausente', nuevo: 'presente' });
    }
  });

  if ((viejo.archived_count || 0) !== (nuevo.archived_count || 0)) {
    diferencias.push({
      id: '—', campo: 'archivadas (total)',
      viejo: viejo.archived_count || 0, nuevo: nuevo.archived_count || 0,
    });
  }
  return diferencias;
}