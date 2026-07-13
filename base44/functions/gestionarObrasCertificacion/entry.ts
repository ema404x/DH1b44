import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Gestión de ObraCertificacion con matching tolerante de nombres.
 *
 * El RLS de la entidad compara jefe_sitio/inspector contra user.full_name con
 * match exacto, pero los datos vienen de SAP en formato "APELLIDO, Nombre"
 * mientras que user.full_name puede estar en otro formato o sin sincronizar.
 * Esta función usa service-role + matching tolerante para resolver el mismatch.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const sb = base44.asServiceRole;
    const body = await req.json();
    const { action } = body;

    // ── Normalización de nombres para matching tolerante ──
    // Convierte cualquier nombre en una key canónica:
    //   "APARICIO, Nolberto"  → "aparicionolberto"
    //   "Nolberto Aparicio"   → "aparicionolberto"
    //   "LAROCCA, Cynthia"    → "cynthialarocca"
    //   "Cynthia La Rocca"    → "cynthialarocca"
    // Maneja: mayúsculas, acentos, comas, guiones, espacios múltiples,
    // apellidos compuestos, y orden de palabras.
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

    const ADMIN_ROLES = ['administrativo', 'admin', 'gerente', 'gerencia'];
    const empRole = (emp?.role || '').toLowerCase().trim();
    const isSuperAdmin = user.role === 'admin' || ADMIN_ROLES.includes(empRole);

    // Verifica si un registro es accesible para el usuario actual
    const canAccess = (obra) => {
      if (isSuperAdmin) return true;
      if (!obra) return false;
      if (obra.created_by_id === user.id) return true;
      // Solo usar el empleado vinculado (admin-controlled), nunca user.full_name (user-controlled)
      if (!emp || emp.user_id !== user.id) return false;
      const empKey = nameKey(emp.full_name);
      const jefeKey = nameKey(obra.jefe_sitio);
      const inspKey = nameKey(obra.inspector);
      return (jefeKey && jefeKey === empKey)
          || (inspKey && inspKey === empKey);
    };

    // ── LIST ──
    if (action === 'list') {
      // Filtrar por sector del usuario — aisla datos entre sectores
      const userSector = user.data?.sector_id || user.sector_id || 'escuela';
      const all = await sb.entities.ObraCertificacion.filter({ sector_id: userSector });
      const obras = isSuperAdmin ? all : all.filter(canAccess);
      return Response.json({ obras });
    }

    // ── UPDATE ──
    if (action === 'update') {
      const { id, data } = body;
      if (!id || !data) return Response.json({ error: 'id y data requeridos' }, { status: 400 });

      const existing = await sb.entities.ObraCertificacion.filter({ id }).catch(() => []);
      const obra = existing[0];
      if (!obra) return Response.json({ error: 'Obra no encontrada' }, { status: 404 });

      if (obra.ciclo_archivado && !isSuperAdmin) {
        return Response.json({ error: 'Obra archivada: solo administradores pueden modificarla' }, { status: 403 });
      }
      if (!canAccess(obra)) {
        return Response.json({ error: 'No tenés permiso para editar esta obra' }, { status: 403 });
      }

      const updated = await sb.entities.ObraCertificacion.update(id, data);
      return Response.json({ obra: updated });
    }

    // ── CREATE (solo administradores) ──
    if (action === 'create') {
      if (!isSuperAdmin) {
        return Response.json({ error: 'Solo administradores pueden crear obras' }, { status: 403 });
      }
      const created = await sb.entities.ObraCertificacion.create(body.data);
      return Response.json({ obra: created });
    }

    // ── DELETE (solo administradores) ──
    if (action === 'delete') {
      if (!isSuperAdmin) {
        return Response.json({ error: 'Solo administradores pueden eliminar obras' }, { status: 403 });
      }
      const { id } = body;
      if (!id) return Response.json({ error: 'id requerido' }, { status: 400 });
      await sb.entities.ObraCertificacion.delete(id);
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});