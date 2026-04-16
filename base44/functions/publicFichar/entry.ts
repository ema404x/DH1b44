import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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
      const orders = await base44.asServiceRole.entities.WorkOrder.list('-created_date', 500);
      const workOrder = orders.find(o => o.id === workOrderId) || null;
      return Response.json({ workOrder });
    }

    // GET active work order for a location/establecimiento (public)
    if (action === 'getWorkOrderForLocation') {
      const { locationId } = body;
      if (!locationId) return Response.json({ error: 'locationId requerido' }, { status: 400 });

      // Get location info
      const locations = await base44.asServiceRole.entities.LocationQR.list('name', 200);
      const location = locations.find(l => l.id === locationId) || null;
      if (!location) return Response.json({ workOrder: null, locationName: '' });

      // Find active OT matching this location (by name or project)
      const orders = await base44.asServiceRole.entities.WorkOrder.list('-created_date', 500);
      const active = orders.find(o =>
        !['completada', 'cancelada'].includes(o.status) &&
        (
          o.location?.toLowerCase().includes(location.name.toLowerCase()) ||
          location.name.toLowerCase().includes(o.location?.toLowerCase() || '') ||
          (location.project_name && o.project_name === location.project_name)
        )
      ) || null;

      return Response.json({ workOrder: active, locationName: location.name });
    }

    // UPLOAD file (public — operario uploads photos/signature as base64)
    if (action === 'uploadFile') {
      const { fileBase64, fileName, mimeType } = body;
      if (!fileBase64) return Response.json({ error: 'fileBase64 requerido' }, { status: 400 });
      const binary = Uint8Array.from(atob(fileBase64), c => c.charCodeAt(0));
      const file = new File([binary], fileName || 'upload.png', { type: mimeType || 'image/png' });
      const result = await base44.asServiceRole.integrations.Core.UploadFile({ file });
      return Response.json({ file_url: result.file_url });
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