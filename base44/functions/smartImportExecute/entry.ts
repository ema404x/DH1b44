import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ENTITY_DEFAULTS = {
  Client: { status: 'activo', type: 'empresa' },
  Employee: { status: 'activo', role: 'operario' },
  Material: { category: 'construccion', unit: 'unidad', stock: 0, min_stock: 0, unit_cost: 0 },
  Project: { status: 'pendiente', priority: 'media', type: 'mantenimiento_correctivo', progress: 0 },
  WorkOrder: { status: 'pendiente', priority: 'media', type: 'mantenimiento_correctivo' },
  Asset: { status: 'operativo', type: 'equipo_mecanico', criticality: 'media' },
  PrecarioMinisterio: { activo: true, pu_mat: 0, pu_mo: 0, coef_pase: 1.6504, coef_oferta: 1.38 },
  Quote: { status: 'borrador', tax_rate: 21, subtotal: 0, total: 0 },
  Invoice: { status: 'pendiente', tax_rate: 21, subtotal: 0, total: 0 },
};

function parseValue(value, field) {
  if (value === null || value === undefined || value === '') return undefined;

  // Numeric fields
  const numericFields = ['stock', 'min_stock', 'unit_cost', 'hourly_rate', 'estimated_budget', 'actual_cost',
    'progress', 'purchase_cost', 'pu_mat', 'pu_mo', 'coef_pase', 'coef_oferta', 'subtotal', 'total', 'tax_rate',
    'estimated_hours', 'row_count'];
  if (numericFields.includes(field)) {
    const num = parseFloat(String(value).replace(',', '.'));
    return isNaN(num) ? 0 : num;
  }

  return String(value).trim();
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { mapping } = await req.json();
  const sheets = (mapping.sheets || []).filter(s => s.target_entity && s.target_entity !== 'skip');

  if (sheets.length === 0) {
    return Response.json({ error: 'No hay hojas para importar' }, { status: 400 });
  }

  // Extract full data from file using base44 integration
  const fileData = await base44.integrations.Core.ExtractDataFromUploadedFile({
    file_url: mapping.file_url || '',
    json_schema: {
      type: 'object',
      properties: {
        sheets: { type: 'array', items: { type: 'object', additionalProperties: true } }
      }
    }
  });

  const results = [];

  for (const sheet of sheets) {
    const entityKey = sheet.target_entity;
    const fieldMapping = sheet.field_mapping || {};
    const defaults = ENTITY_DEFAULTS[entityKey] || {};

    // Get data from the raw_data passed or re-read
    // We'll build records from sample or use the full data from the extraction
    const errorDetails = [];
    let imported = 0;

    // Use full extraction for each sheet
    let sheetRows = [];
    if (fileData && fileData.output) {
      const raw = Array.isArray(fileData.output) ? fileData.output : [fileData.output];
      sheetRows = raw;
    }

    // If extraction didn't work well, build from the sheet data in mapping
    if (sheetRows.length === 0 && sheet.sample_data) {
      sheetRows = [sheet.sample_data];
    }

    // Determine columns from field_mapping
    const columns = Object.entries(fieldMapping).filter(([, v]) => v && v.trim());

    for (const row of sheetRows) {
      const record = { ...defaults };
      let hasData = false;

      for (const [colName, fieldName] of columns) {
        const rawVal = row[colName];
        if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
          const parsed = parseValue(rawVal, fieldName);
          if (parsed !== undefined) {
            record[fieldName] = parsed;
            hasData = true;
          }
        }
      }

      if (!hasData) continue;

      try {
        await base44.entities[entityKey].create(record);
        imported++;
      } catch (err) {
        errorDetails.push(`Fila: ${JSON.stringify(record).slice(0, 80)} — ${err.message}`);
      }
    }

    const entityLabels = {
      Client: 'Clientes', Employee: 'Empleados', Material: 'Materiales',
      Project: 'Proyectos', WorkOrder: 'Órdenes de Trabajo', Asset: 'Activos',
      PrecarioMinisterio: 'Preciario Ministerial', Quote: 'Presupuestos', Invoice: 'Facturas'
    };

    results.push({
      entity: entityLabels[entityKey] || entityKey,
      entity_key: entityKey,
      imported,
      errors: errorDetails.length,
      error_details: errorDetails,
    });
  }

  return Response.json({ results });
});