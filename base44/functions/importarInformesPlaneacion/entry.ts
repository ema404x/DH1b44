import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url } = await req.json();
    if (!file_url) return Response.json({ error: 'file_url requerida' }, { status: 400 });

    const { default: XLSX } = await import('npm:xlsx@0.18.5');
    const response = await fetch(file_url);
    const buffer = await response.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    // Saltar header (primera fila)
    const dataRows = rows.slice(1);
    let currentMes = null;
    const informes = [];

    for (const row of dataRows) {
      // Si la fila está vacía completamente, saltar
      if (!row || row.length === 0 || row.every(cell => !cell)) continue;

      // Si col_0 (MES) tiene valor, actualizar currentMes
      if (row[0] && String(row[0]).trim()) {
        currentMes = String(row[0]).trim();
      }

      // Solo procesar si tenemos descripción (col_1)
      if (!row[1] || !String(row[1]).trim()) continue;

      const informe = {
        mes: currentMes,
        descripcion: String(row[1]).trim(),
        proveedor_2025: row[2] ? String(row[2]).trim() : '',
        contacto_2025: row[3] ? String(row[3]).trim() : '',
        proveedor_invitado_2026: row[4] ? String(row[4]).trim() : '',
        estado_contacto: row[5] ? String(row[5]).trim() : 'PENDIENTE',
        proveedor_contratado_2026: row[6] ? String(row[6]).trim() : '',
        fecha_envio_contratar: row[7] ? String(row[7]).trim() : '',
        estado_actual: row[8] ? String(row[8]).trim() : '',
      };

      informes.push(informe);
    }

    // Insertar en lotes
    let success = 0;
    let errors = [];

    for (const informe of informes) {
      try {
        await base44.entities.InformePlaneacion.create(informe);
        success++;
      } catch (err) {
        errors.push({ descripcion: informe.descripcion, error: err.message });
      }
    }

    return Response.json({
      success,
      total: informes.length,
      errors,
      message: `Se importaron ${success} de ${informes.length} informes`
    });
  } catch (err) {
    console.error('Error:', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
});