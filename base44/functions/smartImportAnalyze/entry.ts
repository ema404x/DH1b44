import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ENTITY_SCHEMAS = {
  Client: ['name', 'type', 'cuit', 'contact_name', 'email', 'phone', 'address', 'city', 'status', 'notes'],
  Employee: ['full_name', 'dni', 'role', 'specialty', 'status', 'phone', 'email', 'hire_date', 'hourly_rate', 'notes'],
  Material: ['name', 'code', 'category', 'unit', 'stock', 'min_stock', 'unit_cost', 'supplier', 'location', 'notes'],
  Project: ['name', 'code', 'client_name', 'type', 'status', 'priority', 'description', 'address', 'start_date', 'end_date', 'estimated_budget', 'progress', 'notes'],
  WorkOrder: ['title', 'code', 'project_name', 'asset_name', 'location', 'type', 'status', 'priority', 'description', 'assigned_name', 'scheduled_date', 'estimated_hours', 'notes'],
  Asset: ['name', 'code', 'type', 'brand', 'model', 'serial_number', 'location', 'project_name', 'status', 'criticality', 'purchase_date', 'purchase_cost', 'notes'],
  PrecarioMinisterio: ['codigo', 'descripcion', 'unidad', 'categoria', 'subcategoria', 'comuna', 'pu_mat', 'pu_mo', 'coef_pase', 'coef_oferta'],
  Quote: ['title', 'client_name', 'description', 'status', 'subtotal', 'tax_rate', 'total', 'valid_until', 'notes'],
  Invoice: ['client_name', 'project_name', 'status', 'subtotal', 'tax_rate', 'total', 'issue_date', 'due_date', 'notes'],
};

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { file_url, raw_data } = await req.json();

  if (!raw_data || Object.keys(raw_data).length === 0) {
    return Response.json({ error: 'No se encontraron datos en el archivo' }, { status: 400 });
  }

  // Build prompt with sheet headers and sample data
  const sheetsInfo = Object.entries(raw_data).map(([sheetName, rows]) => {
    const headers = rows[0] || [];
    const sampleRows = rows.slice(1, 4);
    const sample = {};
    headers.forEach((h, i) => {
      sample[h] = sampleRows.map(r => r[i]).filter(Boolean).join(', ');
    });
    return { sheetName, headers, sample, rowCount: Math.max(0, rows.length - 1) };
  });

  const prompt = `Eres un experto en importación de datos para un sistema de gestión de construcción y mantenimiento.
Analiza las siguientes hojas de un archivo Excel/CSV y determina:
1. Qué entidad del sistema corresponde a cada hoja
2. Cómo mapear cada columna al campo correcto del sistema

Entidades disponibles y sus campos:
${JSON.stringify(ENTITY_SCHEMAS, null, 2)}

Hojas del archivo:
${JSON.stringify(sheetsInfo, null, 2)}

Responde en JSON con esta estructura exacta:
{
  "sheets": [
    {
      "sheet_name": "nombre de la hoja",
      "target_entity": "nombre de la entidad (Client, Employee, Material, Project, WorkOrder, Asset, PrecarioMinisterio, Quote, Invoice) o 'skip' si no corresponde",
      "confidence": 0.0 a 1.0,
      "row_count": número de filas de datos,
      "field_mapping": {
        "nombre_columna_original": "nombre_campo_sistema o vacío si ignorar"
      },
      "sample_data": {
        "nombre_columna_original": "valor de ejemplo"
      }
    }
  ]
}

Reglas:
- Usa coincidencia semántica inteligente (ej: "Nombre Empresa" → "name", "Fecha Ingreso" → "hire_date")
- Si una columna no corresponde a ningún campo, déjala vacía
- Si la hoja no corresponde a ninguna entidad, usa "skip"
- confidence: 0.9+ si estás muy seguro, 0.6-0.9 si probablemente correcto, <0.6 si dudoso`;

  const result = await base44.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: 'object',
      properties: {
        sheets: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              sheet_name: { type: 'string' },
              target_entity: { type: 'string' },
              confidence: { type: 'number' },
              row_count: { type: 'number' },
              field_mapping: { type: 'object', additionalProperties: { type: 'string' } },
              sample_data: { type: 'object', additionalProperties: { type: 'string' } },
            }
          }
        }
      }
    }
  });

  return Response.json(result);
});