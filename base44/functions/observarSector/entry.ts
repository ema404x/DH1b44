import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — solo administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const sectorId = body.sector_id;
    if (!sectorId) return Response.json({ error: 'sector_id requerido' }, { status: 400 });

    const sb = base44.asServiceRole;

    // Configuración del sector
    const sectors = await sb.entities.Sector.filter({ clave: sectorId }).catch(() => []);
    const sectorConfig = sectors[0] || null;

    // Entidades a inspeccionar
    const entities = [
      'WorkOrder', 'Employee', 'Certificado', 'SolicitudCertificado',
      'ObraCertificacion', 'AbonoMaestro', 'Edificio', 'LocationData',
      'Tablet', 'OrdenRutina', 'InspeccionColegio', 'EquipamientoCalefaccion',
      'ForoHilo', 'ForoNotificacion', 'RutinaEdificio'
    ];

    const resumen = {};
    for (const entityName of entities) {
      try {
        const entityApi = sb.entities[entityName];
        if (!entityApi) { resumen[entityName] = { error: 'no accesible' }; continue; }
        const records = await entityApi.filter({ sector_id: sectorId }, '-updated_date', 500);
        resumen[entityName] = {
          total: records.length,
          recientes: records.slice(0, 5).map(r => ({
            id: r.id,
            created_date: r.created_date,
            updated_date: r.updated_date
          }))
        };
      } catch (e) {
        resumen[entityName] = { error: e.message };
      }
    }

    // Usuarios asignados a este sector
    let usuarios = { total: 0 };
    try {
      const emps = await sb.entities.Employee.filter({ sector_id: sectorId }, '-updated_date', 500);
      usuarios = {
        total: emps.length,
        recientes: emps.slice(0, 5).map(e => ({ id: e.id, nombre: e.full_name, rol: e.role }))
      };
    } catch (e) {
      usuarios = { error: e.message };
    }

    return Response.json({ sector: sectorConfig, resumen, usuarios });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});