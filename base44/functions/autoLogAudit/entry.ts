import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Función llamada automáticamente por automaciones de entidad.
 * Registra en AuditLog cualquier create/update/delete sobre las entidades monitoreadas.
 * NOTA: Las automaciones corren como sistema, sin token de usuario — usar asServiceRole directamente.
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
    const IGNORE_FIELDS = ['updated_date', 'created_date'];
    let changed_fields = [];
    if (event.type === 'update' && data && old_data) {
      changed_fields = Object.keys(data).filter(k => {
        if (IGNORE_FIELDS.includes(k)) return false;
        return JSON.stringify(data[k]) !== JSON.stringify(old_data[k]);
      });
      // Si no hay cambios reales, no registrar
      if (changed_fields.length === 0) {
        return Response.json({ success: true, skipped: true });
      }
    }

    // Intentar obtener el usuario que disparó la acción desde el token de request.
    // En automaciones de entidad el contexto es sistema, fallback a created_by del registro.
    let actorEmail = 'sistema';
    try {
      const actor = await base44.auth.me();
      if (actor?.email) actorEmail = actor.email;
    } catch { /* automación sin sesión de usuario — es normal */ }
    if (actorEmail === 'sistema') {
      actorEmail = (event.type === 'update' ? old_data?.created_by : data?.created_by) || 'sistema';
    }

    const auditEntry = {
      entity_type: event.entity_name,
      entity_id: event.entity_id,
      action: event.type,
      user_email: actorEmail,
      user_role: actorEmail === 'sistema' ? 'sistema' : 'usuario',
      timestamp: new Date().toISOString(),
      old_values: event.type === 'update' ? old_data : null,
      new_values: event.type === 'update' ? data : null,
      changed_fields,
      notes: null
    };

    // Usar siempre asServiceRole — las automaciones corren sin sesión de usuario
    await base44.asServiceRole.entities.AuditLog.create(auditEntry);

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});