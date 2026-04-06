import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { entity_type, entity_id, action, old_values, new_values, changed_fields, notes } = await req.json();

  try {
    const auditEntry = {
      entity_type,
      entity_id,
      action,
      user_email: user.email,
      user_role: user.role || 'user',
      timestamp: new Date().toISOString(),
      old_values: action === 'update' ? old_values : null,
      new_values: action === 'update' ? new_values : null,
      changed_fields: changed_fields || [],
      notes
    };

    await base44.asServiceRole.entities.AuditLog.create(auditEntry);

    return Response.json({ success: true, auditId: entity_id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});