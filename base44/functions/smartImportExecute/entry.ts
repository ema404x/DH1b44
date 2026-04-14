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

  const numericFields = ['stock', 'min_stock', 'unit_cost', 'hourly_rate', 'estimated_budget', 'actual_cost',
    'progress', 'purchase_cost', 'pu_mat', 'pu_mo', 'coef_pase', 'coef_oferta', 'subtotal', 'total', 'tax_rate',
    'estimated_hours'];
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

  const { mapping, raw_data } = await req.json();
  const sheets = (mapping.sheets || []).filter(s => s.target_entity && s.target_entity !== 'skip');

  if (sheets.length === 0) {
    return Response.json({ error: 'No hay hojas para importar' }, { status: 400 });
  }

  if (!raw_data || Object.keys(raw_data).length === 0) {
    return Response.json({ error: 'No se encontraron datos para importar' }, { status: 400 });
  }

  const results = [];

  for (const sheet of sheets) {
    const entityKey = sheet.target_entity;
    const fieldMapping = sheet.field_mapping || {};
    const defaults = ENTITY_DEFAULTS[entityKey] || {};
    const errorDetails = [];
    let imported = 0;

    // Get rows for this sheet from raw_data. raw_data format: { sheetName: [[header, ...], [val, ...], ...] }
    const sheetRows = raw_data[sheet.sheet_name];
    if (!sheetRows || sheetRows.length < 2) {
      results.push({
        entity: entityKey,
        entity_key: entityKey,
        imported: 0,
        errors: 0,
        error_details: ['No se encontraron filas para esta hoja'],
      });
      continue;
    }

    // First row is headers
    const headers = sheetRows[0].map(h => String(h || '').trim());
    const dataRows = sheetRows.slice(1);

    // Build column index: header name -> column index
    const colIndex = {};
    headers.forEach((h, i) => { colIndex[h] = i; });

    // Active mappings: only columns that map to a field
    const activeMappings = Object.entries(fieldMapping).filter(([, v]) => v && v.trim());

    for (const row of dataRows) {
      // Skip completely empty rows
      if (row.every(cell => cell === null || cell === undefined || cell === '')) continue;

      const record = { ...defaults };
      let hasData = false;

      for (const [colName, fieldName] of activeMappings) {
        const colIdx = colIndex[colName];
        if (colIdx === undefined) continue;
        const rawVal = row[colIdx];
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
        errorDetails.push(`Fila: ${JSON.stringify(record).slice(0, 100)} — ${err.message}`);
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