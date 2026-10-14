import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { normalizeRole } from "../../shared/roles.ts";

/**
 * cambiarSectorActivo — Cambia el sector_id del usuario actual (sector activo).
 *
 * Modelo B: solo platform admins y empleados con rol `gerente_general` pueden cambiar.
 * Estampa `sector_base` la primera vez que el usuario cambia (preserva su sector de origen).
 * Valida que el sector destino exista y esté activo.
 *
 * Bypassa RLS de User.update (admin-only) vía asServiceRole.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { sector_destino } = body;
    if (!sector_destino || typeof sector_destino !== 'string') {
      return Response.json({ error: 'sector_destino es requerido' }, { status: 400 });
    }

    const sb = base44.asServiceRole;

    // Resolver la misma ficha que se utilizará al recargar, también para admins.
    const sectorIdActual = user.sector_id ?? user.data?.sector_id ?? null;
    const byUserId = await sb.entities.Employee.filter({ user_id: user.id }, { limit: 1 });
    let emp = byUserId.items[0] || null;
    if (!emp && user.email) {
      const emailPattern = user.email.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const byEmail = await sb.entities.Employee.filter(
        { email: { $regex: `^\\s*${emailPattern}\\s*$`, $options: 'i' } },
        { limit: 50 }
      );
      emp = byEmail.items.find(e => e.user_id === user.id)
        || byEmail.items.find(e => e.sector_id === sectorIdActual)
        || byEmail.items.find(e => e.status === 'activo')
        || byEmail.items[0] || null;
    }
    if (user.role !== 'admin' && normalizeRole(emp?.role) !== 'gerente_general') {
      return Response.json({ error: 'Forbidden: solo administradores y gerente_general pueden cambiar de sector' }, { status: 403 });
    }

    // ── Validar que el sector destino exista y esté activo ──
    const sectores = await sb.entities.Sector.filter({ clave: sector_destino }, { limit: 1 });
    const sector = sectores.items[0];
    if (!sector) return Response.json({ error: 'Sector no encontrado' }, { status: 404 });
    if (sector.activo === false) {
      return Response.json({ error: 'Sector inactivo' }, { status: 409 });
    }

    // Los campos personalizados se leen en el nivel superior del SDK.
    // Quitar solo las copias legacy del sector dentro del campo personalizado
    // `data`: no son el contenedor interno que usa RLS y pueden estar obsoletas.
    const sectorBaseActual = user.sector_base ?? user.data?.sector_base ?? null;
    const updatePayload = { sector_id: sector_destino };
    const hasLegacySector = user.data && typeof user.data === 'object'
      && ('sector_id' in user.data || 'sector_base' in user.data);
    if (hasLegacySector) {
      const { sector_id: obsoleteSector, sector_base: obsoleteBase, ...otherData } = user.data;
      updatePayload.data = otherData;
    }
    if (sectorBaseActual) {
      updatePayload.sector_base = sectorBaseActual;
    } else if (sectorIdActual && sectorIdActual !== sector_destino) {
      updatePayload.sector_base = sectorIdActual;
    }

    // Guardar y comprobar ambas partes antes de confirmar. Un admin sin ficha
    // Employee puede cambiar igualmente. Si falla, restaurar lo que se intentó.
    let employeeAttempted = false;
    let userAttempted = false;
    let stage = 'sincronizar la ficha de empleado';
    try {
      if (emp) {
        employeeAttempted = true;
        await sb.entities.Employee.update(emp.id, { sector_id: sector_destino, user_id: user.id });
        const savedEmployee = await sb.entities.Employee.get(emp.id);
        if (savedEmployee.sector_id !== sector_destino) {
          throw new Error('El sector de la ficha no se guardó');
        }
      }
      stage = 'guardar el sector de la cuenta';
      userAttempted = true;
      await sb.entities.User.update(user.id, updatePayload);
      const savedUser = await sb.entities.User.get(user.id);
      if (savedUser.sector_id !== sector_destino
        || (hasLegacySector && savedUser.data?.sector_id !== undefined)) {
        throw new Error('El sector de la cuenta no se guardó');
      }
    } catch (error) {
      const restoreTasks = [];
      if (userAttempted) {
        restoreTasks.push(sb.entities.User.update(user.id, {
          sector_id: sectorIdActual || '', sector_base: sectorBaseActual || '',
          ...(hasLegacySector ? { data: user.data } : {})
        }));
      }
      if (employeeAttempted) {
        restoreTasks.push(sb.entities.Employee.update(emp.id, {
          sector_id: emp.sector_id || '', user_id: emp.user_id || ''
        }));
      }
      const restored = await Promise.allSettled(restoreTasks);
      if (restored.some(result => result.status === 'rejected')) {
        console.error('No se pudo restaurar el sector anterior');
        return Response.json({ error: 'No se pudo completar ni restaurar el cambio de sector. Volvé a intentarlo antes de continuar.' }, { status: 500 });
      }
      return Response.json({ error: `No se pudo ${stage}: ${error.message}` }, { status: 500 });
    }

    return Response.json({
      ok: true,
      sector_activo: sector_destino,
      sector_base: updatePayload.sector_base || sectorBaseActual,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}