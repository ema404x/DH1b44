import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fileUrl, comunaId } = await req.json();

    if (!fileUrl || !comunaId) {
      return Response.json({ error: 'Faltan fileUrl o comunaId' }, { status: 400 });
    }

    const fileRes = await fetch(fileUrl);
    const buffer = await fileRes.arrayBuffer();
    
    const { default: XLSX } = await import('npm:xlsx@0.18.5');
    const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });

    const sheetMap = {
      '8A': 'COMUNA 8A1',
      '8B': 'COMUNA 8B1',
      '10A': 'COMUNA 10A1',
    };

    const sheetName = sheetMap[comunaId];
    if (!workbook.SheetNames.includes(sheetName)) {
      return Response.json({ error: `No existe hoja para ${comunaId}` }, { status: 400 });
    }

    const ws = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws);

    const direccionesMap = {};
    const escuelasCrear = [];
    let currentDireccion = null;
    let currentJefe = null;
    let currentInspector = null;
    let currentM2 = 0;
    let currentSup = 0;

    // Procesar filas jerárquicamente
    for (const row of rows) {
      const jefeKey = Object.keys(row).find(k => k.toLowerCase().includes('jefe'));
      
      // Si tiene N°, es dirección principal
      if (row['N°']) {
        currentDireccion = row['Dirección']?.trim();
        currentJefe = row[jefeKey]?.trim() || null;
        currentInspector = row['INSPECTOR']?.trim() || null;
        currentM2 = row['M2'] || 0;
        currentSup = row['SUP'] || 0;

        if (currentDireccion) {
          direccionesMap[currentDireccion] = {
            direccion: currentDireccion,
            comuna: comunaId,
            jefe_sitio: currentJefe,
            inspector: currentInspector,
            m2: currentM2,
            sup: currentSup,
            escuelas: [],
          };
        }
      }

      // Procesar establecimiento
      const establecimiento = row['Establecimiento']?.trim();
      if (establecimiento && currentDireccion) {
        direccionesMap[currentDireccion].escuelas.push({
          establecimiento,
          ubic_tecnica: row['Ubic. Técnica'] || row['N°'] || establecimiento,
          elem_pep: row['Elem. PEP'] || null,
          m2: row['M2'] || 0,
          jefe_sitio: currentJefe,
          inspector: currentInspector,
          comuna: comunaId,
        });
      }
    }

    // Crear direcciones y escuelas
    let direccionesCreadas = 0;
    let escuelasCreadas = 0;

    for (const [dir, data] of Object.entries(direccionesMap)) {
      try {
        // Crear dirección
        const direccionRes = await base44.asServiceRole.entities.Direccion.create({
          direccion: data.direccion,
          comuna: data.comuna,
          jefe_sitio: data.jefe_sitio,
          inspector: data.inspector,
          m2: data.m2,
          sup: data.sup,
          cantidad_escuelas: data.escuelas.length,
        });

        direccionesCreadas++;

        // Crear escuelas asociadas
        for (const escuela of data.escuelas) {
          await base44.asServiceRole.entities.LocationData.create({
            ...escuela,
            direccion_id: direccionRes.id,
          });
          escuelasCreadas++;
        }
      } catch (err) {
        console.error(`Error procesando dirección ${dir}:`, err.message);
      }
    }

    return Response.json({
      success: true,
      direccionesCreadas,
      escuelasCreadas,
      message: `${direccionesCreadas} direcciones y ${escuelasCreadas} escuelas importadas correctamente.`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});