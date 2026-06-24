import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action, locationId, attendanceData } = body;

    // GET location data (public, no auth needed)
    if (action === 'getLocationData') {
      if (!locationId) {
        return Response.json({ error: 'locationId requerido' }, { status: 400 });
      }
      const results = await base44.asServiceRole.entities.LocationQR.list('name', 200);
      const location = results.find(l => l.id === locationId) || null;
      return Response.json({ location });
    }

    // CREATE attendance log (public, no auth needed)
    if (action === 'createAttendance') {
      if (!attendanceData) {
        return Response.json({ error: 'attendanceData requerido' }, { status: 400 });
      }

      const { location_qr_id, ...logData } = attendanceData;

      const log = await base44.asServiceRole.entities.AttendanceLog.create(logData);

      // Update scan count
      if (location_qr_id) {
        const allLocs = await base44.asServiceRole.entities.LocationQR.list('name', 200);
        const loc = allLocs.find(l => l.id === location_qr_id);
        if (loc) {
          await base44.asServiceRole.entities.LocationQR.update(loc.id, {
            total_scans: (loc.total_scans || 0) + 1,
          });
        }
      }

      return Response.json({ success: true, log });
    }

    // GET work order by ID (public)
    if (action === 'getWorkOrder') {
      const { workOrderId } = body;
      if (!workOrderId) return Response.json({ error: 'workOrderId requerido' }, { status: 400 });
      const workOrders = await base44.asServiceRole.entities.WorkOrder.filter({ id: workOrderId });
      const workOrder = workOrders[0] || null;
      return Response.json({ workOrder });
    }

    // GET active work orders for a location/establecimiento (public)
    if (action === 'getWorkOrderForLocation') {
      const { locationId } = body;
      if (!locationId) return Response.json({ error: 'locationId requerido' }, { status: 400 });

      // Get location info
      const locations = await base44.asServiceRole.entities.LocationQR.list('name', 200);
      const location = locations.find(l => l.id === locationId) || null;
      if (!location) return Response.json({ workOrders: [], workOrder: null, locationName: '' });

      // Find active OTs: primero por location_qr_id exacto, luego fallback por nombre
      const orders = await base44.asServiceRole.entities.WorkOrder.list('-created_date', 500);
      const activeOrders = orders.filter(o => {
        if (['completada', 'cancelada'].includes(o.status)) return false;
        // Match exacto por ID (vinculado al crear la OT)
        if (o.location_qr_id === locationId) return true;
        // Fallback: match por nombre/dirección
        const locNameLower = location.name.toLowerCase();
        const locAddrLower = (location.address || '').toLowerCase();
        const oLocLower = (o.location || '').toLowerCase();
        return (
          (oLocLower && (oLocLower.includes(locNameLower) || locNameLower.includes(oLocLower))) ||
          (locAddrLower && oLocLower && oLocLower.includes(locAddrLower)) ||
          (location.project_name && o.project_name === location.project_name)
        );
      });

      // Ordenar: urgente primero, luego por fecha creación
      const priorityOrder = { urgente: 0, alta: 1, media: 2, baja: 3 };
      activeOrders.sort((a, b) => (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2));

      return Response.json({
        workOrders: activeOrders,
        workOrder: activeOrders[0] || null, // compatibilidad retroactiva
        locationName: location.name,
        locationAddress: location.address || '',
      });
    }

    // UPLOAD file (public — operario uploads photos/signature as base64)
    if (action === 'uploadFile') {
      const { fileBase64, fileName, mimeType } = body;
      if (!fileBase64) return Response.json({ error: 'fileBase64 requerido' }, { status: 400 });
      const binary = Uint8Array.from(atob(fileBase64), c => c.charCodeAt(0));
      const blob = new Blob([binary], { type: mimeType || 'image/png' });
      const file = new File([blob], fileName || 'upload.png', { type: mimeType || 'image/png' });
      const result = await base44.asServiceRole.integrations.Core.UploadFile({ file });
      return Response.json({ file_url: result.file_url });
    }

    // VERIFY operario password (global PIN stored in app config)
    if (action === 'verifyOperarioPassword') {
      const { password } = body;
      if (!password) return Response.json({ valid: false }, { status: 400 });
      // Buscar la clave global en la entidad RolePermission con role_name='operario_portal'
      const configs = await base44.asServiceRole.entities.RolePermission.list('role_name', 100);
      const config = configs.find(c => c.role_name === 'operario_portal');
      const storedPassword = config?.description || 'operario123'; // default si no está configurado
      return Response.json({ valid: password === storedPassword });
    }

    // UPDATE work order (public — operario saves checklist, photos, signature)
    if (action === 'updateWorkOrder') {
      const { workOrderId, updates } = body;
      if (!workOrderId || !updates) return Response.json({ error: 'Parámetros requeridos' }, { status: 400 });
      const updated = await base44.asServiceRole.entities.WorkOrder.update(workOrderId, updates);
      return Response.json({ success: true, workOrder: updated });
    }

    return Response.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});