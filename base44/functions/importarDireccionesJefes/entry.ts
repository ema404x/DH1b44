import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import * as XLSX from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { file_url } = await req.json();

    if (!file_url) {
      return Response.json({ error: 'file_url requerido' }, { status: 400 });
    }

    // Descargar el archivo
    const fileRes = await fetch(file_url);
    const buffer = await fileRes.arrayBuffer();
    const wb = XLSX.read(buffer);

    // Leer la hoja "Detalle por Escuela" (es la más completa)
    const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('escuela'));
    if (!sheetName) {
      return Response.json({ error: 'No se encontró hoja "Detalle por Escuela"' }, { status: 400 });
    }

    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

    // Los headers están en fila 0 pero con nombres raros como "col_1", "col_2", etc
    // Detectar por posición: Jefe (0), Comuna (1), Dirección (2), Escuela (3)
    const jefeCol = 0;    // Primera columna
    const comunaCol = 1;  // Segunda columna
    const direccionCol = 2; // Tercera columna
    const escuelaCol = 3; // Cuarta columna

    // Agrupar datos
    const direccionesMap = {}; // direccion -> { jefe, comuna, escuelas: [] }

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const jefe = String(row[jefeCol] || '').trim();
      const comuna = String(row[comunaCol] || '').trim();
      const direccion = String(row[direccionCol] || '').trim();
      const escuela = String(row[escuelaCol] || '').trim();

      if (!jefe || !direccion || !escuela) continue;

      // Normalizar comuna (ej: "COMUNA 8B1" -> "8B")
      const comunaNorm = comuna.replace(/COMUNA\s*/i, '').replace(/1$/, '').trim();

      const dirKey = `${direccion}|${comunaNorm}`;

      if (!direccionesMap[dirKey]) {
        direccionesMap[dirKey] = {
          jefe,
          comuna: comunaNorm,
          direccion,
          escuelas: new Set(),
        };
      }

      direccionesMap[dirKey].escuelas.add(escuela);
    }

    // Crear registros en la BD
    let direccionesCreadas = 0;
    let escuelasCreadas = 0;
    const errors = [];

    // Primero crear todas las direcciones
    const direccionesIds = {};
    const direccionesList = Object.entries(direccionesMap).map(([key, dirData]) => ({
      direccion: dirData.direccion,
      comuna: dirData.comuna,
      jefe_sitio: dirData.jefe,
      estado: 'activo',
    }));

    try {
      const dirsCreated = await base44.asServiceRole.entities.Direccion.bulkCreate(direccionesList);
      direccionesCreadas = dirsCreated.length;

      // Mapear direcciones creadas
      Object.entries(direccionesMap).forEach(([key, dirData], idx) => {
        if (dirsCreated[idx]) {
          direccionesIds[key] = dirsCreated[idx].id;
        }
      });

      // Luego crear todas las escuelas en bulk
      const escuelasList = [];
      Object.entries(direccionesMap).forEach(([key, dirData]) => {
        const dirId = direccionesIds[key];
        if (!dirId) return;

        for (const escuela of dirData.escuelas) {
          escuelasList.push({
            establecimiento: escuela,
            ubic_tecnica: escuela.substring(0, 30),
            comuna: dirData.comuna,
            direccion_id: dirId,
            jefe_sitio: dirData.jefe,
            inspector: dirData.jefe,
            m2: 0,
            estado: 'activo',
          });
        }
      });

      if (escuelasList.length > 0) {
        const escsCreated = await base44.asServiceRole.entities.LocationData.bulkCreate(escuelasList);
        escuelasCreadas = escsCreated.length;
      }
    } catch (err) {
      errors.push(`Error en creación bulk: ${err.message}`);
    }

    return Response.json({
      success: true,
      direccionesCreadas,
      escuelasCreadas,
      errores: errors,
      message: `Importación completada: ${direccionesCreadas} direcciones y ${escuelasCreadas} escuelas`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});