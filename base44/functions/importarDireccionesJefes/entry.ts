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

    // Headers están en fila 0
    const headers = rows[0];
    const jefeCol = headers.findIndex(h => String(h || '').toLowerCase().includes('jefe'));
    const comunaCol = headers.findIndex(h => String(h || '').toLowerCase().includes('comuna'));
    const direccionCol = headers.findIndex(h => String(h || '').toLowerCase().includes('dirección') || String(h || '').toLowerCase().includes('direccion'));
    const escuelaCol = headers.findIndex(h => String(h || '').toLowerCase().includes('escuela') || String(h || '').toLowerCase().includes('establecimiento'));

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

    for (const [key, dirData] of Object.entries(direccionesMap)) {
      try {
        // Crear Dirección
        const direccionRecord = await base44.asServiceRole.entities.Direccion.create({
          direccion: dirData.direccion,
          comuna: dirData.comuna,
          jefe_sitio: dirData.jefe,
          estado: 'activo',
        });

        direccionesCreadas++;

        // Crear Escuelas
        for (const escuela of dirData.escuelas) {
          try {
            await base44.asServiceRole.entities.LocationData.create({
              establecimiento: escuela,
              ubic_tecnica: escuela.substring(0, 20),
              comuna: dirData.comuna,
              direccion_id: direccionRecord.id,
              jefe_sitio: dirData.jefe,
              inspector: dirData.jefe,
              m2: 0,
              estado: 'activo',
            });
            escuelasCreadas++;
          } catch (err) {
            errors.push(`Escuela "${escuela}" en ${dirData.direccion}: ${err.message}`);
          }
        }
      } catch (err) {
        errors.push(`Dirección "${dirData.direccion}": ${err.message}`);
      }
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