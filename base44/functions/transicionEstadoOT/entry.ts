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

    // ── Resolución canónica del sector del caller ──
    // ALINEADA con getWorkOrdersForUser: la ficha de Empleado es la fuente canónica
    // de sector (decisión del proyecto). Resolvemos primero por email y luego por
    // user_id; si la ficha tiene sector, es la verdad. Sin esto, un jefe con
    // data.sector_id stale en la plataforma ve sus OTs (getWorkOrdersForUser corrige
    // vía la ficha) pero al transicionar recibe 403 "pertenece a otro sector" porque
    // acá se leía solo user.data.sector_id. cambiarSectorActivo sincroniza ficha Y
    // plataforma a la vez, así que esto nunca regresa un cambio de sector legítimo.
    const userEmail = (user.email || '').toLowerCase().trim();
    let employee = null;
    if (userEmail) {
      const byEmail = await base44.asServiceRole.entities.Employee
        .filter({ email: userEmail }).catch(() => []);
      employee = byEmail && byEmail.length > 0 ? byEmail[0] : null;
    }
    if (!employee && user.id) {
      const byUid = await base44.asServiceRole.entities.Employee
        .filter({ user_id: user.id }).catch(() => []);
      employee = byUid && byUid.length > 0 ? byUid[0] : null;
    }
    const callerSector = employee?.sector_id || user?.data?.sector_id || user?.sector_id;
    const callerEsAdmin = ['admin', 'gerente'].includes(user.role || '');

    // Reconciliación best-effort (igual que getWorkOrdersForUser): si la ficha tiene
    // sector y difiere del usuario de plataforma, alinear data.sector_id al de la
    // ficha. Idempotente y no interrumpe si la escritura falla. Así RLS y otros
    // lectores también quedan en el sector correcto sin pedir re-login.
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
    // Aislamiento de raíz: TODOS (incluido admin/gerente) deben operar solo OTs de su
    // sector activo. Para ver/tocar otro sector hay que cambiar de sector activo.
    // No existe bypass por rol — el bypass sería exactamente lo que rompe el aislamiento.
    if (ot.sector_id !== callerSector) {
      return Response.json({ error: 'Esta OT pertenece a otro sector. Cambiá de sector activo para operarla.' }, { status: 403 });
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
    // Reutiliza el employee resuelto arriba (sector canónico) — evita un fetch
    // duplicado y garantiza consistencia entre el chequeo de sector y el de rol.
    let esJefe = esAdminPlataforma;
    if (!esJefe) {
      esJefe = canManageOT(employee?.role);
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

    // Persistencia de campos de reporte para TODAS las acciones (iniciar,
    // finalizar, completar, aprobar, rechazar). Centraliza la escritura en
    // service-role: la RLS directa bloquea al operario que no es creador/jefe,
    // así los materiales faltantes cargados al INICIAR una OT se perdían y el
    // jefe nunca los veía. Acá se persisten junto con la transición, sin depender
    // de la acción, con el mismo aislamiento de sector que valida la función.
    // El reporte reemplaza (no acumula): si la OT fue rechazada y el operario
    // re-finaliza, queda exactamente lo que envía ahora.
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

    // ── Registro de historial del activo (lifecycle UpKeep) ──
    // Solo cuando la OT llega a 'completada' y tiene asset_id. Best-effort: si
    // falla, la transición ya quedó hecha y no se interrumpe. Estampa el sector de
    // la OT (== callerSector, validado arriba) → AssetHistory queda aislado.
    if (nuevoEstado === 'completada' && ot.asset_id) {
      try {
        const mats = Array.isArray(actualizada.materials_used) ? actualizada.materials_used : [];
        const costoMateriales = mats.reduce((s, m) => s + ((m?.quantity || 0) * (m?.unit_cost || 0)), 0);
        const assetName = ot.asset_name || actualizada.asset_name || null;
        const fechaCierre = actualizada.completed_date || new Date().toISOString().split('T')[0];
        await base44.asServiceRole.entities.AssetHistory.create({
          asset_id: ot.asset_id,
          asset_name: assetName,
          tipo_evento: 'mantenimiento',
          descripcion: `OT completada: ${ot.title || ot.code || ot.id}`,
          usuario: user.full_name || user.email || '',
          usuario_id: user.id,
          ot_id: ot.id,
          costo: costoMateriales || 0,
          sector_id: ot.sector_id,
        });
        // Auto-actualizar last_maintenance/next_maintenance del activo cuando la
        // OT es de mantenimiento (preventivo/correctivo/reparacion). UpKeep-style:
        // el ciclo de mantenimiento se alimenta de las OTs reales, no solo manual.
        // Defense-in-depth: re-chequea sector del asset antes de escribir.
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