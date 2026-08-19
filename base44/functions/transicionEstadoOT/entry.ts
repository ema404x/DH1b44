import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { canManageOT } from "../../shared/roles.ts";

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
  'completar':      { hacia: 'completada' },
};

const ESTADOS_TERMINALES = ['completada', 'cancelada'];

const MENSAJES = {
  'asignar': 'OT asignada correctamente',
  'iniciar': 'OT iniciada correctamente',
  'finalizar': 'OT enviada a validación',
  'aprobar': 'OT aprobada y completada',
  'rechazar': 'OT rechazada y devuelta al operario',
  'cancelar': 'OT cancelada',
  'convertir_obra': 'OT convertida a Futura Obra',
  'completar': 'OT completada directamente por el Jefe de Sitio',
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

    // Lectura con asServiceRole: la RLS de WorkOrder no tiene rama para el operario
    // (solo creador / jefe_sitio_email / admin+sector / gerente+sector), así que un
    // operario que escanea una OT libre recibe null → 404 → "no pasa nada".
    // Los permisos de la transición ya los controla la función explícitamente (login
    // obligatorio + canManageOT), así que la lectura no debe chocar con la RLS.
    const ot = await base44.asServiceRole.entities.WorkOrder.get(ot_id);
    if (!ot) {
      return Response.json({ error: 'Orden de trabajo no encontrada' }, { status: 404 });
    }

    // Aislamiento por sector: la OT debe ser del mismo sector del que la opera
    // (salvo admin/gerente de plataforma). Evita que el bypass de RLS abra una fuga
    // cross-sector. Si la OT o el usuario no tienen sector cargado, no se bloquea
    // (deuda pendiente de migración de registros viejos sin sector).
    const callerSector = user?.data?.sector_id || user?.sector_id;
    const callerEsAdmin = ['admin', 'gerente'].includes(user.role || '');
    // Fail-closed: si la OT no tiene sector o no coincide con el del caller, bloquear.
    // Antes, si ot.sector_id era null el chequeo se salteaba (fail-open) → OT sin sector
    // mutable por cualquier operario logueado.
    if (!callerEsAdmin && ot.sector_id !== callerSector) {
      return Response.json({ error: 'Esta OT pertenece a otro sector' }, { status: 403 });
    }

    // Validar estado actual
    if (fija) {
      // 'iniciar' acepta tanto 'pendiente' como 'asignada' — permite arrancar la OT directo
      const estadosValidos = accion === 'iniciar' ? ['pendiente', 'asignada'] : [fija.desde];
      if (!estadosValidos.includes(ot.status)) {
        const msgEstados = estadosValidos.length > 1
          ? estadosValidos.map(s => `"${s}"`).join(' o ')
          : `"${fija.desde}"`;
        return Response.json({
          error: `No se puede "${accion}" porque la OT está en estado "${ot.status}". Debe estar en ${msgEstados}.`
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

    // Permisos: aprobar/rechazar solo jefe de sitio, admin o gerente.
    // El rol 'jefe_sitio' vive en la entidad Employee (el rol de plataforma es 'user'),
    // así que hay que buscar la ficha del empleado por user_id.
    const userRole = user.role || '';
    const esAdminPlataforma = ['admin', 'gerente'].includes(userRole);
    let esJefe = esAdminPlataforma;
    if (!esJefe) {
      try {
        const empleados = await base44.asServiceRole.entities.Employee
          .filter({ user_id: user.id }).catch(() => []);
        const emp = empleados && empleados.length > 0 ? empleados[0] : null;
        // Robusto: verifica admin-level y jefe de sitio vía helper centralizado
        esJefe = canManageOT(emp?.role);
      } catch {
        esJefe = false;
      }
    }
    if ((accion === 'aprobar' || accion === 'rechazar' || accion === 'completar') && !esJefe) {
      return Response.json({ error: 'Solo el Jefe de Sitio, Admin o Gerente puede completar o rechazar OTs' }, { status: 403 });
    }

    // Validar asignado para "asignar"
    if (accion === 'asignar' && !ot.assigned_name && !extra_data.assigned_name) {
      return Response.json({ error: 'Debe asignar un operario antes de cambiar el estado a "Asignada"' }, { status: 400 });
    }

    // Validar checklist y fotos obligatorias antes de cerrar la OT (completar/aprobar).
    // Centralizado en el backend: cubre TODOS los caminos (tarjeta, kanban, dropdown, panel)
    // y evita cerrar OTs con tareas pendientes. Si la OT se cierra incompleta a propósito,
    // debe registrar motivos_incompleto (escape hatch del flujo "incompleto").
    if (accion === 'completar' || accion === 'aprobar') {
      const motivosIncompleto = (ot.motivos_incompleto || []).filter(m => m.texto && m.texto.trim());
      if (motivosIncompleto.length === 0) {
        const checklist = ot.checklist || [];
        const pendientes = checklist.filter(t => !t.completed);
        if (pendientes.length > 0) {
          return Response.json({
            error: `No se puede completar: faltan ${pendientes.length} tarea(s) del checklist. Si la OT queda incompleta, registrá el motivo en "Motivos Incompleto".`
          }, { status: 400 });
        }
        if (ot.require_photos && (ot.photos || []).length === 0) {
          return Response.json({
            error: 'No se puede completar: la OT requiere al menos una foto'
          }, { status: 400 });
        }
      }
    }

    const updateData = { status: nuevoEstado };

    if (accion === 'asignar' && extra_data.assigned_name) {
      updateData.assigned_name = extra_data.assigned_name;
    }

    if (accion === 'iniciar') {
      // Cualquier operario que escanea la OT puede iniciarla, sin importar a quién
      // esté asignada — la asignación del jefe es una sugerencia, no un lock. Al
      // iniciar, el operario que escanea pasa a ser el trabajador (assigned_to +
      // assigned_name) en el bloque de abajo. Los admins/gerentes respetan
      // extra_data.assigned_to (inician desde el kanban sin reclamarla).

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

      // El que inicia la OT pasa a ser el operario que la trabaja.
      // - Operario (no admin): assigned_to = user.id (usuario del backend, siempre
      //   disponible) y assigned_name = displayName del que escanea (sobreescribe la
      //   asignación previa del jefe). Sin esto, assigned_name quedaría con el
      //   operario original y assigned_to con el que escaneó → mismatch visible.
      // - Admin/gerente: respeta extra_data.assigned_to y solo completa
      //   assigned_name si estaba vacío (no pisa la asignación del jefe).
      if (!callerEsAdmin) {
        if (ot.assigned_to !== user.id) {
          updateData.assigned_to = user.id;
        }
        if (extra_data.assigned_name && ot.assigned_name !== extra_data.assigned_name) {
          updateData.assigned_name = extra_data.assigned_name;
        }
      } else {
        if (extra_data.assigned_to && ot.assigned_to !== extra_data.assigned_to) {
          updateData.assigned_to = extra_data.assigned_to;
        }
        if (extra_data.assigned_name && !ot.assigned_name) {
          updateData.assigned_name = extra_data.assigned_name;
        }
      }
    }

    if (accion === 'finalizar') {
      // El reporte de cierre reemplaza el estado anterior (no acumula). Si la OT
      // fue rechazada y el operario re-finaliza, los faltantes y fotos del reporte
      // anterior se descartan y queda exactamente lo que envía el operario ahora —
      // coincide con ReporteForm, que inicializa photos desde ot.photos y faltantes
      // desde [] y envía la lista completa que el operario ve en pantalla.
      if (extra_data.materials_used !== undefined) updateData.materials_used = extra_data.materials_used;
      if (extra_data.materiales_faltantes !== undefined) {
        updateData.materiales_faltantes = extra_data.materiales_faltantes;
      }
      if (extra_data.notes !== undefined) updateData.notes = extra_data.notes;
      if (extra_data.photos !== undefined) updateData.photos = extra_data.photos;

      if (extra_data.materiales_faltantes && extra_data.materiales_faltantes.length > 0) {
        const sinMotivo = extra_data.materiales_faltantes.filter(m => !m.motivo || !m.motivo.trim());
        if (sinMotivo.length > 0) {
          return Response.json({ error: 'Todos los materiales faltantes deben tener un motivo' }, { status: 400 });
        }
      }
    }

    if (accion === 'aprobar' || accion === 'completar') {
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

    // Escritura con asServiceRole por el mismo motivo que la lectura: el update
    // autenticado lo bloquea la RLS para el operario. El sector ya se validó arriba.
    const actualizada = await base44.asServiceRole.entities.WorkOrder.update(ot_id, updateData);

    return Response.json({
      success: true,
      ot: actualizada,
      mensaje: MENSAJES[accion] || 'OT actualizada correctamente'
    });

  } catch (error) {
    return Response.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
});