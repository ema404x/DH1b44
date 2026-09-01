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

    // ── Resolver el sector del registro (data.sector_id o el del creador) ──
    // Se usa tanto para estampar sector_id si falta como para scopear la
    // resolución de jefe_sitio_email al MISMO sector. Esto previene la fuga
    // cross-sector: un "Juan Pérez" del sector B no debe matchear una OT del
    // sector A (RLS daría visibilidad al jefe del otro sector via email).
    // CANONICAL: Employee.sector_id es la fuente de verdad (igual que
    // resolveAndReconcileSector usado por buildOtVisibilityContext). El sector
    // de plataforma (User.sector_id) puede estar desfasado/stale → estampar
    // desde ahí atribuye la OT al sector equivocado y el creador la pierde
    // (otEsVisiblePara usa el sector del Empleado). Resolvemos primero por
    // user_id en la ficha Employee; si no hay ficha, backstop en el user de
    // plataforma (super-admin puro sin ficha).
    let recordSector = data.sector_id || null;
    if (!recordSector && data.created_by_id) {
      try {
        const emps = await sb.entities.Employee.filter({ user_id: data.created_by_id });
        const emp = emps?.[0];
        recordSector = emp?.sector_id || null;
        if (!recordSector) {
          const creator = await sb.entities.User.get(data.created_by_id);
          recordSector = creator?.data?.sector_id || creator?.sector_id || null;
        }
      } catch (_) { /* queda null */ }
    }

    // ── Stamping de sector_id si falta ──
    // Fallback 'SIN_SECTOR' (NO 'escuela'): un registro cuyo creador no resuelve
    // sector no debe colarse en el sector escuela. El centinela SIN_SECTOR es
    // consistente con el backfill y detectable con un solo filtro.
    if (!data.sector_id) {
      const sector = recordSector || 'SIN_SECTOR';
      updates.sector_id = sector;
      if (sector === 'SIN_SECTOR') {
        console.warn(`[stampSectorOnCreate] SIN_SECTOR — entidad=${entityName} id=${entityId} created_by_id=${data.created_by_id || 'ninguno'}`);
      }
    }

    // ── Stamping de jefe_sitio y jefe_sitio_email para WorkOrder y Pendiente ──
    // Scopeado al sector del registro (recordSector). Si no se resolvió sector,
    // fallback a todos (legacy) — pero ese caso ya queda marcado SIN_SECTOR arriba.
    if ((entityName === 'WorkOrder' || entityName === 'Pendiente') && !data.jefe_sitio_email) {
      try {
        const normalize = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        const allEmployees = recordSector
          ? await sb.entities.Employee.filter({ sector_id: recordSector })
          : await sb.entities.Employee.list('-updated_date', 500);

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

    // ── Stamping de scheduled_date en WorkOrder al crear (regla de oro) ──
    // Una OT sin fecha agendada queda "flotando". Al guardarla (create) sin
    // fecha, se estampa la fecha del día (tz America/Buenos_Aires). Solo en
    // create: en update no se toca — el backfill ya cubrió las históricas con
    // su created_date. No aplica a Pendiente (esos usan fecha_emision_sap).
    if (entityName === 'WorkOrder' && event.type === 'create' && !data.scheduled_date) {
      try {
        updates.scheduled_date = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Buenos_Aires' });
      } catch (_) {
        updates.scheduled_date = new Date().toISOString().slice(0, 10);
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