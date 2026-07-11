import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — solo administradores' }, { status: 403 });

    const sb = base44.asServiceRole;
    const results = {};

    const entities = [
      'Employee',
      'WorkOrder',
      'ObraCertificacion',
      'AbonoMaestro',
      'Edificio',
      'LocationData',
      'Certificado',
      'SolicitudCertificado',
      'InspeccionColegio',
      'EquipamientoCalefaccion',
      'OrdenRutina',
      'RutinaEdificio',
      'Tablet',
      'ForoHilo',
      'ForoNotificacion',
      'Project',
      'Client',
      'Invoice',
      'Material',
      'Asset',
      'Pendiente'
    ];

    for (const entityName of entities) {
      try {
        const entityApi = sb.entities[entityName];
        if (!entityApi || typeof entityApi.updateMany !== 'function') {
          results[entityName] = { error: `Entity ${entityName} not accessible` };
          continue;
        }
        const res = await entityApi.updateMany(
          { sector_id: null },
          { $set: { sector_id: 'escuela' } }
        );
        results[entityName] = res;
      } catch (e) {
        results[entityName] = { error: e.message };
      }
    }

    return Response.json({ success: true, migrated: results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});