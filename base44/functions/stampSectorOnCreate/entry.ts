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

    const entityApi = sb.entities[entityName];
    if (!entityApi || typeof entityApi.update !== 'function') {
      return Response.json({ error: `Unknown entity: ${entityName}` }, { status: 400 });
    }

    const updates = {};

    // ── Stamping de sector_id si falta ──
    if (!data.sector_id) {
      let sector = 'escuela';
      if (data.created_by_id) {
        try {
          const creator = await sb.entities.User.get(data.created_by_id);
          sector = creator?.sector_id || creator?.data?.sector_id || 'escuela';
        } catch (_) { /* usar default */ }
      }
      updates.sector_id = sector;
    }

    // ── Stamping de jefe_sitio_email para WorkOrder ──
    // Si la OT tiene jefe_sitio (nombre) pero no jefe_sitio_email, resolver el email
    // desde los registros de Employee usando fuzzy matching.
    if (entityName === 'WorkOrder' && data.jefe_sitio && !data.jefe_sitio_email) {
      try {
        const normalize = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        const allEmployees = await sb.entities.Employee.list('-updated_date', 500);
        const jefeNorm = normalize(data.jefe_sitio);

        // 1) Exact match
        let email = null;
        for (const emp of allEmployees) {
          if (emp.email && normalize(emp.full_name) === jefeNorm) {
            email = emp.email.toLowerCase().trim();
            break;
          }
        }

        // 2) Contains match
        if (!email) {
          for (const emp of allEmployees) {
            if (!emp.email || !emp.full_name) continue;
            const empNorm = normalize(emp.full_name);
            if (jefeNorm.includes(empNorm) || empNorm.includes(jefeNorm)) {
              email = emp.email.toLowerCase().trim();
              break;
            }
          }
        }

        // 3) Fuzzy: match by distinctive name parts (last names)
        if (!email) {
          const jefeParts = jefeNorm.split(/\s+/).filter(p => p.length > 2);
          let bestScore = 0;
          let bestEmail = null;
          for (const emp of allEmployees) {
            if (!emp.email || !emp.full_name) continue;
            const empParts = normalize(emp.full_name).split(/\s+/).filter(p => p.length > 2);
            const common = empParts.filter(p => jefeParts.includes(p));
            if (common.length >= 1 && common.length > bestScore) {
              bestScore = common.length;
              bestEmail = emp.email.toLowerCase().trim();
            }
          }
          email = bestEmail;
        }

        if (email) {
          updates.jefe_sitio_email = email;
        }
      } catch (err) {
        console.warn(`[stampSectorOnCreate] Error resolving jefe_sitio_email: ${err.message}`);
      }
    }

    // Si no hay nada que actualizar, salir
    if (Object.keys(updates).length === 0) {
      return Response.json({ success: true, skipped: true });
    }

    await entityApi.update(entityId, updates);
    return Response.json({ success: true, entity: entityName, id: entityId, updates });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});