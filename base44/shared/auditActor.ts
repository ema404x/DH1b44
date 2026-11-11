// Deja constancia de QUIÉN está por crear/editar/eliminar un registro auditado.
//
// Los eventos de entidad que alimentan la auditoría no informan quién hizo el
// cambio. Esta marca se crea con el token del usuario (no con service role):
// la plataforma estampa created_by_id, que es el autor real y no se puede
// falsear. autoLogAudit la consume al registrar el evento.
//
// Llamar ANTES de update/delete y DESPUÉS de create (cuando ya hay id).
// Nunca interrumpe la operación: si falla, el evento queda como "sistema".
export async function marcarActor(base44, entityType, entityId, action) {
  if (!entityId) return;
  try {
    await base44.entities.AuditoriaActor.create({ entity_type: entityType, entity_id: entityId, action });
  } catch (_) { /* la auditoría no debe bloquear la operación */ }
}