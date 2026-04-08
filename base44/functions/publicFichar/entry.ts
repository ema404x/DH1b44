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
      const location = await base44.asServiceRole.entities.LocationQR.get(locationId);
      return Response.json({ location: location || null });
    }

    // CREATE attendance log (public, no auth needed)
    if (action === 'createAttendance') {
      if (!attendanceData) {
        return Response.json({ error: 'attendanceData requerido' }, { status: 400 });
      }

      const { location_qr_id, ...logData } = attendanceData;

      const log = await base44.asServiceRole.entities.AttendanceLog.create(logData);
      return Response.json({ success: true, log });
    }

    return Response.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});