import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { createScopedClient, resolveCallerSector, SectorError } from '../../shared/sectorGuard.ts';
import { assertAllowedFileUrl } from '../../shared/excelImport.ts';
import { bulkImportAssets } from '../../shared/assetBulkImport.ts';

// Importer masivo de Activos desde uno o varios PDFs.
//
// Flujo:
//   1. El frontend sube cada PDF con UploadFile → array de file_urls.
//   2. Esta función recorre cada PDF y extrae datos estructurados con
//      ExtractDataFromUploadedFile (soporta PDF nativamente), usando un
//      schema que mapea a los campos del Asset.
//   3. Los items extraídos se mapean a inputs crudos y se pasan al helper
//      compartido bulkImportAssets (mismo que importarActivosBapro), que
//      resuelve/crea sedes, dedupea por código y bulk-crea/actualiza.
//
// Limitado a admin/gerente. Sector-aislado vía sectorGuard + bulkImportAssets.

const MAX_FILES = 20;

// Schema de extracción. ExtractDataFromUploadedFile devuelve list|dict;
// pedimos un array de objetos de activo y toleramos también un wrapper
// { activos: [...] } por si el extractor envuelve la lista.
const ASSET_SCHEMA = {
  type: 'object',
  properties: {
    activos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nombre: { type: 'string', description: 'Nombre o descripción del activo' },
          codigo: { type: 'string', description: 'Código interno del activo' },
          tipo: { type: 'string', description: 'Tipo: eléctrico, mecánico, HVAC, sanitario, estructura, vehículo, herramienta, informático, mobiliario, seguridad u otro' },
          marca: { type: 'string' },
          modelo: { type: 'string' },
          serie: { type: 'string', description: 'Número de serie' },
          sede: { type: 'string', description: 'Sede, edificio, establecimiento o ubicación donde se encuentra el activo' },
          area: { type: 'string', description: 'Área, zona o departamento dentro de la sede' },
          jefe_sitio: { type: 'string', description: 'Responsable / jefe de sitio del activo' },
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

// Mapea un item extraído (keys en español, con fallbacks a inglés) al input
// crudo que consume bulkImportAssets.
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
    criticality: item.criticidad || item.critica || item.criticity || '',
    location: item.ubicacion || item.ubicación || item.location || '',
    purchase_cost: item.costo || item.valor || 0,
    purchase_date: item.fecha_compra || item.purchase_date || '',
    warranty_expiry: item.garantia || item.garantía || item.warranty_expiry || '',
    notes: item.notas || item.observaciones || '',
  };
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'gerente') {
      return Response.json({ error: 'Forbidden: solo admin/gerente' }, { status: 403 });
    }

    const callerSector = resolveCallerSector(user);
    const sb = createScopedClient(base44, callerSector);

    const body = await req.json().catch(() => ({}));
    const { file_urls, auto_create_locations = true } = body;
    if (!file_urls || !Array.isArray(file_urls) || file_urls.length === 0) {
      return Response.json({ error: 'file_urls (array) requerido' }, { status: 400 });
    }
    if (file_urls.length > MAX_FILES) {
      return Response.json({ error: `Máximo ${MAX_FILES} archivos por lote` }, { status: 400 });
    }
    for (const url of file_urls) {
      if (typeof url !== 'string') {
        return Response.json({ error: 'file_url inválido' }, { status: 400 });
      }
      try { assertAllowedFileUrl(url); }
      catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
    }

    // ── Extracción por PDF ──────────────────────────────────────────────
    const allInputs = [];
    const fileErrors = [];
    const fileStats = [];

    for (let i = 0; i < file_urls.length; i++) {
      const file_url = file_urls[i];
      const fileName = file_url.split('/').pop() || `archivo-${i + 1}`;
      try {
        const extractRes = await base44.integrations.Core.ExtractDataFromUploadedFile({
          file_url,
          json_schema: ASSET_SCHEMA,
        });
        // ExtractDataFromUploadedFile → { status, details, output }
        // output puede ser list[dict] o dict con { activos: [...] }
        const output = extractRes?.output;
        let items: any[] = [];
        if (Array.isArray(output)) {
          items = output;
        } else if (output && typeof output === 'object') {
          items = output.activos || output.assets || output.items || [];
        }
        const mapped = items.map(mapExtractedItem).filter(Boolean);
        fileStats.push({ fileName, extraidos: mapped.length });
        allInputs.push(...mapped);
      } catch (err) {
        fileErrors.push({ fileName, error: err.message || String(err) });
      }
    }

    if (allInputs.length === 0) {
      return Response.json({
        error: 'No se pudieron extraer activos de los PDFs',
        fileErrors,
        fileStats,
        extracted: 0,
      }, { status: 400 });
    }

    // ── Bulk import con el helper compartido ───────────────────────────
    const result = await bulkImportAssets(sb, allInputs, { autoCreateLocations: auto_create_locations });

    return Response.json({
      ok: true,
      sector: callerSector,
      files: file_urls.length,
      files_ok: fileStats.length,
      file_errors: fileErrors.length,
      fileErrors,
      fileStats,
      extracted: allInputs.length,
      imported: result.created + result.updated,
      created: result.created,
      updated: result.updated,
      errors: result.errors,
      duplicados: result.duplicados,
      errorDetails: result.errorDetails.slice(0, 20),
      sedes_creadas: result.sedes_creadas,
      sedes_creadas_detalle: result.sedes_creadas_detalle,
      sedes_totales_unicas: result.sedes_totales_unicas,
      sedes_preexistentes: result.sedes_preexistentes,
      parseErrors: result.parseErrors.slice(0, 20),
      auto_create_locations,
    });
  } catch (err) {
    if (err instanceof SectorError) return Response.json({ error: err.message }, { status: err.status });
    console.error('importarActivosPDF error:', err);
    return Response.json({ error: `Error interno: ${err.message}` }, { status: 500 });
  }
}