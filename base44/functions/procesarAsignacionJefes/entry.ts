import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { createScopedClient, sectorErrorResponse } from '../../shared/sectorGuard.ts';
import { resolveAndReconcileSector } from '../../shared/callerIdentity.ts';
import { assertAllowedFileUrl } from '../../shared/excelImport.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores pueden reasignar responsables' }, { status: 403 });
    const { sector } = await resolveAndReconcileSector(base44.asServiceRole, user);
    const sb = createScopedClient(base44, sector);
    const { fileUrl, comunaId } = await req.json();

    if (!fileUrl || !comunaId) {
      return Response.json({ error: 'Faltan fileUrl o comunaId' }, { status: 400 });
    }

    // Descargar el archivo
    assertAllowedFileUrl(fileUrl);
    const fileRes = await fetch(fileUrl, { signal: AbortSignal.timeout(30000) });
    const buffer = await fileRes.arrayBuffer();
    
    // Importar xlsx en runtime
    const { default: XLSX } = await import('npm:xlsx@0.18.5');
    const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });

    // Mapeo de nombres de hojas por comuna
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

    // Obtener todas las ubicaciones de la comuna
    const locations = await sb.entities.LocationData.filter({
      comuna: comunaId
    });

    const updatedMap = {};
    let currentDireccion = null;
    let currentJefe = null;
    let currentInspector = null;

    // Procesar filas jerárquicamente
    for (const row of rows) {
      // Detectar columna de jefe (puede ser "JEFE SITIO", "JEFE " o "Jefe de sitio")
      const jefeKey = Object.keys(row).find(k => 
        k.toLowerCase().includes('jefe')
      );
      
      // Si la fila tiene N° (dirección principal)
      if (row['N°']) {
        currentDireccion = row['Dirección']?.trim();
        currentJefe = row[jefeKey]?.trim() || null;
        currentInspector = row['INSPECTOR']?.trim() || null;
      }

      // Procesar establecimiento actual
      const establecimiento = row['Establecimiento']?.trim();
      if (!establecimiento) continue;

      // Buscar la ubicación en LocationData
      const matchedLocation = locations.find(loc => {
        const normEstablecimiento = loc.establecimiento?.toLowerCase().trim();
        const normRow = establecimiento.toLowerCase().trim();
        return normEstablecimiento === normRow;
      });

      if (matchedLocation) {
        if (!updatedMap[matchedLocation.id]) {
          updatedMap[matchedLocation.id] = {
            jefe_sitio: currentJefe,
            inspector: currentInspector,
            direccion: currentDireccion,
          };
        }
      }
    }

    // Aplicar actualizaciones
    let updateCount = 0;
    let errorCount = 0;

    for (const [locId, updates] of Object.entries(updatedMap)) {
      try {
        if (updates.jefe_sitio || updates.inspector) {
          await sb.entities.LocationData.update(locId, {
            jefe_sitio: updates.jefe_sitio,
            inspector: updates.inspector,
          });
          updateCount++;
        }
      } catch (err) {
        errorCount++;
      }
    }

    return Response.json({
      success: true,
      processedRows: rows.length,
      updatedLocations: updateCount,
      errors: errorCount,
      message: `Procesadas ${rows.length} filas, actualizadas ${updateCount} escuelas.`,
    });
  } catch (error) {
    return sectorErrorResponse(error);
  }
}