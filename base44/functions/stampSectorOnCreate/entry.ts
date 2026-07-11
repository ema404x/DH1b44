import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const sb = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const event = body.event || {};
    const data = body.data || {};
    const entityName = event.entity_name;
    const entityId = event.entity_id;

    if (!entityName || !entityId) {
      return Response.json({ error: 'Missing entity_name or entity_id' }, { status: 400 });
    }

    // Determinar el sector del creador del registro
    let userSector = null;

    // Intentar contexto de usuario (funciona si la automatización preserva auth)
    try {
      const user = await base44.auth.me();
      if (user) {
        userSector = user?.sector_id || user?.data?.sector_id || null;
      }
    } catch (_) { /* sin contexto de usuario — fallback abajo */ }

    // Fallback: leer el sector del creador desde el registro de User
    if (!userSector && data.created_by_id) {
      try {
        const creator = await sb.entities.User.get(data.created_by_id);
        userSector = creator?.sector_id || creator?.data?.sector_id || null;
      } catch (_) { /* no se pudo leer el usuario */ }
    }

    if (!userSector) userSector = 'escuela';

    // Saltar si el registro ya tiene el sector correcto
    if (data.sector_id === userSector) {
      return Response.json({ success: true, skipped: true, sector_id: userSector });
    }

    // Actualizar el registro con el sector del creador
    const entityApi = sb.entities[entityName];
    if (!entityApi || typeof entityApi.update !== 'function') {
      return Response.json({ error: `Unknown entity: ${entityName}` }, { status: 400 });
    }

    await entityApi.update(entityId, { sector_id: userSector });
    return Response.json({ success: true, entity: entityName, id: entityId, sector_id: userSector });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});