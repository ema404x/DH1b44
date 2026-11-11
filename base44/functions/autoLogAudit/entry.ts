import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

/**
 * Llamada por los workflows "Audit - *" en cada create/update/delete de una
 * entidad auditada. Registra el evento en AuditLog.
 *
 * QUIÉN HIZO EL CAMBIO
 *   El workflow corre siempre como su creador, así que auth.me() NO es el autor
 *   del cambio (por eso antes todo quedaba a nombre de una sola persona).
 *   El autor se resuelve así:
 *     1. Marca AuditoriaActor dejada por el usuario al actuar (su created_by_id).
 *     2. Marca del portal sin login: nombre del operario (la deja el servidor).
 *     3. En creaciones hechas desde la app: created_by_id del registro.
 *     4. Si no hay ninguna: "sistema" (procesos automáticos).
 */

const VENTANA_MS = 15 * 60 * 1000;
const IGNORE_FIELDS = ['updated_date', 'created_date'];
// Módulos donde también quedan registrados los procesos automáticos ("sistema").
// En el resto solo se registra lo que hizo una persona, para no llenar la
// auditoría con sincronizaciones e importaciones.
const REGISTRA_SISTEMA = new Set([
  'WorkOrder', 'Certificado', 'SolicitudCertificado', 'Client',
  'Project', 'Employee', 'Emergencia', 'RolePermission',
]);
// Campos que los procesos automáticos estampan apenas se crea un registro.
const CAMPOS_TECNICOS = new Set(['sector_id', 'jefe_sitio_email']);

const lista = (r) => (Array.isArray(r) ? r : (r?.items || []));
const esUsuario = (id) => Boolean(id) && !String(id).startsWith('service_');
const objeto = (v) => {
  if (typeof v !== 'string') return v ?? null;
  try { return JSON.parse(v); } catch (_) { return null; }
};

// Toma la marca vigente más antigua del evento (los eventos llegan en orden)
// y la borra, junto con las vencidas.
async function tomarMarca(sb, event) {
  const marcas = lista(await sb.entities.AuditoriaActor.filter(
    { entity_type: event.entity_name, entity_id: event.entity_id, action: event.type },
    'created_date', 20,
  ));
  const limite = Date.now() - VENTANA_MS;
  let marca = null;
  for (const m of marcas) {
    const vigente = new Date(m.created_date).getTime() >= limite;
    if (vigente && marca) continue;
    if (vigente) marca = m;
    await sb.entities.AuditoriaActor.delete(m.id).catch(() => {});
  }
  return marca;
}

async function resolverActor(sb, userId) {
  const user = await sb.entities.User.get(userId).catch(() => null);
  if (!user?.email) return null;
  const emp = lista(await sb.entities.Employee.filter({ user_id: userId }).catch(() => []))[0];
  return {
    email: user.email,
    role: emp?.role || user.role || 'usuario',
    sector: emp?.sector_id || user.sector_id || user.data?.sector_id || null,
  };
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (caller.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const event = body.event || { type: body.event_type, entity_name: body.entity_name, entity_id: body.entity_id };
    let data = objeto(body.data);
    const old_data = objeto(body.old_data);

    if (!event.type || !event.entity_name || !event.entity_id) {
      return Response.json({ error: 'Payload inválido' }, { status: 400 });
    }

    const sb = base44.asServiceRole;

    // Registros muy grandes llegan sin datos: se vuelven a leer.
    if (event.type !== 'delete' && !data?.created_by_id) {
      const actual = await sb.entities[event.entity_name].get(event.entity_id).catch(() => null);
      data = data ? { ...data, created_by_id: actual?.created_by_id } : actual;
    }

    // Calcular campos modificados en updates
    let changed_fields = [];
    if (event.type === 'update') {
      if (data && old_data) {
        changed_fields = [...new Set([...Object.keys(data), ...Object.keys(old_data)])].filter(k =>
          !IGNORE_FIELDS.includes(k) && JSON.stringify(data[k]) !== JSON.stringify(old_data[k]));
        // Si no hay cambios reales, no registrar
        if (changed_fields.length === 0) return Response.json({ success: true, skipped: true });
      } else if (Array.isArray(body.changed_fields)) {
        changed_fields = body.changed_fields.filter(k => !IGNORE_FIELDS.includes(k));
      }
    }

    const creadorId = data?.created_by_id;
    const creadorReal = event.type === 'create' && esUsuario(creadorId);

    let marca = await tomarMarca(sb, event);
    // Creaciones hechas por una función del servidor: la marca se deja apenas
    // se conoce el id, y puede llegar un instante después que este evento.
    if (!marca && event.type === 'create' && !creadorReal) {
      await new Promise(r => setTimeout(r, 2500));
      marca = await tomarMarca(sb, event);
    }

    const actorId = esUsuario(marca?.created_by_id) ? marca.created_by_id : (creadorReal ? creadorId : null);
    let actor = actorId ? await resolverActor(sb, actorId) : null;
    // Operario del portal: el nombre solo vale si la marca la dejó el servidor.
    if (!actor && marca?.actor_nombre && !esUsuario(marca.created_by_id)) {
      actor = { email: `Operario: ${marca.actor_nombre}`, role: 'operario (portal)', sector: null };
    }

    // Estampado automático posterior a una creación: no es una acción de nadie.
    if (!marca && changed_fields.length > 0 && changed_fields.every(f => CAMPOS_TECNICOS.has(f))) {
      return Response.json({ success: true, skipped: true });
    }
    if (!actor && !REGISTRA_SISTEMA.has(event.entity_name)) {
      return Response.json({ success: true, skipped: true });
    }

    await sb.entities.AuditLog.create({
      entity_type: event.entity_name,
      entity_id: event.entity_id,
      action: event.type,
      user_email: actor?.email || 'sistema',
      user_role: actor?.role || 'sistema',
      // Sector de la ENTIDAD auditada (aislamiento entre sectores); si aún no
      // fue estampado, el del autor.
      sector_id: data?.sector_id || old_data?.sector_id || actor?.sector || null,
      timestamp: new Date().toISOString(),
      old_values: event.type === 'update' ? old_data : null,
      new_values: event.type === 'update' ? data : null,
      changed_fields,
      notes: null
    });

    return Response.json({ success: true, actor: actor?.email || 'sistema' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}