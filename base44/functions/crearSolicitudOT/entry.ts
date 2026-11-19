import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { waitUntil } from 'base44:runtime';
import { sectorErrorResponse } from '../../shared/sectorGuard.ts';
import { isJefeSitioRole } from '../../shared/roles.ts';
import { enviarPushAUsuario } from '../../shared/webPushUsuario.ts';
import {
  identidadCaller, toArr, norm, limpiarFotos, entradaHistorial, PRIORIDADES, TIPOS,
} from '../../shared/solicitudOT.ts';

// Crea una propuesta de OT (SolicitudOT) del operario con sesión.
// La identidad (solicitante, sector) sale de auth.me() + su ficha Employee, nunca
// del payload. El jefe a cargo se resuelve en el servidor:
//   1) Employee.assigned_jefe_sitio del operario,
//   2) el jefe de la ubicación QR o del activo elegido (como CrearOT).
// Si no se resuelve, se guarda sin jefe (la ven admin/gerente del sector).
// Idempotente por client_op_id. No toca WorkOrder.

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const titulo = String(body.titulo || '').trim().slice(0, 200);
    if (!titulo) return Response.json({ error: 'El título es obligatorio' }, { status: 400 });

    const { sector, employee, sb } = await identidadCaller(base44, user);
    if (employee && employee.status === 'inactivo') {
      return Response.json({ error: 'Tu ficha de empleado está inactiva' }, { status: 403 });
    }

    const clientOpId = typeof body.client_op_id === 'string' ? body.client_op_id.slice(0, 100) : '';
    if (clientOpId) {
      const existing = toArr(await sb.entities.SolicitudOT.filter({ client_op_id: clientOpId }))[0];
      if (existing) return Response.json({ solicitud: existing, duplicada: true });
    }

    // Ubicación / activo elegido (validado dentro del sector).
    let asset = null;
    let locQR = null;
    if (body.asset_id) {
      asset = await sb.entities.Asset.get(String(body.asset_id)).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
      if (!asset) return Response.json({ error: 'Activo no encontrado' }, { status: 404 });
    }
    if (body.location_qr_id) {
      locQR = await sb.entities.LocationQR.get(String(body.location_qr_id)).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
      if (!locQR) return Response.json({ error: 'Ubicación no encontrada' }, { status: 404 });
    }

    // Jefe a cargo.
    const empleados = toArr(await sb.entities.Employee.filter({}, 'full_name', 500));
    const porNombre = (nombre) => {
      const t = norm(nombre);
      if (!t) return null;
      const matches = empleados.filter((e) => norm(e.full_name) === t && e.status !== 'inactivo');
      const e = matches.find((m) => isJefeSitioRole(m.role) && m.email) || matches.find((m) => m.email) || matches[0];
      return e ? { nombre: e.full_name, email: (e.email || '').toLowerCase().trim(), user_id: e.user_id || '' } : { nombre, email: '', user_id: '' };
    };
    const candidatos = [];
    if (employee?.assigned_jefe_sitio) candidatos.push(porNombre(employee.assigned_jefe_sitio));
    if (locQR?.jefe_sitio || locQR?.jefe_sitio_email) {
      const email = (locQR.jefe_sitio_email || '').toLowerCase().trim();
      const emp = email ? empleados.find((e) => (e.email || '').toLowerCase().trim() === email) : null;
      candidatos.push(email
        ? { nombre: locQR.jefe_sitio || emp?.full_name || '', email, user_id: emp?.user_id || '' }
        : porNombre(locQR.jefe_sitio));
    }
    if (asset?.jefe_sitio) candidatos.push(porNombre(asset.jefe_sitio));
    const jefe = candidatos.find((c) => c?.email) || candidatos.find((c) => c?.nombre) || null;

    const fecha = typeof body.fecha_sugerida === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.fecha_sugerida) ? body.fecha_sugerida : undefined;
    const data = {
      titulo,
      descripcion: String(body.descripcion || '').slice(0, 5000),
      prioridad: PRIORIDADES.includes(body.prioridad) ? body.prioridad : 'media',
      tipo: TIPOS.includes(body.tipo) ? body.tipo : 'mantenimiento_correctivo',
      asset_id: asset?.id || undefined,
      asset_name: asset?.name || locQR?.name || '',
      location: asset
        ? ([asset.sede, asset.area].filter(Boolean).join(' · ') || asset.name || '')
        : (locQR ? (locQR.address || locQR.name || '') : String(body.location || '').slice(0, 300)),
      location_qr_id: locQR?.id || undefined,
      project_name: asset?.project_name || locQR?.project_name || '',
      fotos: limpiarFotos(body.fotos),
      fecha_sugerida: fecha,
      solicitante_user_id: user.id,
      solicitante_employee_id: employee?.id || undefined,
      solicitante_nombre: employee?.full_name || user.full_name || '',
      solicitante_email: (user.email || '').toLowerCase().trim(),
      jefe_sitio: jefe?.nombre || undefined,
      jefe_sitio_email: jefe?.email || undefined,
      estado: 'enviada',
      client_op_id: clientOpId || undefined,
      historial: [entradaHistorial(user, 'creada')],
    };
    const solicitud = await sb.entities.SolicitudOT.create(data);

    // Aviso push al jefe (si tiene dispositivos activos). No bloquea la respuesta.
    if (jefe?.email) {
      waitUntil(enviarPushAUsuario(base44.asServiceRole, { userId: jefe.user_id, email: jefe.email }, {
        title: 'Nueva propuesta de OT',
        body: `${data.solicitante_nombre || 'Un operario'}: ${titulo}`,
        url: '/propuestas-ot',
      }).catch((e) => console.warn('[crearSolicitudOT] push', e?.message)));
    }

    return Response.json({ solicitud, sector });
  } catch (error) {
    return sectorErrorResponse(error);
  }
}