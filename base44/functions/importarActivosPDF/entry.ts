import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolverTipoBapro } from '../../shared/baproTipos.ts';
import { createScopedClient, resolveCallerSector, SectorError } from '../../shared/sectorGuard.ts';
import { assertAllowedFileUrl } from '../../shared/excelImport.ts';
import { bulkImportAssets } from '../../shared/assetBulkImport.ts';
import { importRoleError } from '../../shared/importGuard.ts';

// Importer masivo de Activos desde uno o varios PDFs.
//   dry_run=true  → extrae + valida SIN escribir; devuelve preview.
//   dry_run=false → ejecuta el import real y persiste ImportacionActivos.

const MAX_FILES = 20;
const MAX_INPUTS = 5000;
const ASSET_SCHEMA = {
  type: 'object',
  properties: {
    activos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nombre: { type: 'string', description: 'Nombre o descripción del activo' },
          codigo: { type: 'string', description: 'Código, número de inventario o patrimonio del bien' },
          tipo: { type: 'string', description: 'Tipo: eléctrico, mecánico, HVAC, sanitario, estructura, vehículo, herramienta, informático, mobiliario, seguridad u otro' },
          marca: { type: 'string' },
          modelo: { type: 'string' },
          serie: { type: 'string', description: 'Número de serie' },
          sede: { type: 'string', description: 'Nombre de la sucursal o sede del banco (por ejemplo Sucursal Flores o Sede Central). No poner la dirección.' },
          area: { type: 'string', description: 'Área, zona o departamento dentro de la sede' },
          jefe_sitio: { type: 'string', description: 'Responsable / jefe de sitio' },
          comuna: { type: 'string', description: 'Comuna: 8A, 8B o 10A' },
          estado: { type: 'string', description: 'Estado: operativo, en mantenimiento, fuera de servicio o baja' },
          criticidad: { type: 'string', description: 'Criticidad: baja, media, alta o crítica' },
          ubicacion: { type: 'string', description: 'Ubicación física detallada' },
          costo: { type: 'number', description: 'Costo de adquisición / valor' },
          fecha_compra: { type: 'string', description: 'Fecha de compra (DD/MM/YYYY o ISO)' },
          garantia: { type: 'string', description: 'Fecha de vencimiento de garantía' },
          notas: { type: 'string', description: 'Observaciones' },
        },
        required: ['nombre'],
      },
    },
  },
  required: ['activos'],
};

function mapExtractedItem(item) {
  if (!item || typeof item !== 'object') return null;
  const name = item.nombre || item.name;
  if (!name || !String(name).trim()) return null;
  return {
    name: String(name).trim(),
    code: item.codigo || item.code || '',
    type: item.tipo || item.type || '',
    brand: item.marca || item.brand || '',
    model: item.modelo || item.model || '',
    serial_number: item.serie || item.serial || item.serial_number || '',
    sede: item.sede || item.establecimiento || item.edificio || '',
    area: item.area || item.zona || '',
    jefe_sitio: item.jefe_sitio || item.responsable || '',
    comuna: item.comuna || '',
    status: item.estado || item.status || '',
    criticality: item.criticidad || item.critica || item.criticity || item.criticality || '',
    location: item.ubicacion || item.ubicación || item.location || '',
    purchase_cost: item.costo || item.valor || item.purchase_cost || 0,
    purchase_date: item.fecha_compra || item.purchase_date || '',
    warranty_expiry: item.garantia || item.garantía || item.warranty_expiry || '',
    notes: item.notas || item.observaciones || item.notes || '',
  };
}

// Extrae items de todos los PDFs (común a dry-run y real).
async function extractInputs(base44, file_urls) {
  const allInputs = [];
  const fileErrors = [];
  const fileStats = [];
  for (let i = 0; i < file_urls.length; i++) {
    const file_url = file_urls[i];
    const fileName = file_url.split('/').pop() || `archivo-${i + 1}`;
    try {
      const extractRes = await base44.integrations.Core.ExtractDataFromUploadedFile({ file_url, json_schema: ASSET_SCHEMA });
      const output = extractRes?.output;
      let items: any[] = [];
      if (Array.isArray(output)) items = output;
      else if (output && typeof output === 'object') items = output.activos || output.assets || output.items || [];
      const mapped = items.map(mapExtractedItem).filter(Boolean);
      fileStats.push({ fileName, extraidos: mapped.length });
      allInputs.push(...mapped);
    } catch (err) {
      fileErrors.push({ fileName, error: err.message || String(err) });
    }
  }
  return { allInputs, fileErrors, fileStats };
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    const roleErr = importRoleError(user);
    if (roleErr) return roleErr;
    const callerSector = resolveCallerSector(user);
    const sb = createScopedClient(base44, callerSector);

    const body = await req.json().catch(() => ({}));
    const { file_urls, auto_create_locations = true, dry_run = false, sede_id, inputs: bodyInputs } = body;
    const isBapro = callerSector === 'bapro';
    if (!file_urls || !Array.isArray(file_urls) || file_urls.length === 0) {
      return Response.json({ error: 'file_urls (array) requerido' }, { status: 400 });
    }
    if (file_urls.length > MAX_FILES) return Response.json({ error: `Máximo ${MAX_FILES} archivos por lote` }, { status: 400 });
    for (const url of file_urls) {
      if (typeof url !== 'string') return Response.json({ error: 'file_url inválido' }, { status: 400 });
      try { assertAllowedFileUrl(url); }
      catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
    }

    // Sede elegida (solo bapro): todas las filas van a esa sede.
    let sedeElegida = null;
    if (isBapro && typeof sede_id === 'string' && sede_id) {
      const edificios = await sb.entities.Edificio.list('-updated_date', 1000);
      sedeElegida = (edificios || []).find(e => e.id === sede_id);
      if (!sedeElegida) return Response.json({ error: 'sede_id no válido: la sede no existe en tu sector' }, { status: 400 });
    }

    let allInputs: any[] = [];
    let fileErrors: any[] = [];
    let fileStats: any[] = [];
    // Importación real con las filas de la vista previa: no se vuelve a extraer.
    const reusar = isBapro && !dry_run && Array.isArray(bodyInputs) && bodyInputs.length > 0;
    if (reusar) {
      if (bodyInputs.length > MAX_INPUTS) return Response.json({ error: `Máximo ${MAX_INPUTS} filas por importación` }, { status: 400 });
      allInputs = bodyInputs.map(mapExtractedItem).filter(Boolean);
    } else {
      ({ allInputs, fileErrors, fileStats } = await extractInputs(base44, file_urls));
    }
    if (allInputs.length === 0) {
      return Response.json({ error: 'No se pudieron extraer activos de los PDFs', fileErrors, fileStats, extracted: 0 }, { status: 400 });
    }
    if (sedeElegida) allInputs = allInputs.map(i => ({ ...i, sede: sedeElegida.nombre }));
    // Solo BAPRO: sinónimos de tipo (por tipo y, si no alcanza, por nombre).
    if (isBapro) allInputs = allInputs.map(i => ({ ...i, type: resolverTipoBapro(i.type, i.name) }));

    const sedeOpts = isBapro ? { defaultSede: 'Sede Central', sedeAliases: true, strictSede: true } : {};
    const result = await bulkImportAssets(sb, allInputs, { autoCreateLocations: auto_create_locations, dryRun: dry_run, ...sedeOpts });

    if (dry_run) {
      return Response.json({
        ok: true, sector: callerSector, tipo: 'pdf',
        files: file_urls.length, fileErrors, fileStats, extracted: allInputs.length,
        ...(isBapro ? { inputs: allInputs.slice(0, MAX_INPUTS), inputs_truncados: allInputs.length > MAX_INPUTS, sede_elegida: sedeElegida ? sedeElegida.nombre : null } : {}),
        ...result,
      });
    }

    // Persistir registro de importación
    let importacion_id = null;
    try {
      const reg = await sb.entities.ImportacionActivos.create({
        file_name: file_urls.map(u => u.split('/').pop()).join(', ').slice(0, 200),
        tipo: 'pdf',
        total_filas: result.total_filas,
        created_ids: result.created_ids,
        updated_ids: result.updated_ids,
        updated_snapshots: result.updated_snapshots,
        snapshot_completo: result.snapshot_completo,
        sedes_creadas_ids: result.sedes_creadas_ids,
        estado: 'ejecutada',
        created: result.created,
        updated: result.updated,
      });
      importacion_id = reg.id;
    } catch (e) {
      console.error('ImportacionActivos create failed:', e.message);
    }

    return Response.json({
      ok: true, sector: callerSector, tipo: 'pdf', importacion_id,
      files: file_urls.length, fileErrors, fileStats, extracted: allInputs.length,
      imported: result.created + result.updated,
      created: result.created, updated: result.updated, errors: result.errors,
      duplicados: result.duplicados, sedes_creadas: result.sedes_creadas,
      snapshot_completo: result.snapshot_completo,
      errorDetails: result.errorDetails.slice(0, 20),
      auto_create_locations,
    });
  } catch (err) {
    if (err instanceof SectorError) return Response.json({ error: err.message }, { status: err.status });
    console.error('importarActivosPDF error:', err);
    return Response.json({ error: `Error interno: ${err.message}` }, { status: 500 });
  }
}