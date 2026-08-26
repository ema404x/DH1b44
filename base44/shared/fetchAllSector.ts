// base44/shared/fetchAllSector.ts
//
// Paginación robusta para asServiceRole.entities.X.filter() en funciones backend.
//
// PROBLEMA del cursor `$gt created_date`
//   Si varios registros comparten el mismo `created_date` (típico en bulkCreate
//   e imports masivos, donde el server estampa el mismo segundo a todo el lote),
//   el cursor `$gt` SALTEA los registros con fecha == cursor que aún no se leyeron
//   → KPIs subreportados de forma silenciosa.
//
// SOLUCIÓN
//   Cursor `$gte` (inclusivo) + exclusión por id de los registros ya leídos en la
//   fecha-boundary. Así los registros con created_date idéntico se traen todos
//   (re-leyendo la boundary pero dedupeando por id), sin saltear ninguno. El set
//   de ids excluidos es SOLO el de la boundary actual (bounded por el tamaño del
//   lote con mismo timestamp), no el total acumulado → query coste controlado.

export async function fetchAll(
  sb: any,
  entity: string,
  query: Record<string, any> = {},
  sort = 'created_date',
): Promise<any[]> {
  const all: any[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  let boundaryIds = new Set<string>(); // ids ya leídos con created_date === cursor

  for (let i = 0; i < 500; i++) {
    // hard cap ~250k registros
    let batch: any[] = [];
    try {
      const q: Record<string, any> = { ...query };
      if (cursor) q.created_date = { $gte: cursor };
      if (boundaryIds.size > 0) q.id = { $nin: [...boundaryIds] };
      batch = await sb.entities[entity].filter(q, sort, 500);
    } catch {
      break;
    }
    if (!batch || batch.length === 0) break;

    const fresh = batch.filter((r) => r && r.id && !seen.has(r.id));
    fresh.forEach((r) => {
      seen.add(r.id);
      all.push(r);
    });

    if (batch.length < 500) break; // última página → terminado

    const last = batch[batch.length - 1];
    const lastDate = last?.created_date;
    if (!lastDate) break;

    if (lastDate !== cursor) {
      // Avanzó la fecha: nueva boundary con los ids de esta página que tienen lastDate.
      cursor = lastDate;
      boundaryIds = new Set(
        batch.filter((r) => r.created_date === lastDate).map((r) => r.id),
      );
    } else {
      // Mismo cursor: la página (o parte) es de la misma fecha-boundary. Seguimos
      // excluyendo los ya leídos para no re-leerlos infinitamente.
      batch
        .filter((r) => r.created_date === lastDate)
        .forEach((r) => boundaryIds.add(r.id));
    }

    // Guarda anti-loop: si no avanzó nada nuevo, detener (no debería pasar con
    // $nin correcto, pero defiende contra SDK inesperado).
    if (fresh.length === 0) break;
  }

  return all;
}