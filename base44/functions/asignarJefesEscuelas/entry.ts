import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import * as XLSX from 'npm:xlsx@0.18.5';
import { createScopedClient, resolveCallerSector, sectorErrorResponse } from "../../shared/sectorGuard.ts";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Solo admin/gerente pueden reasignar jefes de sitio masivamente
    if (user.role !== 'admin' && user.role !== 'gerente') {
      return Response.json({ error: 'Forbidden: se requieren permisos de administrador' }, { status: 403 });
    }

    // Aislamiento entre sectores centralizado — ver base44/shared/sectorGuard.ts
    const callerSector = resolveCallerSector(user);
    const sb = createScopedClient(base44, callerSector);

    const formData = await req.formData();
    const file = formData.get('file');
    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { header: true });

    const locations = await sb.entities.LocationData.list('-created_date', 500);
    let updated = 0;
    const errors = [];

    // Procesar cada sheet (una por comuna)
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet);

      // Detectar comuna del sheet name
      let comuna = '8A';
      if (sheetName.includes('8B')) comuna = '8B';
      if (sheetName.includes('10A')) comuna = '10A';

      // Detectar column name para jefe (puede ser "JEFE SITIO", "JEFE ", "Jefe de sitio")
      const firstRow = data[0];
      const jefeCol = Object.keys(firstRow).find(k => 
        k?.toLowerCase().includes('jefe')
      );

      let currentDireccion = null;
      let currentJefe = null;

      for (const row of data) {
        // Si hay dirección en este row, actualizar dirección actual
        if (row['Dirección'] && row['Dirección'].trim()) {
          currentDireccion = row['Dirección'].trim();
        }

        // Si hay jefe en este row, actualizar jefe actual
        if (row[jefeCol] && row[jefeCol].trim()) {
          currentJefe = row[jefeCol].trim();
        }

        // Procesar establecimiento si existe
        if (row['Establecimiento'] && row['Establecimiento'].trim()) {
          const establecimiento = row['Establecimiento'].trim();

          // Buscar location coincidente
          const matching = locations.find(l => 
            l.establecimiento?.toLowerCase() === establecimiento.toLowerCase() ||
            l.establecimiento?.includes(establecimiento)
          );

          if (matching) {
            // Actualizar con dirección, jefe, y datos numéricos si existen
            const updateData = {
              ...matching,
              comuna,
              jefe_sitio: currentJefe,
              direccion: currentDireccion || matching.direccion,
            };

            // Agregar m2 y sup si existen
            if (row['M2'] && typeof row['M2'] === 'number') {
              updateData.m2 = row['M2'];
            }
            if (row['SUP'] && typeof row['SUP'] === 'number') {
              updateData.sup = row['SUP'];
            }

            await sb.entities.LocationData.update(matching.id, updateData);
            updated++;
          } else {
            errors.push(`No encontrado: ${establecimiento}`);
          }
        }
      }
    }

    return Response.json({
      success: true,
      updated,
      errors: errors.slice(0, 10), // Primeros 10 errores
      totalErrors: errors.length,
    });
  } catch (error) {
    return sectorErrorResponse(error);
  }
});