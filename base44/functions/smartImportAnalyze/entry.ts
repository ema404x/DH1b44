import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Helper functions
    function detectWorkOrder(sheetName, headers) {
      const headerLower = headers.join(' ').toLowerCase();
      const patterns = ['orden', 'tarea', 'ubicación', 'establecimiento', 'inspector', 'status', 'pendiente'];
      const matches = patterns.filter(p => headerLower.includes(p)).length;
      return matches >= 3 ? 0.95 : (matches >= 2 ? 0.70 : 0);
    }

    function detectEmployee(headers) {
      const headerLower = headers.join(' ').toLowerCase();
      const patterns = ['nombre', 'email', 'teléfono', 'rol', 'especialidad'];
      const matches = patterns.filter(p => headerLower.includes(p)).length;
      return matches >= 3 ? 0.85 : (matches >= 2 ? 0.60 : 0);
    }

    function detectClient(headers) {
      const headerLower = headers.join(' ').toLowerCase();
      const patterns = ['empresa', 'proveedor', 'rubro', 'contacto'];
      const matches = patterns.filter(p => headerLower.includes(p)).length;
      return matches >= 2 ? 0.80 : (matches >= 1 ? 0.50 : 0);
    }

    function detectInformePlaneacion(headers) {
      const headerLower = headers.join(' ').toLowerCase();
      const patterns = ['mes', 'descripción', 'proveedor', 'contacto', 'estado'];
      const matches = patterns.filter(p => headerLower.includes(p)).length;
      return matches >= 3 ? 0.90 : (matches >= 2 ? 0.65 : 0);
    }

    function preScoreSheet(sheetName, headers) {
      return {
        WorkOrder: detectWorkOrder(sheetName, headers),
        Employee: detectEmployee(headers),
        Client: detectClient(headers),
        InformePlaneacion: detectInformePlaneacion(headers),
      };
    }

    function detectPlanillaModel(sheetName, headers) {
      const headerLower = headers.join('|').toLowerCase();
      const hasInspector = headerLower.includes('inspector');
      const hasNroOrden = headerLower.includes('n°') || headerLower.includes('nro') || headerLower.includes('numero');
      const hasTareas = headerLower.includes('tarea');

      if (hasInspector && hasNroOrden && hasTareas) return { model: '8A', pattern: 'Por Inspector' };
      if (!hasInspector && hasNroOrden && hasTareas) return { model: '10A', pattern: 'Sin Inspector' };
      if (headerLower.includes('dirección') || headerLower.includes('jefe')) return { model: '8B', pattern: 'Pivotado' };
      return null;
    }

    // Entity schemas
    const ENTITY_SCHEMAS = {
      WorkOrder: {
        description: 'Órdenes de trabajo y pendientes SAP',
        fields: ['code', 'title', 'description', 'location', 'assigned_name', 'status', 'type', 'priority', 'scheduled_date', 'created_date'],
        key_fields: ['code', 'title', 'location'],
        key_patterns: ['N° DE ORDEN', 'N° ORDEN', 'NUMERO ORDEN', 'TAREAS A REALIZAR', 'DESCRIPCION', 'UBICACIÓN', 'ESTABLECIMIENTO', 'INSPECTOR', 'STATUS'],
        aliases: { 'Nro Orden': 'code', 'Tarea': 'title', 'Ubicac': 'location' },
      },
      InformePlaneacion: {
        description: 'Informes de planificación y procurement',
        fields: ['mes', 'descripcion', 'proveedor_2025', 'contacto_2025', 'proveedor_invitado_2026', 'estado_contacto', 'proveedor_contratado_2026', 'estado_actual'],
        key_fields: ['descripcion', 'estado_contacto'],
        key_patterns: ['MES', 'DESCRIPCION', 'PROVEEDOR', 'CONTACTO', 'ESTADO', 'INVITADO'],
        aliases: { 'Desc': 'descripcion', 'Prov': 'proveedor_2025' },
      },
      Employee: {
        description: 'Empleados y técnicos',
        fields: ['full_name', 'email', 'phone', 'role', 'specialty', 'status'],
        key_fields: ['full_name', 'email'],
        key_patterns: ['NOMBRE', 'EMAIL', 'TELÉFONO', 'ESPECIALIDAD', 'ROL', 'ESTADO'],
        aliases: { 'Nom': 'full_name', 'Mail': 'email' },
      },
      Client: {
        description: 'Clientes y proveedores',
        fields: ['name', 'email', 'phone', 'rubro', 'contact_name', 'cuit'],
        key_fields: ['name'],
        key_patterns: ['NOMBRE', 'EMPRESA', 'PROVEEDOR', 'RUBRO', 'EMAIL', 'TELÉFONO'],
        aliases: { 'Razón Social': 'name', 'Contacto': 'contact_name' },
      },
    };

    let raw_data = null;
    const body = await req.json();

    // Si viene raw_data desde frontend (caso manual), usar eso
    if (body.raw_data && Object.keys(body.raw_data).length > 0) {
      raw_data = body.raw_data;
    }
    // Si viene file_urls, descargar y parsear
    else if (body.file_urls && Array.isArray(body.file_urls)) {
      const { default: XLSX } = await import('npm:xlsx@0.18.5');
      raw_data = {};

      for (const url of body.file_urls) {
        const res = await fetch(url);
        const buffer = await res.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });

        wb.SheetNames.forEach(sheetName => {
          const ws = wb.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          raw_data[sheetName] = rows;
        });
      }
    }

    if (!raw_data || Object.keys(raw_data).length === 0) {
      return Response.json({ error: 'No se encontraron datos en el archivo' }, { status: 400 });
    }

    // Build enriched sheet info with pre-scores
    const sheetsInfo = Object.entries(raw_data).map(([sheetName, rows]) => {
      // Los headers están siempre en la fila 0
      const firstRowRaw = rows[0] || [];
      const headers = firstRowRaw.map(h => String(h || '').trim());
      const validHeaders = headers.filter(h => h.length > 0);
      const actualHeaders = validHeaders.length > 0 ? validHeaders : headers;

      if (!actualHeaders || actualHeaders.length === 0) {
        return {
          sheetName,
          headers: [],
          sample: {},
          rowCount: Math.max(0, rows.length - 1),
          pre_suggested_entity: null,
          pre_score: 0,
          planilla_model: null,
          planilla_pattern: null,
        };
      }

      const sampleRows = rows.slice(1, 4);
      const sample = {};
      actualHeaders.forEach((h, i) => {
        if (h) sample[h] = sampleRows.map(r => r[i]).filter(v => v !== '' && v !== null && v !== undefined).join(', ');
      });

      const preScores = preScoreSheet(sheetName, actualHeaders) || {};
      const topEntity = Object.entries(preScores).length > 0 ? Object.entries(preScores).sort(([, a], [, b]) => b - a)[0] : null;

      // Detectar modelo de planilla (8A, 8B, 10A)
      const planillaModel = detectPlanillaModel(sheetName, actualHeaders);

      return {
        sheetName,
        headers: actualHeaders,
        sample,
        rowCount: Math.max(0, rows.length - 1),
        pre_suggested_entity: topEntity && topEntity[1] > 0 ? topEntity[0] : null,
        pre_score: topEntity ? topEntity[1] : 0,
        planilla_model: planillaModel?.model || null,
        planilla_pattern: planillaModel?.pattern || null,
      };
    });

    // Build a concise schema summary with patterns for the LLM
    const schemaSummary = Object.entries(ENTITY_SCHEMAS).map(([entity, schema]) => ({
      entity,
      description: schema.description,
      fields: schema.fields,
      key_fields: schema.key_fields,
      common_header_patterns: schema.key_patterns,
      name_aliases: schema.aliases,
    }));

    const prompt = `Sos un INGENIERO SENIOR ANALISTA especializado en gestión de órdenes de trabajo y mantenimiento edilicio.

TAREA: Analiza las hojas de Excel y:
1. Detecta CADA PENDIENTE/ORDEN como un registro independiente
2. Identifica qué entidad representa cada hoja
3. Mapea cada columna al campo correcto del sistema
4. Reconoce los MODELOS DE PLANILLA por comuna (8A, 8B, 10A)

ENTIDADES DEL SISTEMA (con patrones de columnas clave):
${JSON.stringify(schemaSummary, null, 2)}

HOJAS A ANALIZAR (pre-análisis automático):
${JSON.stringify(sheetsInfo, null, 2)}

REGLAS DE DETECCIÓN POR MODELO:
- **8A**: Hojas POR INSPECTOR. Estructura: INSPECTOR | UBICACIÓN | ESTABLECIMIENTO | TAREAS A REALIZAR | N° DE ORDEN | FECHA INICIO | FECHA LIMITE | CLASE DE ORDEN | STATUS
  → CADA ROW = 1 pendiente/orden de trabajo
  
- **8B**: Formato PIVOTADO. Estructura: Columnas = nombres de direcciones/jefes. Datos anidados.
  → Requiere PIVOT/desagregación: cada dirección dentro de una celda = múltiples pendientes
  
- **10A**: SIN INSPECTOR. Estructura: UBICACIÓN | ESTABLECIMIENTO | TAREAS A REALIZAR | N° DE ORDEN | FECHA INICIO | FECHA LIMITE | STATUS
  → Similar a 8A pero sin columna INSPECTOR
  
DETECTA EL MODELO: Analiza headers y estructura. Si ves "INSPECTOR" en headers → 8A. Si ves direcciones dinámicas como headers y NO ves "INSPECTOR" → 8B. Si ves N° DE ORDEN pero NO INSPECTOR → 10A.

ANÁLISIS DETALLADO PARA CADA HOJA:
1. **Identifica el modelo** (8A, 8B o 10A) analizando:
   - Headers presentes (INSPECTOR? N° DE ORDEN? TAREAS?)
   - Estructura de datos (¿cada row es 1 pendiente o hay datos anidados?)
   - Nombres de columnas (¿son direcciones/ubicaciones dinámicas?)

2. **Para WorkOrder (Pendientes/Órdenes)**:
   - code → "N° DE ORDEN" o equivalente
   - title → "TAREAS A REALIZAR" o "descripcion"
   - location → "UBICACIÓN" o "ESTABLECIMIENTO"
   - assigned_name → "INSPECTOR" (si existe, para 8A)
   - status → "STATUS" (mapear AEJE→pendiente, DESAPROBADO→cancelada, etc.)
   - scheduled_date → "FECHA INICIO"
   - description → concatenar TAREAS + detalles

3. **Para InformePlaneacion**:
   - mes → "MES"
   - descripcion → "DESCRIPCIÓN" o "TAREAS A REALIZAR"
   - proveedor_2025 → "PROVEEDOR" o "PROVEEDOR 2025"
   - contacto_2025 → "CONTACTO" o similar
   - estado_contacto → "ESTADO" o "ESTADO CONTACTO"

4. **CRÍTICO PARA 8B**: Si es formato pivotado, INDICA en output:
   - planilla_model: "8B"
   - needs_unpivot: true
   - pivot_columns: [lista de columnas que contienen direcciones]

MAPEO ESPECÍFICO PARA INFORMEPLANEACION:
- MES / PERIODO → mes
- DESCRIPCIÓN / DESCRIPCION / TAREAS → descripcion
- PROVEEDOR / PROVEEDOR 2025 → proveedor_2025
- CONTACTO / CONTACTO 2025 → contacto_2025
- PROVEEDOR INVITADO 2026 → proveedor_invitado_2026
- ESTADO / ESTADO CONTACTO → estado_contacto
- PROVEEDOR CONTRATADO 2026 → proveedor_contratado_2026
- ESTADO ACTUAL / ESTADO EJECUCIÓN → estado_actual

CALIBRACIÓN DE CONFIANZA:
- 0.98+: WorkOrder o InformePlaneacion con modelo claro (tiene campos clave mapeados)
- 0.90-0.97: Estructura clara pero algunos campos faltantes
- 0.70-0.89: Hojas auxiliares → target_entity: "skip"
- <0.70: Dudoso

Responde con JSON. Para cada hoja:
- sheet_name, target_entity, confidence
- detected_planilla_model (8A/8B/10A si aplica)
- detected_comuna (8A/8B/10A si aplica)
- field_mapping (mapeo de columnas)
- sample_data`;

    const response = await base44.integrations.Core.InvokeLLM({
      prompt,
      model: 'claude_sonnet_4_6',
    });

    // InvokeLLM devuelve directamente un string de texto
    const result = response;
    
    console.log('Raw LLM response:', typeof response);
    console.log('Raw LLM result:', typeof result, String(result).substring(0, 300));

    let sheetsArray = [];
    
    // Intentar parsear si es texto JSON
    if (typeof result === 'string') {
      try {
        const parsed = JSON.parse(result);
        sheetsArray = parsed.sheets || parsed || [];
      } catch (e) {
        console.error('JSON parse error:', e.message);
      }
    } else if (Array.isArray(result)) {
      sheetsArray = result;
    } else if (result && typeof result === 'object') {
      sheetsArray = result.sheets || [];
    }

    // Asegurar que sea un array
    if (!Array.isArray(sheetsArray)) {
      sheetsArray = [];
    }

    // Procesar y enriquecer con datos reales
    const processedSheets = sheetsArray.map(sheet => {
      const rawRows = raw_data[sheet.sheet_name];
      const sheetInfo = sheetsInfo.find(s => s.sheetName === sheet.sheet_name);
      const model = sheet.detected_planilla_model || sheetInfo?.planilla_model;

      let actualRowCount = rawRows ? Math.max(0, rawRows.length - 1) : (sheet.row_count || 0);

      // Para 8B pivotado: contar celdas con datos
      if (model === '8B' && rawRows && rawRows.length > 1) {
        let cellCount = 0;
        const headers = (rawRows[0] || []).map(h => String(h || '').trim());

        rawRows.slice(1).forEach(row => {
          headers.forEach((header, colIdx) => {
            const cellValue = row[colIdx];
            if (cellValue !== null && cellValue !== undefined && cellValue !== '' && cellValue !== '#N/A') {
              const items = String(cellValue).split(/[\n,;]/).filter(v => v.trim());
              cellCount += items.length;
            }
          });
        });

        actualRowCount = cellCount > 0 ? cellCount : actualRowCount;
      }

      return {
        ...sheet,
        row_count: actualRowCount,
        detected_planilla_model: model || null,
      };
    });

    return Response.json({ sheets: processedSheets });
  } catch (err) {
    console.error('Error en smartImportAnalyze:', err);
    return Response.json({ error: String(err), sheets: [] }, { status: 500 });
  }
});