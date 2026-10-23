import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import { createScopedClient, sectorErrorResponse } from '../../shared/sectorGuard.ts';
import { resolveCallerSectorCanonical } from '../../shared/callerIdentity.ts';

/**
 * Gestión de ObraCertificacion con aislamiento por sector canónico
 * y limpieza administrativa verificada del ciclo activo.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const rawSb = base44.asServiceRole;

    // Resolver sector canónico desde la ficha Employee o plataforma, fail-closed
    const { sector: callerSector, employee: canonicalEmp } = await resolveCallerSectorCanonical(rawSb, user);
    if (!callerSector) {
      return Response.json({ error: 'Sin sector asignado' }, { status: 403 });
    }

    const sb = createScopedClient(base44, callerSector);
    const body = await req.json();
    const { action } = body;

    // ── Normalización de nombres para matching tolerante ──
    const nameKey = (s) => {
      if (!s) return '';
      return s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[,.\-_'/]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .sort()
        .join('');
    };

    // ── Resolver empleado vinculado ──
    let emp = canonicalEmp;
    if (!emp && user.email) {
      const byEmail = await sb.entities.Employee.filter({ email: user.email }, '-created_date', 100).catch(() => []);
      const emailItems = Array.isArray(byEmail) ? byEmail : (byEmail?.items || []);
      emp = emailItems.find(e => e.email?.toLowerCase().trim() === user.email?.toLowerCase().trim()) || null;
    }

    // Platform admin tiene acceso total
    const isPlatformAdmin = user.role === 'admin';

    // ── Resolver permisos desde RolePermission (Control de Acceso) ──
    let rolePerms = null;
    if (emp?.role) {
      let roleCandidates = await rawSb.entities.RolePermission.filter({ role_name: emp.role }, '-created_date', 100).catch(() => []);
      let rcItems = Array.isArray(roleCandidates) ? roleCandidates : (roleCandidates?.items || []);
      if (rcItems.length === 0) {
        const allRoles = await rawSb.entities.RolePermission.list('-created_date', 500).catch(() => []);
        rcItems = Array.isArray(allRoles) ? allRoles : (allRoles?.items || []);
      }
      rolePerms = rcItems.find(
        rp => rp.role_name?.toLowerCase().trim() === emp.role.toLowerCase().trim()
      ) || null;
    }

    const MODULE = 'CertificacionObras';
    const hasPermission = (actionName) => {
      if (isPlatformAdmin) return true;
      const perms = rolePerms?.permissions?.[MODULE];
      return !!(perms && perms[actionName] === true);
    };

    // admin_view = ver todas las obras del sector (ignora filtro de propietario)
    const canViewAll = isPlatformAdmin || hasPermission('admin_view');

    // Verifica si un registro es accesible para el usuario actual
    const canAccess = (obra) => {
      if (canViewAll) return true;
      if (!obra) return false;
      if (obra.created_by_id === user.id) return true;
      if (!emp || emp.user_id !== user.id) return false;
      const empKey = nameKey(emp.full_name);
      const jefeKey = nameKey(obra.jefe_sitio);
      const inspKey = nameKey(obra.inspector);
      return (jefeKey && jefeKey === empKey)
          || (inspKey && inspKey === empKey);
    };

    // ── LIST ──
    if (action === 'list') {
      const res = await sb.entities.ObraCertificacion.filter({}, '-created_date', 5000);
      const all = Array.isArray(res) ? res : (res?.items || []);
      const obras = canViewAll ? all : all.filter(canAccess);
      return Response.json({ obras });
    }

    // ── UPDATE ──
    if (action === 'update') {
      const { id, data } = body;
      if (!id || !data) return Response.json({ error: 'id y data requeridos' }, { status: 400 });

      const obra = await sb.entities.ObraCertificacion.get(id).catch(() => null);
      if (!obra) return Response.json({ error: 'Obra no encontrada o de otro sector' }, { status: 404 });

      if (obra.ciclo_archivado && !canViewAll) {
        return Response.json({ error: 'Obra archivada: solo administradores pueden modificarla' }, { status: 403 });
      }
      if (!hasPermission('update')) {
        return Response.json({ error: 'No tenés permiso para editar obras' }, { status: 403 });
      }
      if (!canAccess(obra)) {
        return Response.json({ error: 'No tenés permiso para editar esta obra' }, { status: 403 });
      }

      if (Object.prototype.hasOwnProperty.call(data, 'sector_id') && data.sector_id !== callerSector) {
        return Response.json({ error: 'No se permite transferir obras a otro sector. Seleccioná el sector activo para operar.' }, { status: 403 });
      }
      const updated = await sb.entities.ObraCertificacion.update(id, { ...data, sector_id: callerSector });
      return Response.json({ obra: updated });
    }

    // ── CREATE ──
    if (action === 'create') {
      if (!hasPermission('create')) {
        return Response.json({ error: 'No tenés permiso para crear obras' }, { status: 403 });
      }
      const data = { ...body.data, sector_id: callerSector };
      const created = await sb.entities.ObraCertificacion.create(data);
      return Response.json({ obra: created });
    }

    // ── DELETE ──
    if (action === 'delete') {
      if (!hasPermission('delete')) {
        return Response.json({ error: 'No tenés permiso para eliminar obras' }, { status: 403 });
      }
      const { id } = body;
      if (!id) return Response.json({ error: 'id requerido' }, { status: 400 });
      const obra = await sb.entities.ObraCertificacion.get(id).catch(() => null);
      if (!obra) return Response.json({ error: 'Obra no encontrada o de otro sector' }, { status: 404 });
      await sb.entities.ObraCertificacion.delete(id);
      return Response.json({ success: true });
    }

    // ── CLEAR ACTIVE CYCLE (Admin only, sector-scoped, non-archived only) ──
    if (action === 'clearActiveCycle') {
      if (!isPlatformAdmin) {
        return Response.json({ error: 'Solo administradores pueden limpiar el ciclo activo' }, { status: 403 });
      }
      if (Object.prototype.hasOwnProperty.call(body, 'sector_id') && body.sector_id !== callerSector) {
        return Response.json({ error: 'No se permite especificar un sector distinto al sector activo del usuario' }, { status: 403 });
      }

      const activeQuery = { ciclo_archivado: { $ne: true } };
      const initialTotal = await sb.entities.ObraCertificacion.count(activeQuery);

      if (body.dry_run === true) {
        return Response.json({
          success: true,
          dry_run: true,
          sector: callerSector,
          candidatas: initialTotal,
        });
      }

      if (initialTotal === 0) {
        return Response.json({
          success: true,
          sector: callerSector,
          deleted: 0,
          remaining: 0,
        });
      }

      // Cargar todas las obras activas del sector y verificar explícitamente que ninguna esté archivada
      const res = await sb.entities.ObraCertificacion.filter(activeQuery, '-created_date', 5000);
      const candidates = (Array.isArray(res) ? res : (res?.items || []))
        .filter(o => o && o.sector_id === callerSector && o.ciclo_archivado !== true);

      let deletedCount = 0;
      const failed = [];

      for (let i = 0; i < candidates.length; i += 6) {
        const batch = candidates.slice(i, i + 6);
        const results = await Promise.allSettled(
          batch.map(o => sb.entities.ObraCertificacion.delete(o.id))
        );
        results.forEach((r, idx) => {
          if (r.status === 'fulfilled') {
            deletedCount++;
          } else {
            failed.push({
              id: batch[idx].id,
              titulo: batch[idx].titulo,
              error: r.reason?.message || 'Error al eliminar',
            });
          }
        });
      }

      const remaining = await sb.entities.ObraCertificacion.count(activeQuery);

      if (deletedCount > 0) {
        await sb.entities.AuditLog.create({
          entity_type: 'ObraCertificacion',
          entity_id: `sector:${callerSector}:ciclo_activo`,
          action: 'delete',
          user_email: user.email,
          user_role: user.role,
          timestamp: new Date().toISOString(),
          notes: `Limpieza de ciclo actual en sector ${callerSector}: ${deletedCount} de ${initialTotal} obras actuales eliminadas (restantes: ${remaining}).`,
        });
      }

      if (failed.length > 0 || remaining > 0) {
        return Response.json(
          {
            success: false,
            error: `La limpieza quedó incompleta: se eliminaron ${deletedCount} de ${initialTotal} obras (${remaining} aún activas).`,
            sector: callerSector,
            deleted: deletedCount,
            remaining,
            failed,
          },
          { status: 500 }
        );
      }

      return Response.json({
        success: true,
        sector: callerSector,
        deleted: deletedCount,
        remaining: 0,
      });
    }

    return Response.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error) {
    return sectorErrorResponse(error);
  }
}