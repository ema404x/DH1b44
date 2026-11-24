import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { tienePermisoModulo } from '../../shared/modulePermission.ts';

// Crea una OT real verificando WorkOrder.create en Control de Acceso.
// Se crea con la sesión del usuario (mismo autor, mismas reglas de acceso y los
// mismos flujos automáticos que antes). Idempotente por client_op_id.
// La OT que nace al aprobar una propuesta NO pasa por acá (resolverSolicitudOT).
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const data = body?.data;
    if (!data || typeof data !== 'object' || !String(data.title || '').trim()) {
      return Response.json({ error: 'El título es obligatorio' }, { status: 400 });
    }

    if (!(await tienePermisoModulo(base44, user, 'WorkOrder', 'create'))) {
      return Response.json({ error: 'No tenés permiso para crear OT' }, { status: 403 });
    }

    if (data.client_op_id) {
      const prev = await base44.entities.WorkOrder.filter({ client_op_id: String(data.client_op_id) });
      const existing = (Array.isArray(prev) ? prev : prev?.items || [])[0];
      if (existing) return Response.json({ ot: existing, duplicada: true });
    }

    const ot = await base44.entities.WorkOrder.create(data);
    return Response.json({ ot });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}