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
    // Fallback 'SIN_SECTOR' (NO 'escuela'): un registro cuyo creador no resuelve
    // sector no debe colarse en el sector escuela. El centinela SIN_SECTOR es
    // consistente con el backfill y detectable con un solo filtro.
    if (!data.sector_id) {
      let sector = 'SIN_SECTOR';
      if (data.created_by_id) {
        try {
          const creator = await sb.entities.User.get(data.created_by_id);
          sector = creator?.sector_id || creator?.data?.sector_id || 'SIN_SECTOR';
        } catch (_) { /* queda SIN_SECTOR */ }
      }
      updates.sector_id = sector;
      if (sector === 'SIN_SECTOR') {
        console.warn(`[stampSectorOnCreate] SIN_SECTOR — entidad=${entityName} id=${entityId} created_by_id=${data.created_by_id || 'ninguno'}`);
      }
    }

    // ── Stamping de jefe_sitio y jefe_sitio_email para WorkOrder y Pendiente ──
    if ((entityName === 'WorkOrder' || entityName === 'Pendiente') && !data.jefe_sitio_email) {
      try {
        const normalize = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        const allEmployees = await sb.entities.Employee.list('-updated_date', 500);

        // Si jefe_sitio (nombre) está seteado, resolver email por fuzzy matching
        if (data.jefe_sitio) {
          const jefeNorm = normalize(data.jefe_sitio);
          let email = null;
          // 1) Exact match
          for (const emp of allEmployees) {
            if (emp.email && normalize(emp.full_name) === jefeNorm) {
              email = emp.email.toLowerCase().trim();
              break;
            }
          }
          // 2) Contains match (solo para nombres largos)
          if (!email && jefeNorm.length >= 10) {
            for (const emp of allEmployees) {
              if (!emp.email || !emp.full_name) continue;
              const empNorm = normalize(emp.full_name);
              if (empNorm.length >= 10 && (jefeNorm.includes(empNorm) || empNorm.includes(jefeNorm))) {
                email = emp.email.toLowerCase().trim();
                break;
              }
            }
          }
          // 3) Fuzzy: match by distinctive name parts
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
        } else if (data.created_by_id) {
          // Si jefe_sitio NO está seteado, resolver desde el Employee del creador
          // Solo si el creador es un jefe de sitio
          const creator = allEmployees.find(e => e.user_id === data.created_by_id);
          if (creator && creator.email && creator.role && creator.role.toLowerCase().includes('jefe')) {
            updates.jefe_sitio = creator.full_name;
            updates.jefe_sitio_email = creator.email.toLowerCase().trim();
          }
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