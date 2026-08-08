import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const OPERARIO_SALT = 'b44-operario-salt-v1';

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Verifica la clave de operario contra el hash en SecurityConfig (editable desde
// el Centro de Seguridad). Si no hay hash en DB, cae al secreto de plataforma
// OPERARIO_PASSWORD (migración no-ruptura). Devuelve { valid, configured }.
async function verificarClaveOperario(base44, password) {
  if (!password) return { valid: false, configured: false };
  const cfg = await base44.asServiceRole.entities.SecurityConfig.list().catch(() => []);
  const dbHash = cfg[0]?.operario_password_hash;
  const env = Deno.env.get('OPERARIO_PASSWORD');
  if (!dbHash && !env) return { valid: false, configured: false };
  const valid = dbHash ? (await sha256Hex(password + OPERARIO_SALT)) === dbHash : password === env;
  return { valid, configured: true };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action, locationId, attendanceData } = body;
    const sb = base44.asServiceRole;

    // GET location data — buscar directamente por ID en lugar de listar todo
    if (action === 'getLocationData') {
      if (!locationId) return Response.json({ error: 'locationId requerido' }, { status: 400 });
      const results = await sb.entities.LocationQR.filter({ id: locationId }).catch(() => []);
      const location = results[0] || null;
      return Response.json({ location });
    }

    // CREATE attendance log
    if (action === 'createAttendance') {
      if (!attendanceData) return Response.json({ error: 'attendanceData requerido' }, { status: 400 });

      const { location_qr_id, ...logData } = attendanceData;

      // Crear el log y buscar location en paralelo (si se necesita actualizar el contador)
      const [log, locResults] = await Promise.all([
        sb.entities.AttendanceLog.create(logData),
        location_qr_id ? sb.entities.LocationQR.filter({ id: location_qr_id }).catch(() => []) : Promise.resolve([]),
      ]);

      if (location_qr_id && locResults.length > 0) {
        const loc = locResults[0];
        await sb.entities.LocationQR.update(loc.id, {
          total_scans: (loc.total_scans || 0) + 1,
        });
      }

      return Response.json({ success: true, log });
    }

    // GET work order by ID
    if (action === 'getWorkOrder') {
      const { workOrderId } = body;
      if (!workOrderId) return Response.json({ error: 'workOrderId requerido' }, { status: 400 });
      const workOrders = await sb.entities.WorkOrder.filter({ id: workOrderId }).catch(() => []);
      return Response.json({ workOrder: workOrders[0] || null });
    }

    // GET active work orders for a location
    if (action === 'getWorkOrderForLocation') {
      const { locationId: locId } = body;
      if (!locId) return Response.json({ error: 'locationId requerido' }, { status: 400 });

      // Normalizar texto: lowercase + sin acentos + trimmed
      const normalize = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

      // Buscar location por ID directamente; buscar OTs vinculadas en paralelo
      const [locResults, ordersById] = await Promise.all([
        sb.entities.LocationQR.filter({ id: locId }).catch(() => []),
        sb.entities.WorkOrder.filter({ location_qr_id: locId }).catch(() => []),
      ]);

      const location = locResults[0] || null;
      if (!location) return Response.json({ workOrders: [], workOrder: null, locationName: '' });

      // Aislamiento por sector: las OTs de la ubicación deben pertenecer al mismo
      // sector que ella. Si la ubicación o la OT no tienen sector (legacy), no se
      // bloquea (deuda de migración). Evita fugas cross-sector en el fallback difuso.
      const locSector = location.sector_id;
      const sameSector = (o) => !locSector || !o.sector_id || o.sector_id === locSector;

      // 1) OTs activas vinculadas por location_qr_id
      let activeOrders = ordersById.filter(o =>
        !['completada', 'cancelada'].includes(o.status) && sameSector(o));

      // 2) Si no hay, buscar también por location_qr_name (nombre denormalizado)
      if (activeOrders.length === 0 && location.name) {
        const ordersByName = await sb.entities.WorkOrder.filter({ location_qr_name: location.name }).catch(() => []);
        activeOrders = ordersByName.filter(o =>
          !['completada', 'cancelada'].includes(o.status) && sameSector(o));
      }

      // 3) Fallback final: matching difuso por campo location (texto libre)
      if (activeOrders.length === 0) {
        const fallbackOrders = await sb.entities.WorkOrder.list('-created_date', 500).catch(() => []);
        const locNameNorm = normalize(location.name);
        const locAddrNorm = normalize(location.address);
        activeOrders = fallbackOrders.filter(o => {
          if (['completada', 'cancelada'].includes(o.status)) return false;
          if (!sameSector(o)) return false;
          const oLocNorm = normalize(o.location);
          const oLocQrNameNorm = normalize(o.location_qr_name);
          return (
            (oLocNorm && locNameNorm && (oLocNorm.includes(locNameNorm) || locNameNorm.includes(oLocNorm))) ||
            (oLocQrNameNorm && locNameNorm && (oLocQrNameNorm.includes(locNameNorm) || locNameNorm.includes(oLocQrNameNorm))) ||
            (locAddrNorm && oLocNorm && oLocNorm.includes(locAddrNorm)) ||
            (location.project_name && o.project_name === location.project_name)
          );
        });
      }

      const priorityOrder = { urgente: 0, alta: 1, media: 2, baja: 3 };
      activeOrders.sort((a, b) => (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2));

      return Response.json({
        workOrders: activeOrders,
        workOrder: activeOrders[0] || null,
        locationName: location.name,
        locationAddress: location.address || '',
      });
    }

    // UPLOAD file — validar tipo y tamaño
    if (action === 'uploadFile') {
      const { fileBase64, fileName, mimeType } = body;
      if (!fileBase64) return Response.json({ error: 'fileBase64 requerido' }, { status: 400 });
      const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      const finalMime = mimeType || 'image/png';
      if (!ALLOWED_MIME.includes(finalMime)) {
        return Response.json({ error: 'Tipo de archivo no permitido' }, { status: 400 });
      }
      if (fileBase64.length > 14 * 1024 * 1024) {
        return Response.json({ error: 'Archivo demasiado grande (máx 10MB)' }, { status: 413 });
      }
      const binary = Uint8Array.from(atob(fileBase64), c => c.charCodeAt(0));
      const blob = new Blob([binary], { type: finalMime });
      const file = new File([blob], fileName || 'upload.png', { type: finalMime });
      const result = await sb.integrations.Core.UploadFile({ file });
      return Response.json({ file_url: result.file_url });
    }

    // VERIFY operario password — hash en DB (Centro de Seguridad) con fallback al secreto
    if (action === 'verifyOperarioPassword') {
      const { password } = body;
      const { valid, configured } = await verificarClaveOperario(base44, password);
      if (!configured) return Response.json({ error: 'Servicio no configurado' }, { status: 503 });
      return Response.json({ valid });
    }

    // UPDATE work order — requiere la clave de operario (secreto compartido)
    // para evitar que un atacante anónimo modifique OTs arbitrarias.
    // Solo campos operables por el operario; los de validación/rechazo son
    // exclusivos del jefe de sitio (vía transicionEstadoOT, autenticado).
    if (action === 'updateWorkOrder') {
      const { workOrderId, updates, password } = body;
      if (!workOrderId || !updates) return Response.json({ error: 'Parámetros requeridos' }, { status: 400 });

      const { valid, configured } = await verificarClaveOperario(base44, password);
      if (!configured) return Response.json({ error: 'Servicio no configurado' }, { status: 503 });
      if (!valid) {
        return Response.json({ error: 'Clave de operario requerida' }, { status: 401 });
      }

      const existing = await sb.entities.WorkOrder.filter({ id: workOrderId }).catch(() => []);
      const workOrder = existing[0];
      if (!workOrder) return Response.json({ error: 'OT no encontrada' }, { status: 404 });
      if (['completada', 'cancelada'].includes(workOrder.status)) {
        return Response.json({ error: 'No se puede modificar una OT completada o cancelada' }, { status: 403 });
      }

      const ALLOWED_FIELDS = [
        'status', 'checklist', 'photos', 'signature_url', 'signature_name',
        'completed_date', 'gps_latitude', 'gps_longitude', 'gps_accuracy',
        'gps_timestamp', 'gps_status', 'fecha_inicio_real', 'notes',
        'materials_used', 'materiales_faltantes', 'motivos_incompleto',
      ];
      const safeUpdates = {};
      for (const key of ALLOWED_FIELDS) {
        if (key in updates) safeUpdates[key] = updates[key];
      }

      const updated = await sb.entities.WorkOrder.update(workOrderId, safeUpdates);
      return Response.json({ success: true, workOrder: updated });
    }

    // ACTIVATE tablet — valida código de activación y devuelve el jefe vinculado
    if (action === 'activateTablet') {
      const { codigo } = body;
      if (!codigo) return Response.json({ valid: false }, { status: 400 });
      const tablets = await sb.entities.Tablet.filter({ codigo_activacion: codigo.trim() }).catch(() => []);
      const tablet = tablets[0];
      if (!tablet || !tablet.activa) {
        return Response.json({ valid: false });
      }
      await sb.entities.Tablet.update(tablet.id, { ultima_actividad: new Date().toISOString() }).catch(() => {});
      return Response.json({
        valid: true,
        tablet: { id: tablet.id, nombre: tablet.nombre, jefe_sitio: tablet.jefe_sitio },
      });
    }

    // GET OTs for a tablet — solo las del jefe vinculado a esa tablet
    if (action === 'getOTsForTablet') {
      const { tablet_id } = body;
      if (!tablet_id) return Response.json({ error: 'tablet_id requerido' }, { status: 400 });
      const tablets = await sb.entities.Tablet.filter({ id: tablet_id }).catch(() => []);
      const tablet = tablets[0];
      if (!tablet || !tablet.activa) {
        return Response.json({ error: 'Tablet no válida o desactivada' }, { status: 404 });
      }
      const jefeOTs = await sb.entities.WorkOrder.filter({ jefe_sitio: tablet.jefe_sitio }).catch(() => []);
      return Response.json({
        workOrders: jefeOTs,
        jefe_sitio: tablet.jefe_sitio,
        tablet_nombre: tablet.nombre,
      });
    }

    return Response.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});