import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const COMUNAS_MAP = {
  'COMUNA 8A1': '8A',
  'COMUNA 8B1': '8B',
  'COMUNA 10A1': '10A'
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sheetData } = await req.json();

    if (!sheetData || !Array.isArray(sheetData)) {
      return Response.json({ error: 'sheetData inválido' }, { status: 400 });
    }

    let importedCount = 0;
    const errors = [];

    for (const sheet of sheetData) {
      const { name, rows } = sheet;
      const comuna = COMUNAS_MAP[name];

      if (!comuna) {
        errors.push(`Hoja desconocida: ${name}`);
        continue;
      }

      let currentDireccion = null;
      let currentDireccionM2 = null;
      let currentInspector = null;
      let currentJefeSitio = null;

      for (const row of rows) {
        const numero = row['N°'];
        const direccion = row['Dirección'] || row['Dirección'];
        const establecimiento = row['Establecimiento'] || '';
        const m2 = row['M2'];
        const inspector = row['INSPECTOR'] || '';
        const jefeSitio = row['JEFE SITIO'] || row['JEFE '] || row['Jefe de sitio'] || null;
        const sup = row['SUP'];

        // Si tiene N°, es una dirección nueva
        if (numero) {
          currentDireccion = direccion || establecimiento;
          currentDireccionM2 = m2;
          currentInspector = inspector;
          currentJefeSitio = jefeSitio;
        }

        // Skip si no tiene establecimiento
        if (!establecimiento || !establecimiento.trim()) {
          continue;
        }

        // Crear ubicación
        try {
          const locationData = {
            ubic_tecnica: `${establecimiento.substring(0, 50)}`.toLowerCase(),
            direccion: currentDireccion || direccion || '',
            establecimiento: establecimiento.trim(),
            m2: m2 ? parseFloat(String(m2).replace(/,/g, '.')) : null,
            inspector: currentInspector || inspector || '',
            jefe_sitio: currentJefeSitio,
            comuna,
            sup: sup ? parseFloat(String(sup).replace(/,/g, '.')) : null,
            estado: 'activo',
          };

          await base44.entities.LocationData.create(locationData);
          importedCount++;
        } catch (err) {
          errors.push(`Error en ${establecimiento}: ${err.message}`);
        }
      }
    }

    return Response.json({
      success: true,
      imported: importedCount,
      errors: errors.length,
      errorsList: errors.slice(0, 20),
      hasMore: errors.length > 20,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});