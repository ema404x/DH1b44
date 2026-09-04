import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { isAdminLevelRole } from "../../shared/roles.ts";
import { resolveOtPermissions } from "../../shared/otPermissions.ts";
import { verificarClaveOperario } from "../../shared/operarioAuth.ts";

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
  'completar': 'OT completada correctamente',
};

// Normaliza strings para comparación de nombres (operario_sesion, assigned_name)
const normName = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { ot_id, accion, extra_data = {}, auth_mode = 'session', operario_password, operario_sesion } = body;

    const isPortal = auth_mode === 'portal';
    let user = null;

    // ── Autenticación según modo ──
    // session: auth.me() (módulo autenticado, kanban, etc.)
    // portal:  clave de operario compartida (verificarClaveOperario). Sin sesión.
    if (isPortal) {
      const { valid, configured } = await verificarClaveOperario(base44, operario_password);
      if (!configured) return Response.json({ error: 'Servicio no configurado' }, { status: 503 });
      if (!valid) return Response.json({ error: 'Clave de operario requerida' }, { status: 401 });
    } else {
      user = await base44.auth.me();
      if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (!ot_id || !accion) {
      return Response.json({ error: 'Faltan parámetros: ot_id y accion son obligatorios' }, { status: 400 });
    }

    // El portal solo puede iniciar o finalizar — nunca aprobar/rechazar/cancelar.
    if (isPortal && !['iniciar', 'finalizar'].includes(accion)) {
      return Response.json({ error: 'El portal público solo puede iniciar o finalizar OTs' }, { status: 403 });
    }

    const fija = TRANSICIONES_FIJAS[accion];
    const flexible = TRANSICIONES_FLEXIBLES[accion];

    if (!fija && !flexible) {
      const todas = [...Object.keys(TRANSICIONES_FIJAS), ...Object.keys(TRANSICIONES_FLEXIBLES)];
      return Response.json({ error: `Acción "${accion}" no válida. Acciones permitidas: ${todas.join(', ')}` }, { status: 400 });
    }

    // Lectura con asServiceRole: la RLS de WorkOrder no tiene rama para el operario
    // (solo creador / jefe_sitio_email / admin+sector / gerente+sector), así que un
    // operario que escanea una OT libre recibe null → 404. Los permisos de la
    // transición ya los controla la función explícitamente.
    const ot = await base44.asServiceRole.entities.WorkOrder.get(ot_id);
    if (!ot) {
      return Response.json({ error: 'Orden de trabajo no encontrada' }, { status: 404 });
    }

    // ── Resolución de sector, permisos y flags según modo ──
    let callerSector, callerEsAdmin, canApprove;

    if (isPortal) {
      // Modo portal: el sector se resuelve desde la OT misma (ya estampada en
      // creación). El operario del portal nunca es admin ni puede aprobar.
      // Fail-closed: si la OT no tiene sector_id (legacy), rechazar.
      if (!ot.sector_id) {
        return Response.json({ error: 'La OT no tiene sector asignado (legacy). No se puede operar desde el portal.' }, { status: 403 });
      }
      callerSector = ot.sector_id;
      callerEsAdmin = false;
      canApprove = false;
    } else {
      const P = await resolveOtPermissions(base44, user);
      const employee = P.employee;

      // Reconciliación best-effort: si la ficha tiene sector y difiere del
      // usuario de plataforma, alinear data.sector_id. Idempotente.
      try {
        if (employee?.sector_id) {
          const platformSector = user.data?.sector_id || user.sector_id;
          if (platformSector && platformSector !== employee.sector_id) {
            await base44.asServiceRole.entities.User.update(user.id, {
              sector_id: employee.sector_id,
              data: { ...user.data, sector_id: employee.sector_id },
            });
          }
        }
      } catch (_) {}

      if (!P.superAdmin && ot.sector_id !== P.callerSector) {
        return Response.json({ error: 'Esta OT pertenece a otro sector. Cambiá de sector activo para operarla.' }, { status: 403 });
      }
      callerSector = P.callerSector;
      callerEsAdmin = P.superAdmin || isAdminLevelRole(employee?.role);
      canApprove = P.canApprove;
    }

    // Validar estado actual
    if (fija) {
      const estadosValidos = accion === 'iniciar'
        ? ['pendiente', 'asignada']
        : (Array.isArray(fija.desde) ? fija.desde : [fija.desde]);
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

    // Permisos de cierre (aprobar/rechazar/completar)
    if ((accion === 'aprobar' || accion === 'rechazar' || accion === 'completar') && !canApprove) {
      return Response.json({ error: 'Solo el Jefe de Sitio, Admin o Gerente puede completar o rechazar OTs' }, { status: 403 });
    }

    // Validar asignado para "asignar"
    if (accion === 'asignar' && !ot.assigned_name && !extra_data.assigned_name) {
      return Response.json({ error: 'Debe asignar un operario antes de cambiar el estado a "Asignada"' }, { status: 400 });
    }

    // ── Control de propiedad (portal) ──
    // Al finalizar una OT en_progreso, el operario_sesion del request debe
    // coincidir con el estampado al iniciar. Replica el isOwnerOf del módulo
    // adaptado al modelo sin login.
    if (isPortal && accion === 'finalizar' && ot.status === 'en_progreso') {
      if (ot.operario_sesion && operario_sesion && normName(ot.operario_sesion) !== normName(operario_sesion)) {
        return Response.json({ error: 'La trabaja otro operario' }, { status: 409 });
      }
    }

    // Validar checklist y fotos obligatorias antes de cerrar la OT
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

    const nuevoEstado = fija ? fija.hacia : flexible.hacia;
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

      if (isPortal) {
        // Portal: el operario_sesion (nombre manuscrito) reemplaza a user.id
        // como identidad de propiedad. No hay assigned_to (sin user.id real).
        if (operario_sesion) {
          updateData.operario_sesion = operario_sesion;
          if (ot.assigned_name !== operario_sesion) {
            updateData.assigned_name = operario_sesion;
          }
        }
      } else if (!callerEsAdmin) {
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

    // Persistencia de campos de reporte para TODAS las acciones
    if (extra_data.checklist !== undefined) updateData.checklist = extra_data.checklist;
    if (extra_data.materials_used !== undefined) updateData.materials_used = extra_data.materials_used;
    if (extra_data.materiales_faltantes !== undefined) {
      updateData.materiales_faltantes = extra_data.materiales_faltantes;
      const faltantes = extra_data.materiales_faltantes;
      if (Array.isArray(faltantes) && faltantes.length > 0) {
        const sinMotivo = faltantes.filter(m => !m.motivo || !String(m.motivo).trim());
        if (sinMotivo.length > 0) {
          return Response.json({ error: 'Todos los materiales faltantes deben tener un motivo' }, { status: 400 });
        }
      }
    }
    if (extra_data.notes !== undefined) updateData.notes = extra_data.notes;
    if (extra_data.photos !== undefined) updateData.photos = extra_data.photos;

    if (accion === 'aprobar' || accion === 'completar') {
      updateData.completed_date = new Date().toISOString().split('T')[0];
      updateData.fecha_validacion = new Date().toISOString();
      updateData.validado_por = isPortal
        ? (operario_sesion || 'Portal')
        : (user.full_name || user.email || 'Jefe de Sitio');
    }

    if (accion === 'rechazar') {
      if (!extra_data.rechazo_comentario || !extra_data.rechazo_comentario.trim()) {
        return Response.json({ error: 'Debe indicar un motivo de rechazo' }, { status: 400 });
      }
      updateData.rechazo_comentario = extra_data.rechazo_comentario.trim();
    }

    const actualizada = await base44.asServiceRole.entities.WorkOrder.update(ot_id, updateData);

    // ── Registro de historial del activo (lifecycle) ──
    if (nuevoEstado === 'completada' && ot.asset_id) {
      try {
        const mats = Array.isArray(actualizada.materials_used) ? actualizada.materials_used : [];
        const costoMateriales = mats.reduce((s, m) => s + ((m?.quantity || 0) * (m?.unit_cost || 0)), 0);
        const assetName = ot.asset_name || actualizada.asset_name || null;
        const fechaCierre = actualizada.completed_date || new Date().toISOString().split('T')[0];
        const actorName = isPortal ? (operario_sesion || 'Portal') : (user.full_name || user.email || '');
        await base44.asServiceRole.entities.AssetHistory.create({
          asset_id: ot.asset_id,
          asset_name: assetName,
          tipo_evento: 'mantenimiento',
          descripcion: `OT completada: ${ot.title || ot.code || ot.id}`,
          usuario: actorName,
          usuario_id: isPortal ? '' : user.id,
          ot_id: ot.id,
          costo: costoMateriales || 0,
          sector_id: ot.sector_id,
        });
        const esMantenimiento = ['mantenimiento_preventivo', 'mantenimiento_correctivo', 'reparacion'].includes(ot.type);
        if (esMantenimiento) {
          const asset = await base44.asServiceRole.entities.Asset.get(ot.asset_id).catch(() => null);
          if (asset && asset.sector_id === ot.sector_id) {
            const freq = asset.maintenance_frequency_days || 90;
            const proxima = new Date(fechaCierre);
            proxima.setDate(proxima.getDate() + freq);
            await base44.asServiceRole.entities.Asset.update(ot.asset_id, {
              last_maintenance: fechaCierre,
              next_maintenance: proxima.toISOString().split('T')[0],
            });
          }
        }
      } catch (e) {
        console.warn('[transicionEstadoOT] AssetHistory error:', e?.message);
      }
    }

    return Response.json({
      success: true,
      ot: actualizada,
      mensaje: MENSAJES[accion] || 'OT actualizada correctamente'
    });

  } catch (error) {
    return Response.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
});