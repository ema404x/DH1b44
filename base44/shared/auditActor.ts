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

// Varias marcas de una vez (ediciones o borrados en lote).
export async function marcarActores(base44, entityType, entityIds, action) {
  const ids = (entityIds || []).filter(Boolean);
  for (let i = 0; i < ids.length; i += 200) {
    try {
      await base44.entities.AuditoriaActor.bulkCreate(
        ids.slice(i, i + 200).map((id) => ({ entity_type: entityType, entity_id: id, action })),
      );
    } catch (_) { /* la auditoría no debe bloquear la operación */ }
  }
}

// Crea un registro con service role y deja la marca de quien lo pidió.
export async function crearConActor(base44, entityType, data) {
  const creado = await base44.asServiceRole.entities[entityType].create(data);
  await marcarActor(base44, entityType, creado?.id, 'create');
  return creado;
}

// Portal sin login: el operario no tiene cuenta, así que la marca la deja el
// servidor con su nombre. Llamar solo DESPUÉS de validar la clave de operario.
export async function marcarOperarioPortal(base44, entityType, entityId, action, nombre) {
  if (!entityId) return;
  try {
    await base44.asServiceRole.entities.AuditoriaActor.create({
      entity_type: entityType,
      entity_id: entityId,
      action,
      actor_nombre: String(nombre || '').trim().slice(0, 80) || 'sin nombre',
    });
  } catch (_) { /* la auditoría no debe bloquear la operación */ }
}