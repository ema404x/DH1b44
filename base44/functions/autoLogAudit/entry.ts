import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Función llamada automáticamente por automaciones de entidad.
 * Registra en AuditLog cualquier create/update/delete sobre las entidades monitoreadas.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const { event, data, old_data } = body;

    if (!event || !event.type || !event.entity_name || !event.entity_id) {
      return Response.json({ error: 'Payload inválido' }, { status: 400 });
    }

    // Calcular campos modificados en updates
    let changed_fields = [];
    if (event.type === 'update' && data && old_data) {
      changed_fields = Object.keys(data).filter(k => {
        if (['updated_date'].includes(k)) return false;
        return JSON.stringify(data[k]) !== JSON.stringify(old_data[k]);
      });
    }

    const auditEntry = {
      entity_type: event.entity_name,
      entity_id: event.entity_id,
      action: event.type, // create | update | delete
      user_email: data?.created_by || old_data?.created_by || 'sistema',
      user_role: 'sistema',
      timestamp: new Date().toISOString(),
      old_values: event.type === 'update' ? old_data : null,
      new_values: event.type === 'update' ? data : null,
      changed_fields,
      notes: `Registro automático vía automation`
    };

    await base44.asServiceRole.entities.AuditLog.create(auditEntry);

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});