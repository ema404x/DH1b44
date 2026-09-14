import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Gestión de ObraCertificacion con matching tolerante de nombres.
 *
 * Permisos regidos por RolePermission (Control de Acceso) en lugar de
 * roles hardcodeados. Cualquier rol con create/update/delete habilitado
 * en RolePermission[CertificacionObras] puede operar.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const sb = base44.asServiceRole;

    // Fail closed en sector: sin sector → 403. NUNCA defaultear a 'escuela'.
    const callerSector = user.data?.sector_id || user.sector_id;
    if (!callerSector) {
      return Response.json({ error: 'Sin sector asignado' }, { status: 403 });
    }

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
    let emp = null;
    const byEmail = await sb.entities.Employee.filter({ email: user.email }).catch(() => []);
    emp = byEmail.find(e => e.email?.toLowerCase().trim() === user.email?.toLowerCase().trim());
    if (!emp) {
      const allEmps = await sb.entities.Employee.list('-created_date', 2000).catch(() => []);
      emp = allEmps.find(e => e.email?.toLowerCase().trim() === user.email?.toLowerCase().trim());
    }

    // Platform admin tiene acceso total
    const isPlatformAdmin = user.role === 'admin';

    // ── Resolver permisos desde RolePermission (Control de Acceso) ──
    let rolePerms = null;
    if (emp?.role) {
      let roleCandidates = await sb.entities.RolePermission.filter({ role_name: emp.role }).catch(() => []);
      if (!roleCandidates || roleCandidates.length === 0) {
        roleCandidates = await sb.entities.RolePermission.list('-created_date', 500).catch(() => []);
      }
      rolePerms = roleCandidates.find(
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
      const all = await sb.entities.ObraCertificacion.filter({ sector_id: callerSector });
      const obras = canViewAll ? all : all.filter(canAccess);
      return Response.json({ obras });
    }

    // ── UPDATE ──
    if (action === 'update') {
      const { id, data } = body;
      if (!id || !data) return Response.json({ error: 'id y data requeridos' }, { status: 400 });

      const existing = await sb.entities.ObraCertificacion.filter({ id }).catch(() => []);
      const obra = existing[0];
      if (!obra) return Response.json({ error: 'Obra no encontrada' }, { status: 404 });

      // Fail-closed: sector debe coincidir exactamente.
      if (obra.sector_id !== callerSector) {
        return Response.json({ error: 'Obra de otro sector. Cambiá de sector activo.' }, { status: 403 });
      }
      if (obra.ciclo_archivado && !canViewAll) {
        return Response.json({ error: 'Obra archivada: solo administradores pueden modificarla' }, { status: 403 });
      }
      if (!hasPermission('update')) {
        return Response.json({ error: 'No tenés permiso para editar obras' }, { status: 403 });
      }
      if (!canAccess(obra)) {
        return Response.json({ error: 'No tenés permiso para editar esta obra' }, { status: 403 });
      }

      const updated = await sb.entities.ObraCertificacion.update(id, data);
      return Response.json({ obra: updated });
    }

    // ── CREATE ──
    if (action === 'create') {
      if (!hasPermission('create')) {
        return Response.json({ error: 'No tenés permiso para crear obras' }, { status: 403 });
      }
      // Estampar sector_id del caller — asegura visibilidad tras el create
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
      const existing = await sb.entities.ObraCertificacion.filter({ id }).catch(() => []);
      const obra = existing[0];
      if (!obra) return Response.json({ error: 'Obra no encontrada' }, { status: 404 });
      // Fail-closed: sector debe coincidir exactamente.
      if (obra.sector_id !== callerSector) {
        return Response.json({ error: 'Obra de otro sector. Cambiá de sector activo.' }, { status: 403 });
      }
      await sb.entities.ObraCertificacion.delete(id);
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});