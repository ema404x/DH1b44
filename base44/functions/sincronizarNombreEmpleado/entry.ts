import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * sincronizarNombreEmpleado
 *
 * Cuando se modifica el `full_name` de un Employee, esta función propaga
 * el cambio a TODAS las entidades que tienen el nombre denormalizado.
 *
 * Entidades y campos afectados:
 *   - WorkOrder:      assigned_name, jefe_sitio, validado_por
 *   - Pendiente:      jefe_sitio
 *   - LocationData:   jefe_sitio, inspector
 *   - Direccion:      jefe_sitio, inspector
 *   - MovimientoPanol: responsable
 *
 * También sincroniza el full_name del User de plataforma vinculado (por email),
 * para que las referencias por created_by_id muestren el nombre correcto.
 *
 * Se dispara vía automation on Employee update (cuando full_name cambia).
 */
const ENTITY_NAME_FIELDS = {
  WorkOrder: ['assigned_name', 'jefe_sitio', 'validado_por'],
  Pendiente: ['jefe_sitio'],
  LocationData: ['jefe_sitio', 'inspector'],
  Direccion: ['jefe_sitio', 'inspector'],
  MovimientoPanol: ['responsable'],
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const sb = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const event = body.event || {};
    const data = body.data || {};
    const oldData = body.old_data || {};

    if (event.entity_name !== 'Employee') {
      return Response.json({ error: 'Only Employee entity supported' }, { status: 400 });
    }

    const oldName = (oldData.full_name || '').trim();
    const newName = (data.full_name || '').trim();

    // Solo proceder si el nombre realmente cambió
    if (!oldName || !newName || oldName === newName) {
      return Response.json({ success: true, skipped: true, reason: 'name unchanged or missing' });
    }

    const results = {};
    let totalUpdated = 0;

    // Cascade update en todas las entidades con nombres denormalizados
    for (const [entityName, fields] of Object.entries(ENTITY_NAME_FIELDS)) {
      const entityApi = sb.entities[entityName];
      if (!entityApi || typeof entityApi.updateMany !== 'function') continue;

      results[entityName] = {};

      for (const field of fields) {
        try {
          // updateMany cambia el campo de oldName → newName en todos los registros que coincidan
          // Como el $set cambia el campo del query, los registros actualizados no se re-matchean.
          let hasMore = true;
          let fieldUpdated = 0;
          let iterations = 0;

          while (hasMore && iterations < 10) {
            const result = await entityApi.updateMany(
              { [field]: oldName },
              { $set: { [field]: newName } }
            );
            fieldUpdated += result?.modified_count || result?.count || 0;
            hasMore = result?.has_more || false;
            iterations++;
          }

          results[entityName][field] = { updated: fieldUpdated };
          totalUpdated += fieldUpdated;
        } catch (err) {
          results[entityName][field] = { error: err.message };
        }
      }
    }

    // Sincronizar el full_name del User de plataforma vinculado (por email)
    if (data.email) {
      try {
        const users = await sb.entities.User.filter(
          { email: data.email.toLowerCase().trim() },
          '-created_date',
          10
        );
        for (const user of users) {
          if (user.full_name !== newName) {
            try {
              await sb.entities.User.update(user.id, { full_name: newName });
              results._userSync = { synced: true, userId: user.id };
            } catch (e) {
              // No fallar si no se puede actualizar el User — la resolución
              // frontend ya prioriza Employee.full_name sobre User.full_name.
              results._userSync = { error: e.message };
            }
          }
        }
      } catch (err) {
        results._userSync = { error: err.message };
      }
    }

    return Response.json({
      success: true,
      oldName,
      newName,
      totalUpdated,
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});