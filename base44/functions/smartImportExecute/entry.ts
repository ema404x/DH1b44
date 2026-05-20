import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ENTITY_DEFAULTS = {
   InformePlaneacion: { estado_contacto: 'PENDIENTE' },
   Client: { status: 'activo', type: 'empresa' },
   Employee: { status: 'activo', role: 'operario' },
   Material: { category: 'construccion', unit: 'unidad', stock: 0, min_stock: 0, unit_cost: 0 },
   Project: { status: 'pendiente', priority: 'media', type: 'mantenimiento_correctivo', progress: 0 },
   WorkOrder: { status: 'pendiente', priority: 'media', type: 'mantenimiento_correctivo' },
   Asset: { status: 'operativo', type: 'equipo_mecanico', criticality: 'media' },
   PrecarioMinisterio: { activo: true, pu_mat: 0, pu_mo: 0, coef_pase: 1.6504, coef_oferta: 1.38 },
   Quote: { status: 'borrador', tax_rate: 21, subtotal: 0, total: 0 },
   Invoice: { status: 'pendiente', tax_rate: 21, subtotal: 0, total: 0 },
   LocationData: { estado: 'activo', m2: 0 },
 };

 const ENTITY_LABELS = {
   InformePlaneacion: 'Informes de Planificación', Client: 'Clientes', Employee: 'Empleados', Material: 'Materiales',
   Project: 'Proyectos', WorkOrder: 'Órdenes de Trabajo', Asset: 'Activos',
   PrecarioMinisterio: 'Preciario Ministerial', Quote: 'Presupuestos', Invoice: 'Facturas',
   LocationData: 'Ubicaciones Técnicas',
 };

function parseValue(value, field) {
  if (value === null || value === undefined || value === '') return undefined;
  
  // Convert non-string values to string first
  const stringVal = String(value).trim();
  if (!stringVal) return undefined;

  const numericFields = ['stock', 'min_stock', 'unit_cost', 'hourly_rate', 'estimated_budget', 'actual_cost',
    'progress', 'purchase_cost', 'pu_mat', 'pu_mo', 'coef_pase', 'coef_oferta', 'subtotal', 'total', 'tax_rate',
    'estimated_hours', 'm2'];
  if (numericFields.includes(field)) {
    const num = parseFloat(stringVal.replace(',', '.').replace(/[^0-9.-]/g, ''));
    return isNaN(num) ? 0 : num;
  }

  const dateFields = ['start_date', 'end_date', 'hire_date', 'purchase_date', 'issue_date', 'due_date', 'valid_until', 'scheduled_date', 'completed_date', 'fecha_emision_sap', 'fecha_limite'];
  if (dateFields.includes(field)) {
    // Try to parse Excel serial date numbers
    if (/^\d{4,5}$/.test(stringVal)) {
      const excelEpoch = new Date(1899, 11, 30);
      const d = new Date(excelEpoch.getTime() + parseInt(stringVal) * 86400000);
      return d.toISOString().split('T')[0];
    }
    // Try standard date strings (DD/MM/YYYY, YYYY-MM-DD, etc.)
    const d = new Date(stringVal);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    return stringVal;
  }

  return stringVal;
}

const BATCH_SIZE = 50;

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

    const sheetRows = raw_data[sheet.sheet_name];
    if (!sheetRows || sheetRows.length < 2) {
      results.push({
        entity: ENTITY_LABELS[entityKey] || entityKey,
        entity_key: entityKey,
        imported: 0,
        errors: 0,
        error_details: ['No se encontraron filas para esta hoja'],
      });
      continue;
    }

    // Find header row by skipping empty rows at the beginning
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(sheetRows.length, 5); i++) {
      const row = sheetRows[i] || [];
      const nonEmptyCells = row.filter(cell => cell && String(cell).trim());
      if (nonEmptyCells.length > 0) {
        headerRowIdx = i;
        break;
      }
    }

    const headers = sheetRows[headerRowIdx].map(h => String(h || '').trim());
    const dataStartRow = headerRowIdx + 1;
    const dataRows = sheetRows.slice(dataStartRow);

    const colIndex = {};
    headers.forEach((h, i) => { colIndex[h] = i; });

    const activeMappings = Object.entries(fieldMapping).filter(([, v]) => v && typeof v === 'string' && v.trim());
    
    if (activeMappings.length === 0) {
      results.push({
        entity: ENTITY_LABELS[entityKey] || entityKey,
        entity_key: entityKey,
        imported: 0,
        errors: 0,
        error_details: ['No hay mappings activos de campos'],
      });
      continue;
    }

    // Build all valid records first
    const records = [];
    console.log(`[IMPORT] Sheet: ${sheet.sheet_name}, Entity: ${entityKey}, Headers: ${headers.join(' | ')}`);
    console.log(`[IMPORT] Active mappings: ${activeMappings.length}, Data rows: ${dataRows.length}`);

    for (const row of dataRows) {
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

      if (hasData) records.push(record);
    }
    console.log(`[IMPORT] Built ${records.length} valid records from ${dataRows.length} data rows`);

    // Insert in batches using bulkCreate
     for (let i = 0; i < records.length; i += BATCH_SIZE) {
       const batch = records.slice(i, i + BATCH_SIZE);
       try {
         console.log(`[IMPORT] Attempting bulkCreate for ${batch.length} records`);
         await base44.asServiceRole.entities[entityKey].bulkCreate(batch);
         imported += batch.length;
         console.log(`[IMPORT] Successfully imported ${batch.length} records`);
       } catch (batchErr) {
         console.log(`[IMPORT] Bulk create failed, trying one by one: ${batchErr.message}`);
         // If bulk fails, try one by one to get individual errors
         for (const record of batch) {
           try {
             await base44.asServiceRole.entities[entityKey].create(record);
             imported++;
           } catch (err) {
             const recordSummary = [
               record.name || record.full_name || record.title || record.codigo || record.descripcion,
               record.code || record.dni || record.email || ''
             ].filter(Boolean).join(' - ');

             const errorMsg = err.message || String(err);
             const shortError = errorMsg.length > 120 ? errorMsg.substring(0, 120) + '...' : errorMsg;

             errorDetails.push(`${recordSummary || 'Registro desconocido'}: ${shortError}`);
             console.log(`[IMPORT] Error importing ${recordSummary}: ${shortError}`);
           }
         }
       }
     }

    results.push({
      entity: ENTITY_LABELS[entityKey] || entityKey,
      entity_key: entityKey,
      imported,
      errors: errorDetails.length,
      error_details: errorDetails,
    });
  }

  return Response.json({ results });
});