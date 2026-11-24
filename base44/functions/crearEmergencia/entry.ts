import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { tienePermisoModulo } from '../../shared/modulePermission.ts';

// Registra una emergencia y su OT verificando Emergencias.create.
// Guarda exactamente los mismos datos que antes guardaba el formulario, con la
// sesión del usuario (mismo autor, sector y avisos automáticos). La OT de la
// emergencia es parte del alta: no exige WorkOrder.create.
const CAMPOS = ['titulo', 'tipo', 'descripcion', 'establecimiento', 'direccion', 'comuna',
  'reportado_por', 'telefono_contacto', 'jefe_sitio_asignado', 'fotos'];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const raw = body?.form || {};
    const form: any = {};
    for (const k of CAMPOS) if (raw[k] !== undefined) form[k] = raw[k];
    form.fotos = Array.isArray(form.fotos) ? form.fotos.filter((u) => typeof u === 'string') : [];
    if (!form.titulo || !form.tipo || !form.establecimiento) {
      return Response.json({ error: 'Completá los campos obligatorios' }, { status: 400 });
    }

    if (!(await tienePermisoModulo(base44, user, 'Emergencias', 'create'))) {
      return Response.json({ error: 'No tenés permiso para registrar emergencias' }, { status: 403 });
    }

    const codigo = `EMG-${Date.now().toString().slice(-6)}`;
    const emergencia = await base44.entities.Emergencia.create({ ...form, codigo, estado: 'activa' });
    let ot;
    try {
      ot = await base44.entities.WorkOrder.create({
        title: `[EMERGENCIA] ${form.titulo}`,
        type: 'emergencia', status: 'pendiente', priority: 'urgente',
        description: form.descripcion,
        location: [form.establecimiento, form.direccion].filter(Boolean).join(' - '),
        assigned_name: form.jefe_sitio_asignado,
        gps_status: 'no_disponible',
        photos: form.fotos,
        notes: `Emergencia: ${codigo}`,
      });
    } catch (err) {
      // Sin OT no queda la emergencia huérfana (mismo comportamiento que antes).
      await base44.entities.Emergencia.delete(emergencia.id).catch(() => {});
      throw err;
    }
    try {
      await base44.entities.Emergencia.update(emergencia.id, { work_order_id: ot.id });
    } catch (err) {
      console.warn('[crearEmergencia] no se pudo vincular la OT', err?.message);
    }
    return Response.json({ emergencia, ot });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}