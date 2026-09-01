import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { resolveAndReconcileSector } from '../../shared/callerIdentity.ts';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { entity_type, entity_id, action, old_values, new_values, changed_fields, notes } = await req.json();

  try {
    // Sector canónico del actor (regla de oro). Estampa sector_id en el log
    // para que el RLS aísle la auditoría entre sectores. Si no se resuelve,
    // queda null → fail-closed (ningún gerente lo ve; solo admins del sector
    // null, que no existe, así que queda fuera de alcance).
    const { sector } = await resolveAndReconcileSector(base44.asServiceRole, user);

    const auditEntry = {
      entity_type,
      entity_id,
      action,
      user_email: user.email,
      user_role: user.role || 'user',
      sector_id: sector || null,
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