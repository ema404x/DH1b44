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

    // Saltar si el registro ya tiene sector_id asignado
    if (data.sector_id) {
      return Response.json({ success: true, skipped: true, sector_id: data.sector_id });
    }

    // Obtener el sector del creador desde su registro de User
    let sector = 'escuela';
    if (data.created_by_id) {
      try {
        const creator = await sb.entities.User.get(data.created_by_id);
        sector = creator?.sector_id || creator?.data?.sector_id || 'escuela';
      } catch (_) { /* usar default */ }
    }

    // Actualizar el registro con el sector del creador
    const entityApi = sb.entities[entityName];
    if (!entityApi || typeof entityApi.update !== 'function') {
      return Response.json({ error: `Unknown entity: ${entityName}` }, { status: 400 });
    }

    await entityApi.update(entityId, { sector_id: sector });
    return Response.json({ success: true, entity: entityName, id: entityId, sector_id: sector });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});