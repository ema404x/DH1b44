import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { sectorErrorResponse } from '../../shared/sectorGuard.ts';
import {
  identidadCaller, toArr, limpiarFotos, entradaHistorial, PRIORIDADES, TIPOS,
} from '../../shared/solicitudOT.ts';

// Revisión de propuestas de OT (SolicitudOT). Solo el jefe asignado
// (jefe_sitio_email = su email) o admin/gerente del sector.
//   listar   { estado? }           → propuestas visibles para el caller
//   contar   {}                    → cantidad por estado
//   editar   { id, cambios }       → campos permitidos + historial
//   aprobar  { id }                → crea la WorkOrder (misma forma que CrearOT)
//   rechazar { id, motivo }        → requiere motivo

const ESTADOS = ['enviada', 'aprobada', 'rechazada'];
const EDITABLES = ['titulo', 'descripcion', 'prioridad', 'tipo', 'fecha_sugerida', 'fotos'];

function validarCambios(sol, cambios) {
  const out = {};
  for (const k of EDITABLES) {
    if (!(k in (cambios || {}))) continue;
    let v = cambios[k];
    if (k === 'titulo') { v = String(v || '').trim().slice(0, 200); if (!v) throw Object.assign(new Error('El título es obligatorio'), { status: 400 }); }
    if (k === 'descripcion') v = String(v || '').slice(0, 5000);
    if (k === 'prioridad' && !PRIORIDADES.includes(v)) continue;
    if (k === 'tipo' && !TIPOS.includes(v)) continue;
    if (k === 'fecha_sugerida') v = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
    // Fotos: solo se pueden quitar (no agregar URLs nuevas desde acá).
    if (k === 'fotos') { const prev = sol.fotos || []; v = limpiarFotos(v).filter((u) => prev.includes(u)); }
    if (JSON.stringify(v ?? null) !== JSON.stringify(sol[k] ?? null)) out[k] = v;
  }
  return out;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action } = body;
    const { sb, esGestor, email } = await identidadCaller(base44, user);
    const alcance = esGestor ? {} : { jefe_sitio_email: email || '__sin_email__' };

    if (action === 'listar') {
      const q = { ...alcance };
      if (ESTADOS.includes(body.estado)) q.estado = body.estado;
      const solicitudes = toArr(await sb.entities.SolicitudOT.filter(q, '-created_date', 100));
      return Response.json({ solicitudes });
    }

    if (action === 'contar') {
      const [enviada, aprobada, rechazada] = await Promise.all(
        ESTADOS.map((estado) => sb.entities.SolicitudOT.count({ ...alcance, estado })),
      );
      return Response.json({ enviada, aprobada, rechazada });
    }

    if (!['editar', 'aprobar', 'rechazar'].includes(action)) {
      return Response.json({ error: 'Acción no válida' }, { status: 400 });
    }
    if (!body.id) return Response.json({ error: 'Falta la propuesta' }, { status: 400 });
    const sol = await sb.entities.SolicitudOT.get(String(body.id)).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!sol) return Response.json({ error: 'Propuesta no encontrada' }, { status: 404 });
    const esJefe = !!email && (sol.jefe_sitio_email || '').toLowerCase().trim() === email;
    if (!esGestor && !esJefe) return Response.json({ error: 'No tenés permiso sobre esta propuesta' }, { status: 403 });

    const historial = Array.isArray(sol.historial) ? sol.historial : [];
    const revisor = user.full_name || user.email || '';

    if (action === 'aprobar') {
      // Idempotente: si ya tiene OT, no se crea otra.
      if (sol.work_order_id) return Response.json({ solicitud: sol, work_order_id: sol.work_order_id, ya_aprobada: true });
      if (sol.estado !== 'enviada') return Response.json({ error: 'La propuesta ya fue revisada' }, { status: 409 });

      // Mismo payload que CrearOT.jsx (responsable por defecto = jefe a cargo).
      const responsable = sol.jefe_sitio || '';
      const jefeEmail = (sol.jefe_sitio_email || '').toLowerCase().trim();
      let jefeUserId = '';
      if (jefeEmail) {
        const emp = toArr(await sb.entities.Employee.filter({ email: jefeEmail }, '-created_date', 5)).find((e) => e.user_id);
        jefeUserId = emp?.user_id || '';
      }
      // Se crea con la sesión del revisor (igual que CrearOT): mismas reglas y
      // mismas automatizaciones al crear (sector, jefe, auditoría).
      const ot = await base44.entities.WorkOrder.create({
        title: sol.titulo,
        type: sol.tipo || 'mantenimiento_correctivo',
        priority: sol.prioridad || 'media',
        description: sol.descripcion || '',
        status: responsable ? 'asignada' : 'pendiente',
        scheduled_date: sol.fecha_sugerida || undefined,
        materials_used: [],
        require_photos: false,
        photos: sol.fotos || [],
        asset_id: sol.asset_id || undefined,
        asset_name: sol.asset_name || '',
        location: sol.location || '',
        project_name: sol.project_name || '',
        assigned_name: responsable || undefined,
        assigned_to: jefeUserId || undefined,
        jefe_sitio: sol.jefe_sitio || undefined,
        jefe_sitio_email: jefeEmail || undefined,
      });
      const solicitud = await sb.entities.SolicitudOT.update(sol.id, {
        estado: 'aprobada',
        work_order_id: ot.id,
        revisado_por: revisor,
        fecha_revision: new Date().toISOString(),
        historial: [...historial, entradaHistorial(user, 'aprobada', { work_order_id: ot.id })],
      });
      return Response.json({ solicitud, work_order_id: ot.id });
    }

    if (sol.estado !== 'enviada') return Response.json({ error: 'La propuesta ya fue revisada' }, { status: 409 });

    if (action === 'rechazar') {
      const motivo = String(body.motivo || '').trim().slice(0, 1000);
      if (!motivo) return Response.json({ error: 'Indicá el motivo del rechazo' }, { status: 400 });
      const solicitud = await sb.entities.SolicitudOT.update(sol.id, {
        estado: 'rechazada',
        motivo_rechazo: motivo,
        revisado_por: revisor,
        fecha_revision: new Date().toISOString(),
        historial: [...historial, entradaHistorial(user, 'rechazada', { motivo })],
      });
      return Response.json({ solicitud });
    }

    // editar
    let cambios;
    try { cambios = validarCambios(sol, body.cambios); } catch (e) {
      return Response.json({ error: e.message }, { status: e.status || 400 });
    }
    if (!Object.keys(cambios).length) return Response.json({ solicitud: sol, sin_cambios: true });
    const detalle = Object.fromEntries(Object.keys(cambios).map((k) => [k, { antes: sol[k] ?? null, despues: cambios[k] }]));
    const solicitud = await sb.entities.SolicitudOT.update(sol.id, {
      ...cambios,
      historial: [...historial, entradaHistorial(user, 'editada', detalle)],
    });
    return Response.json({ solicitud });
  } catch (error) {
    return sectorErrorResponse(error);
  }
}