import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Guarda la configuración completa de control de acceso.
 * Recibe un array de roles con sus permisos y hace upsert de cada uno.
 * 
 * Body: { roles: [{ id?, role_name, description, permissions, is_active }] }
 * - Si tiene `id` → actualiza el registro existente.
 * - Si no tiene `id` → crea uno nuevo.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: se requieren permisos de administrador' }, { status: 403 });
    }

    const { roles } = await req.json();

    if (!Array.isArray(roles) || roles.length === 0) {
      return Response.json({ error: 'Se requiere un array de roles' }, { status: 400 });
    }

    const results = [];

    for (const role of roles) {
      const { id, role_name, description, permissions, is_active } = role;

      if (!role_name || !permissions) {
        results.push({ error: 'role_name y permissions son requeridos', role });
        continue;
      }

      const payload = {
        role_name,
        description: description || '',
        permissions,
        is_active: is_active !== undefined ? is_active : true,
      };

      if (id) {
        // Actualizar existente
        const updated = await base44.asServiceRole.entities.RolePermission.update(id, payload);
        results.push({ action: 'updated', id, role_name });
      } else {
        // Crear nuevo
        const created = await base44.asServiceRole.entities.RolePermission.create(payload);
        results.push({ action: 'created', id: created.id, role_name });
      }
    }

    return Response.json({
      success: true,
      message: `Configuración guardada: ${results.length} rol(es) procesados`,
      results,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});