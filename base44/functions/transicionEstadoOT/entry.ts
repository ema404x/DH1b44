import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Transiciones fijas: desde un estado exacto hacia otro
const TRANSICIONES_FIJAS = {
  'asignar':        { desde: 'pendiente',            hacia: 'asignada' },
  'iniciar':        { desde: 'asignada',             hacia: 'en_progreso' },
  'finalizar':      { desde: 'en_progreso',          hacia: 'pendiente_validacion' },
  'aprobar':        { desde: 'pendiente_validacion', hacia: 'completada' },
  'rechazar':       { desde: 'pendiente_validacion', hacia: 'en_progreso' },
};

// Transiciones flexibles: desde cualquier estado no-terminal
const TRANSICIONES_FLEXIBLES = {
  'cancelar':       { hacia: 'cancelada' },
  'convertir_obra': { hacia: 'obra' },
};

const ESTADOS_TERMINALES = ['completada', 'cancelada', 'obra'];

const MENSAJES = {
  'asignar': 'OT asignada correctamente',
  'iniciar': 'OT iniciada correctamente',
  'finalizar': 'OT enviada a validación',
  'aprobar': 'OT aprobada y completada',
  'rechazar': 'OT rechazada y devuelta al operario',
  'cancelar': 'OT cancelada',
  'convertir_obra': 'OT convertida a Futura Obra',
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json();
    const { ot_id, accion, extra_data = {} } = body;

    if (!ot_id || !accion) {
      return Response.json({ error: 'Faltan parámetros: ot_id y accion son obligatorios' }, { status: 400 });
    }

    const fija = TRANSICIONES_FIJAS[accion];
    const flexible = TRANSICIONES_FLEXIBLES[accion];

    if (!fija && !flexible) {
      const todas = [...Object.keys(TRANSICIONES_FIJAS), ...Object.keys(TRANSICIONES_FLEXIBLES)];
      return Response.json({ error: `Acción "${accion}" no válida. Acciones permitidas: ${todas.join(', ')}` }, { status: 400 });
    }

    const ot = await base44.entities.WorkOrder.get(ot_id);
    if (!ot) {
      return Response.json({ error: 'Orden de trabajo no encontrada' }, { status: 404 });
    }

    // Validar estado actual
    if (fija) {
      if (ot.status !== fija.desde) {
        return Response.json({
          error: `No se puede "${accion}" porque la OT está en estado "${ot.status}". Debe estar en "${fija.desde}".`
        }, { status: 409 });
      }
    } else if (flexible) {
      if (ESTADOS_TERMINALES.includes(ot.status)) {
        return Response.json({
          error: `No se puede "${accion}" porque la OT está en estado terminal "${ot.status}".`
        }, { status: 409 });
      }
    }

    const nuevoEstado = fija ? fija.hacia : flexible.hacia;

    // Permisos: aprobar/rechazar solo jefe
    const esJefe = user.role === 'admin' || (extra_data.rol === 'jefe_sitio');
    if ((accion === 'aprobar' || accion === 'rechazar') && !esJefe) {
      return Response.json({ error: 'Solo el Jefe de Sitio puede aprobar o rechazar OTs' }, { status: 403 });
    }

    // Validar asignado para "asignar"
    if (accion === 'asignar' && !ot.assigned_name && !extra_data.assigned_name) {
      return Response.json({ error: 'Debe asignar un operario antes de cambiar el estado a "Asignada"' }, { status: 400 });
    }

    const updateData = { status: nuevoEstado };

    if (accion === 'asignar' && extra_data.assigned_name) {
      updateData.assigned_name = extra_data.assigned_name;
    }

    if (accion === 'iniciar') {
      if (extra_data.gps) {
        updateData.gps_latitude = extra_data.gps.latitude;
        updateData.gps_longitude = extra_data.gps.longitude;
        updateData.gps_accuracy = extra_data.gps.accuracy;
        updateData.gps_timestamp = new Date().toISOString();
        updateData.gps_status = 'capturado';
      } else {
        updateData.gps_status = extra_data.gps_status || 'denegado';
      }
      updateData.fecha_inicio_real = new Date().toISOString();
    }

    if (accion === 'finalizar') {
      if (extra_data.materials_used !== undefined) updateData.materials_used = extra_data.materials_used;
      if (extra_data.materiales_faltantes !== undefined) {
        updateData.materiales_faltantes = [...(ot.materiales_faltantes || []), ...extra_data.materiales_faltantes];
      }
      if (extra_data.notes) updateData.notes = extra_data.notes;
      if (extra_data.photos) updateData.photos = [...(ot.photos || []), ...extra_data.photos];

      if (extra_data.materiales_faltantes && extra_data.materiales_faltantes.length > 0) {
        const sinMotivo = extra_data.materiales_faltantes.filter(m => !m.motivo || !m.motivo.trim());
        if (sinMotivo.length > 0) {
          return Response.json({ error: 'Todos los materiales faltantes deben tener un motivo' }, { status: 400 });
        }
      }
    }

    if (accion === 'aprobar') {
      updateData.completed_date = new Date().toISOString().split('T')[0];
      updateData.fecha_validacion = new Date().toISOString();
      updateData.validado_por = user.full_name || user.email || 'Jefe de Sitio';
    }

    if (accion === 'rechazar') {
      if (!extra_data.rechazo_comentario || !extra_data.rechazo_comentario.trim()) {
        return Response.json({ error: 'Debe indicar un motivo de rechazo' }, { status: 400 });
      }
      updateData.rechazo_comentario = extra_data.rechazo_comentario.trim();
    }

    const actualizada = await base44.entities.WorkOrder.update(ot_id, updateData);

    return Response.json({
      success: true,
      ot: actualizada,
      mensaje: MENSAJES[accion] || 'OT actualizada correctamente'
    });

  } catch (error) {
    return Response.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
});