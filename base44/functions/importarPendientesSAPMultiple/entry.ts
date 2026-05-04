import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { processed_data, inspector_name, inspector_email } = await req.json();

  if (!processed_data || !Array.isArray(processed_data)) {
    return Response.json({ error: 'processed_data requerido' }, { status: 400 });
  }

  let totalImported = 0;
  let totalErrors = 0;

  for (const { data } of processed_data) {
    for (const sheetData of Object.values(data)) {
      if (!Array.isArray(sheetData) || sheetData.length < 2) continue;

      const headers = (sheetData[0] || []).map(h => String(h || '').trim());
      
      for (let i = 1; i < sheetData.length; i++) {
        const row = sheetData[i];
        const rowObj = {};
        headers.forEach((h, idx) => { rowObj[h] = row[idx]; });

        const nro = String(rowObj['N° DE ORDEN'] || rowObj['N° DE ORDEN '] || rowObj['NRO DE ORDEN'] || '').trim();
        const desc = String(rowObj['TAREAS A REALIZAR'] || rowObj['TAREA'] || rowObj['DESCRIPCION'] || '').trim();
        const insp = String(rowObj['INSPECTOR'] || '').trim().toUpperCase();

        if (!nro || !desc || !insp) continue;

        try {
          await base44.entities.Pendiente.create({
            numero_sap: nro,
            descripcion: desc,
            inspector: insp,
            sitio: String(rowObj['UBICACIÓN'] || rowObj['UBICACION'] || '').trim() || null,
            establecimiento: String(rowObj['ESTABLECIMIENTO'] || '').trim() || null,
            tipo: 'mantenimiento',
            estado: 'pendiente',
            prioridad: 'media',
            jefe_sitio: inspector_name || null,
            jefe_sitio_email: inspector_email || null,
          });
          totalImported++;
        } catch (e) {
          totalErrors++;
        }
      }
    }
  }

  return Response.json({
    imported: totalImported,
    errors: totalErrors,
    skipped: 0,
    total_rows: totalImported + totalErrors,
  });
});