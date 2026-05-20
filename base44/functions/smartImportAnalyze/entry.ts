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
      // Skip empty rows at the beginning
      let headerRowIdx = 0;
      for (let i = 0; i < Math.min(rows.length, 5); i++) {
        const row = rows[i] || [];
        const nonEmptyCells = row.filter(cell => cell && String(cell).trim());
        if (nonEmptyCells.length > 0) {
          headerRowIdx = i;
          break;
        }
      }

      const firstRowRaw = rows[headerRowIdx] || [];
      const headers = firstRowRaw.map(h => String(h || '').trim());
      const validHeaders = headers.filter(h => h.length > 0);
      const actualHeaders = validHeaders.length > 0 ? validHeaders : headers;

      if (!actualHeaders || actualHeaders.length === 0) {
        return {
          sheetName,
          headers: [],
          sample: {},
          rowCount: Math.max(0, rows.length - headerRowIdx - 1),
          pre_suggested_entity: null,
          pre_score: 0,
          planilla_model: null,
          planilla_pattern: null,
        };
      }

      const sampleRows = rows.slice(headerRowIdx + 1, headerRowIdx + 4);
      const sample = {};
      actualHeaders.forEach((h, i) => {
        if (h) sample[h] = sampleRows.map(r => r[i]).filter(v => v !== '' && v !== null && v !== undefined).join(', ');
      });

      const preScores = preScoreSheet(sheetName, actualHeaders) || {};
      const topEntity = Object.entries(preScores).length > 0 ? Object.entries(preScores).sort(([, a], [, b]) => b - a)[0] : null;

      // Detectar modelo de planilla (8A, 8B, 10A)
      const planillaModel = detectPlanillaModel(sheetName, actualHeaders);

      // Debug: log detected entity
      const headerStr = actualHeaders.slice(0, 5).join(' | ');
      console.log(`[SHEET] ${sheetName}: headers="${headerStr}..." | detected=${topEntity?.[0] || 'none'} | score=${topEntity?.[1] || 0} | rows=${Math.max(0, rows.length - headerRowIdx - 1)}`);

      return {
        sheetName,
        headers: actualHeaders,
        sample,
        rowCount: Math.max(0, rows.length - headerRowIdx - 1),
        pre_suggested_entity: topEntity && topEntity[1] > 0 ? topEntity[0] : null,
        pre_score: topEntity ? topEntity[1] : 0,
        planilla_model: planillaModel?.model || null,
        planilla_pattern: planillaModel?.pattern || null,
      };
    });

    // Pre-detect entity type based on headers (heuristic)
    const detectEntityType = (headers) => {
      const headersLower = headers.map(h => String(h || '').toLowerCase().trim());
      
      // InformePlaneacion patterns
      const planificacionPatterns = ['proveedor', 'contacto', 'estado', 'descripcion', 'mes', 'periodo'];
      const planificacionMatches = headersLower.filter(h => planificacionPatterns.some(p => h.includes(p))).length;
      
      // WorkOrder patterns
      const workorderPatterns = ['orden', 'tarea', 'ubicacion', 'establecimiento', 'inspector', 'status', 'fecha'];
      const workorderMatches = headersLower.filter(h => workorderPatterns.some(p => h.includes(p))).length;
      
      if (planificacionMatches >= 3) return 'InformePlaneacion';
      if (workorderMatches >= 4) return 'WorkOrder';
      if (planificacionMatches >= 1) return 'InformePlaneacion'; // Fallback
      if (workorderMatches >= 2) return 'WorkOrder'; // Fallback
      return 'skip';
    };

    // Detect each sheet
    const detectedSheets = sheetsInfo.map(info => {
      const detectedEntity = detectEntityType(info.headers);
      return {
        ...info,
        detected_entity: detectedEntity,
        headers_list: info.headers
      };
    });

    // Helper: normalize header names for matching
    const normalizeHeader = (h) => h.toLowerCase().trim().replace(/[^a-z0-9]/g, '');

    // Helper: heuristic field mapping based on header patterns
    const buildHeuristicMapping = (entity, headers) => {
      const mapping = {};
      const headerMap = {};
      headers.forEach((h, i) => {
        headerMap[normalizeHeader(h)] = h;
      });

      const entityMappings = {
        InformePlaneacion: {
          'mes': ['mes'], 'descripcion': ['desc', 'descripcion', 'tarea'], 'proveedor_2025': ['proveedor', 'prov', 'empresa'],
          'contacto_2025': ['contacto', 'contact'], 'estado_contacto': ['estado', 'status'], 'proveedor_invitado_2026': ['invitado'],
          'proveedor_contratado_2026': ['contratado'], 'fecha_envio_contratar': ['fecha'], 'estado_actual': ['estado'],
        },
        WorkOrder: {
          'code': ['orden', 'numero', 'nro'], 'title': ['titulo', 'tarea', 'descripcion'], 'location': ['ubicacion', 'sitio', 'locacion'],
          'assigned_name': ['asignado', 'operario', 'inspector'], 'status': ['estado', 'status'], 'scheduled_date': ['fecha'],
        }
      };

      const patterns = entityMappings[entity] || {};
      for (const [field, patterns_list] of Object.entries(patterns)) {
        for (const pattern of patterns_list) {
          for (const [normalized, original] of Object.entries(headerMap)) {
            if (normalized.includes(pattern)) {
              mapping[original] = field;
              delete headerMap[normalized];
              break;
            }
          }
        }
      }
      return mapping;
    };

    // Build heuristic mappings first, then refine with LLM
    const heuristicResults = detectedSheets.map(sheet => {
      const mapping = buildHeuristicMapping(sheet.detected_entity, sheet.headers);
      return {
        sheet_name: sheet.sheetName,
        target_entity: sheet.detected_entity,
        field_mapping: mapping,
        from_heuristic: true,
      };
    });

    // Only call LLM for sheets where heuristic was incomplete
    const needsLLM = heuristicResults.filter(r => Object.keys(r.field_mapping).length === 0 && r.target_entity !== 'skip');
    
    let llmResults = [];
    if (needsLLM.length > 0) {
      const prompt = `You are a data mapping expert. Complete field mappings for these sheets where heuristic mapping failed.

Sheets needing mapping:
${JSON.stringify(needsLLM.map(r => {
  const sheet = sheetsInfo.find(s => s.sheetName === r.sheet_name);
  return {
    sheet_name: r.sheet_name,
    headers: sheet?.headers || [],
    sample: sheet?.sample || {},
    target_entity: r.target_entity,
  };
}), null, 2)}

For each sheet, respond with complete field_mapping. Respond ONLY with valid JSON array:
[{
  "sheet_name": "exact name",
  "field_mapping": { "HEADER": "field_name", ... }
}]`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        model: 'claude_sonnet_4_6',
      });

      if (typeof response === 'string') {
        try {
          const jsonMatch = response.match(/\[[\s\S]*\]/);
          const jsonStr = jsonMatch ? jsonMatch[0] : response;
          llmResults = JSON.parse(jsonStr);
          if (!Array.isArray(llmResults)) llmResults = [llmResults];
        } catch (e) {
          console.log('LLM response not JSON, keeping heuristic results');
          llmResults = [];
        }
      } else if (Array.isArray(response)) {
        llmResults = response;
      }
    }

    // Merge heuristic + LLM results
    const sheetsArray = heuristicResults.map(hres => {
      const llmSheet = llmResults.find(l => l.sheet_name === hres.sheet_name);
      return {
        ...hres,
        field_mapping: { ...hres.field_mapping, ...(llmSheet?.field_mapping || {}) },
      };
    });

    // Enrich with row counts and confidence
    const finalSheets = sheetsArray.map(sheet => {
      const sheetInfo = sheetsInfo.find(s => s.sheetName === sheet.sheet_name);
      return {
        ...sheet,
        row_count: sheetInfo?.rowCount || 0,
        confidence: sheetInfo?.pre_score || 0.7,
      };
    });

    return Response.json({ sheets: finalSheets });
  } catch (err) {
    console.error('Error en smartImportAnalyze:', err);
    return Response.json({ error: String(err), sheets: [] }, { status: 500 });
  }
});