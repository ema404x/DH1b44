// src/lib/fetchAllList.js
//
// Pagina .list() con skip hasta traer TODOS los registros del sector del
// usuario (RLS ya filtra por sector). .list(sort, limit, skip) soporta skip
// posicional → robusto ante created_date idénticos (imports masivos).
//
// Antes WorkOrders.jsx traía Direccion.list(..., 500) y Employee.list(..., 500):
// si el sector superaba 500, los lookups addrToJefe / employeeLookup quedaban
// incompletos → resolveJefe no resolvía el jefe de OTs sin jefe_sitio directo.
//
// Guarda anti-loop: si skip no avanza (SDK sin soporte de skip), dedupea por id
// y detiene en cuanto una página es enteramente ya vista.

import { base44 } from '@/api/base44Client';

export async function fetchAllList(
  entityName,
  sort = '-created_date',
  pageSize = 500,
) {
  const all = [];
  const seen = new Set();
  let skip = 0;
  for (let i = 0; i < 1000; i++) {
    let batch;
    try {
      batch = await base44.entities[entityName].list(sort, pageSize, skip);
    } catch {
      break;
    }
    if (!batch || batch.length === 0) break;
    const fresh = batch.filter((r) => r && r.id && !seen.has(r.id));
    fresh.forEach((r) => seen.add(r.id));
    all.push(...fresh);
    if (batch.length < pageSize) break;
    if (fresh.length === 0) break; // skip no avanzó → detener
    skip += pageSize;
  }
  return all;
}