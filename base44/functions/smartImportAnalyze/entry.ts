import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Full schemas with field types for richer LLM context
const ENTITY_SCHEMAS = {
  Client: {
    fields: ['name', 'type', 'cuit', 'contact_name', 'email', 'phone', 'address', 'city', 'status', 'notes'],
    key_fields: ['cuit', 'name', 'email'],
    description: 'Empresas o personas que son clientes del negocio',
    aliases: ['cliente', 'clientes', 'empresa', 'empresas', 'proveedor', 'proveedores', 'client', 'customers'],
    key_patterns: {
      cuit: ['cuit', 'cuil', 'rut', 'nif', 'tax_id', 'numero fiscal', 'identificacion fiscal'],
      name: ['razon social', 'razon_social', 'nombre empresa', 'nombre_empresa', 'company', 'company name', 'nombre'],
      contact_name: ['contacto', 'contact', 'responsable', 'nombre contacto'],
      email: ['email', 'correo', 'mail', 'e-mail'],
      phone: ['telefono', 'tel', 'celular', 'phone', 'movil'],
      city: ['ciudad', 'localidad', 'city', 'municipio'],
      address: ['direccion', 'domicilio', 'address', 'calle'],
    }
  },
  Employee: {
    fields: ['full_name', 'dni', 'role', 'specialty', 'status', 'phone', 'email', 'hire_date', 'hourly_rate', 'notes'],
    key_fields: ['dni', 'full_name'],
    description: 'Empleados, operarios, técnicos del equipo',
    aliases: ['empleado', 'empleados', 'personal', 'operario', 'operarios', 'tecnico', 'tecnicos', 'trabajador', 'worker', 'employee'],
    key_patterns: {
      dni: ['dni', 'documento', 'cedula', 'id', 'numero documento', 'doc', 'nro doc'],
      full_name: ['nombre completo', 'nombre_completo', 'apellido y nombre', 'apellido nombre', 'nombre y apellido', 'full name', 'nombre'],
      hire_date: ['fecha ingreso', 'fecha_ingreso', 'fecha alta', 'ingreso', 'hire date', 'inicio'],
      hourly_rate: ['tarifa', 'hora', 'valor hora', 'tarifa hora', 'hourly', 'costo hora'],
      role: ['rol', 'cargo', 'puesto', 'role', 'position'],
      specialty: ['especialidad', 'especialización', 'especialidad', 'specialty', 'oficio'],
    }
  },
  Material: {
    fields: ['name', 'code', 'category', 'unit', 'stock', 'min_stock', 'unit_cost', 'supplier', 'location', 'notes'],
    key_fields: ['code', 'name'],
    description: 'Materiales, insumos, repuestos del inventario',
    aliases: ['material', 'materiales', 'insumo', 'insumos', 'inventario', 'stock', 'repuesto', 'repuestos', 'item', 'items'],
    key_patterns: {
      code: ['codigo', 'cod', 'code', 'sku', 'referencia', 'ref', 'numero parte'],
      unit_cost: ['precio', 'costo', 'valor', 'precio unitario', 'cost', 'unit cost', 'p.u.'],
      stock: ['stock', 'cantidad', 'existencia', 'qty', 'quantity'],
      min_stock: ['stock minimo', 'minimo', 'stock_minimo', 'min stock', 'punto reorden'],
      supplier: ['proveedor', 'supplier', 'vendedor', 'fabricante'],
      unit: ['unidad', 'um', 'unit', 'medida', 'u.m.'],
    }
  },
  Project: {
    fields: ['name', 'code', 'client_name', 'type', 'status', 'priority', 'description', 'address', 'start_date', 'end_date', 'estimated_budget', 'progress', 'notes'],
    key_fields: ['code', 'name'],
    description: 'Obras, proyectos de construcción o mantenimiento',
    aliases: ['proyecto', 'proyectos', 'obra', 'obras', 'project', 'projects', 'licitacion', 'contrato'],
    key_patterns: {
      code: ['codigo', 'cod proyecto', 'numero obra', 'nro obra', 'expediente', 'code'],
      client_name: ['cliente', 'comitente', 'contratante', 'client', 'empresa'],
      start_date: ['inicio', 'fecha inicio', 'comienzo', 'start date', 'start'],
      end_date: ['fin', 'fecha fin', 'finalizacion', 'vencimiento', 'end date', 'end'],
      estimated_budget: ['presupuesto', 'monto', 'budget', 'importe', 'valor contrato'],
      progress: ['avance', 'progreso', 'porcentaje', 'progress', '% avance'],
    }
  },
  WorkOrder: {
    fields: ['title', 'code', 'project_name', 'asset_name', 'location', 'type', 'status', 'priority', 'description', 'assigned_name', 'scheduled_date', 'estimated_hours', 'notes'],
    key_fields: ['code', 'title'],
    description: 'Órdenes de trabajo, tareas de mantenimiento o reparación',
    aliases: ['orden', 'ordenes', 'ot', 'work order', 'workorder', 'tarea', 'tareas', 'mantenimiento', 'correctivo', 'preventivo'],
    key_patterns: {
      code: ['numero ot', 'nro ot', 'codigo ot', 'ot', 'orden numero', 'code', 'numero orden'],
      title: ['titulo', 'descripcion corta', 'title', 'nombre tarea'],
      assigned_name: ['asignado', 'tecnico', 'responsable', 'assigned', 'ejecutor'],
      scheduled_date: ['fecha programada', 'fecha planificada', 'scheduled', 'fecha ejecucion'],
      estimated_hours: ['horas estimadas', 'horas', 'duration', 'duracion'],
      asset_name: ['equipo', 'activo', 'maquina', 'asset', 'bien'],
    }
  },
  Asset: {
    fields: ['name', 'code', 'type', 'brand', 'model', 'serial_number', 'location', 'project_name', 'status', 'criticality', 'purchase_date', 'purchase_cost', 'notes'],
    key_fields: ['serial_number', 'code', 'name'],
    description: 'Activos, equipos, máquinas, instalaciones',
    aliases: ['activo', 'activos', 'equipo', 'equipos', 'maquina', 'maquinas', 'asset', 'assets', 'instalacion', 'bien'],
    key_patterns: {
      serial_number: ['serie', 'numero serie', 'serial', 'n° serie', 'nro serie', 'sn'],
      brand: ['marca', 'brand', 'fabricante', 'manufacturer'],
      model: ['modelo', 'model', 'tipo modelo'],
      purchase_date: ['fecha compra', 'fecha adquisicion', 'compra', 'adquisicion', 'purchase date'],
      purchase_cost: ['costo compra', 'valor compra', 'precio compra', 'valor adquisicion'],
      criticality: ['criticidad', 'criticality', 'prioridad', 'importancia'],
    }
  },
  PrecarioMinisterio: {
    fields: ['codigo', 'descripcion', 'unidad', 'categoria', 'subcategoria', 'comuna', 'pu_mat', 'pu_mo', 'coef_pase', 'coef_oferta'],
    key_fields: ['codigo'],
    description: 'Preciario ministerial de obras con códigos, precios unitarios y coeficientes',
    aliases: ['preciario', 'precario', 'ministerio', 'precios ministeriales', 'tabla precios'],
    key_patterns: {
      codigo: ['codigo', 'cod', 'code', 'item', 'rubro'],
      pu_mat: ['pu mat', 'p.u. mat', 'precio mat', 'materiales', 'mat'],
      pu_mo: ['pu mo', 'p.u. mo', 'mano obra', 'mo', 'labor'],
      coef_pase: ['coeficiente pase', 'coef pase', 'coef_pase'],
      coef_oferta: ['coeficiente oferta', 'coef oferta', 'coef_oferta'],
      unidad: ['unidad', 'um', 'u.m.', 'unit'],
    }
  },
  LocationData: {
    fields: ['ubic_tecnica', 'establecimiento', 'elem_pep', 'm2', 'comuna', 'jefe_sitio', 'inspector'],
    key_fields: ['ubic_tecnica'],
    description: 'Ubicaciones técnicas, escuelas o establecimientos con su ubicación y responsables',
    aliases: ['ubicacion', 'ubicaciones', 'establecimiento', 'escuela', 'escuelas', 'colegio', 'colegios', 'location', 'sitio', 'sitios'],
    key_patterns: {
      ubic_tecnica: ['ubic tecnica', 'ubicacion tecnica', 'ubic_tecnica', 'codigo ubicacion', 'cod ubic', 'ubicacion', 'codigo sitio'],
      establecimiento: ['establecimiento', 'escuela', 'nombre escuela', 'nombre establecimiento', 'colegio', 'nombre colegio'],
      jefe_sitio: ['jefe sitio', 'jefe_sitio', 'jefe', 'responsable sitio', 'encargado'],
      inspector: ['inspector', 'insp', 'inspector asignado'],
      m2: ['m2', 'metros', 'superficie', 'area', 'superficie m2'],
      comuna: ['comuna', 'zona', 'district'],
      elem_pep: ['elem pep', 'pep', 'elemento pep', 'elem_pep'],
    }
  },
  Quote: {
    fields: ['title', 'client_name', 'description', 'status', 'subtotal', 'tax_rate', 'total', 'valid_until', 'notes'],
    key_fields: ['title', 'client_name'],
    description: 'Presupuestos o cotizaciones enviadas a clientes',
    aliases: ['presupuesto', 'presupuestos', 'cotizacion', 'cotizaciones', 'quote', 'oferta', 'propuesta'],
    key_patterns: {
      title: ['titulo', 'nombre presupuesto', 'descripcion', 'concepto'],
      valid_until: ['validez', 'valido hasta', 'vencimiento', 'valid until', 'expira'],
      subtotal: ['subtotal', 'neto', 'importe neto'],
      tax_rate: ['iva', 'impuesto', 'tax', 'alicuota'],
      total: ['total', 'importe total', 'monto total'],
    }
  },
  Invoice: {
    fields: ['client_name', 'project_name', 'status', 'subtotal', 'tax_rate', 'total', 'issue_date', 'due_date', 'notes'],
    key_fields: ['client_name', 'issue_date'],
    description: 'Facturas emitidas a clientes',
    aliases: ['factura', 'facturas', 'invoice', 'remito', 'comprobante', 'facturacion'],
    key_patterns: {
      issue_date: ['fecha emision', 'fecha factura', 'fecha', 'issue date', 'emision'],
      due_date: ['vencimiento', 'fecha vencimiento', 'due date', 'pagar antes de'],
      subtotal: ['subtotal', 'neto', 'importe neto', 'base imponible'],
      total: ['total', 'importe total', 'monto total', 'a pagar'],
    }
  },
};

// Detectar el modelo de planilla por comuna
function detectPlanillaModel(sheetName, headers) {
  const sheetLower = sheetName.toLowerCase();
  // Normalizar headers igual que en preScoreSheet
  const headersNorm = headers.map(h => h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  
  // Contar matches de palabras clave
  const hasInspector = headersNorm.some(h => h.includes('inspector'));
  const hasOrdenNumber = headersNorm.some(h => h.includes('n°') && h.includes('orden') || h.includes('numero') && h.includes('orden'));
  const hasTareas = headersNorm.some(h => h.includes('tarea'));
  const hasUbicacion = headersNorm.some(h => h.includes('ubicacion'));
  const hasEstablecimiento = headersNorm.some(h => h.includes('establecimiento'));
  const hasStatus = headersNorm.some(h => h.includes('status') || h.includes('estado'));
  
  // Modelo 8A: Tiene INSPECTOR + estructura SAP completa
  if (hasInspector && hasOrdenNumber && hasTareas) {
    return { model: '8A', pattern: 'inspector_sheets', confidence: 0.95 };
  }
  
  // Modelo 10A: SIN INSPECTOR pero TIENE estructura SAP (N° DE ORDEN, TAREAS, ESTABLECIMIENTO)
  if (!hasInspector && hasOrdenNumber && hasTareas && hasEstablecimiento) {
    return { model: '10A', pattern: 'no_inspector', confidence: 0.95 };
  }
  
  // Modelo 8B: Direcciones como nombres de columnas, sin estructura SAP clara
  const hasAddressLikeHeaders = headers.some(h => {
    const clean = h.trim().toUpperCase();
    // Direcciones: patrón típico es "PALABRA PALABRA NUMERO" (ej: MONTIEL 3826)
    return /^[A-Z\s]+\s+\d{4}/.test(clean) && !hasOrdenNumber;
  });
  
  if (hasAddressLikeHeaders && !hasInspector && !hasOrdenNumber) {
    return { model: '8B', pattern: 'pivoted_addresses', confidence: 0.90 };
  }
  
  return null;
}

// Pre-analysis: score each sheet against each entity based on header keyword matches
function preScoreSheet(sheetName, headers) {
  const nameNorm = sheetName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const headersNorm = headers.map(h => h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  const scores = {};

  for (const [entity, schema] of Object.entries(ENTITY_SCHEMAS)) {
    let score = 0;

    // Sheet name alias match (strong signal)
    for (const alias of schema.aliases) {
      if (nameNorm.includes(alias)) { score += 3; break; }
    }

    // Key field pattern match in headers
    let keyMatches = 0;
    for (const [field, patterns] of Object.entries(schema.key_patterns)) {
      for (const header of headersNorm) {
        if (patterns.some(p => header.includes(p) || p.includes(header))) {
          score += schema.key_fields.includes(field) ? 2 : 1;
          keyMatches++;
          break;
        }
      }
    }

    // Bonus for multiple key field matches
    if (keyMatches >= 2) score += 2;

    scores[entity] = score;
  }

  return scores;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { raw_data } = await req.json();

  if (!raw_data || Object.keys(raw_data).length === 0) {
    return Response.json({ error: 'No se encontraron datos en el archivo' }, { status: 400 });
  }

  // Build enriched sheet info with pre-scores
  const sheetsInfo = Object.entries(raw_data).map(([sheetName, rows]) => {
    const headers = (rows[0] || []).map(h => String(h || '').trim()).filter(Boolean);
    const sampleRows = rows.slice(1, 4);
    const sample = {};
    headers.forEach((h, i) => {
      sample[h] = sampleRows.map(r => r[i]).filter(v => v !== '' && v !== null && v !== undefined).join(', ');
    });
    
    const preScores = preScoreSheet(sheetName, headers);
    const topEntity = Object.entries(preScores).sort(([, a], [, b]) => b - a)[0];
    
    // Detectar modelo de planilla (8A, 8B, 10A)
    const planillaModel = detectPlanillaModel(sheetName, headers);
    const modelInfo = planillaModel ? `[${planillaModel.model} - ${planillaModel.pattern}]` : null;
    
    return {
      sheetName,
      headers,
      sample,
      rowCount: Math.max(0, rows.length - 1),
      pre_suggested_entity: topEntity[1] > 0 ? topEntity[0] : null,
      pre_score: topEntity[1],
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

  const prompt = `Eres un experto en importación de datos para un sistema de gestión de construcción y mantenimiento en Argentina/Latinoamérica.

TAREA: Analiza las hojas de un archivo Excel/CSV y:
1. Identifica qué entidad del sistema representa cada hoja
2. Mapea cada columna al campo correcto del sistema con máxima precisión
3. DETECTA LA COMUNA (8A, 8B o 10A) — las planillas varían según la comuna

ENTIDADES DEL SISTEMA (con patrones de columnas clave):
${JSON.stringify(schemaSummary, null, 2)}

HOJAS A ANALIZAR (con sugerencia previa basada en keywords):
${JSON.stringify(sheetsInfo, null, 2)}

REGLAS DE MAPEO (por orden de importancia):
1. CAMPOS CLAVE PRIMERO: Detecta siempre primero los campos que identifican un registro (key_fields). Ej: CUIT→Client.cuit, DNI→Employee.dni, N°Serie→Asset.serial_number, Código→Material.code
2. COINCIDENCIA SEMÁNTICA: Usa sinónimos y variantes regionales. Ej: "Razón Social"→name, "Fecha de Alta"→hire_date, "Jornal"→hourly_rate, "P.U."→unit_cost
3. DATOS DE MUESTRA: Usa los valores de sample para confirmar el tipo. Ej: si parece CUIT (11 dígitos con guiones) → campo cuit. Si es DNI (7-8 dígitos) → campo dni
4. NOMBRE DE HOJA: Considéralo como señal fuerte. "Empleados", "Personal", "RRHH" → Employee
5. DETECTA LA COMUNA Y MODELO:
   - Comuna: Si encuentras "8A", "8B", "10A" EN EL NOMBRE DEL ARCHIVO O DATOS, indicalo en detected_comuna
   - Modelo de planilla:
     * 8A: Hojas por inspector (columnas INSPECTOR, UBICACIÓN, ESTABLECIMIENTO, TAREAS A REALIZAR, N° DE ORDEN, etc.)
     * 8B: Formato pivotado (columnas = direcciones/jefes, sin INSPECTOR, datos anidados)
     * 10A: Sin INSPECTOR, columnas simplificadas (UBICACIÓN, ESTABLECIMIENTO, TAREAS, N° DE ORDEN, pero sin INSPECTOR)
   - Indicalo en detected_planilla_model
6. pre_suggested_entity es una pista automática, valídala con headers y datos
7. Si una columna no encaja en ningún campo del sistema, déjala vacía (no mapear)
8. Si la hoja es claramente auxiliar o sin datos útiles, usa target_entity: "skip"

CALIBRACIÓN DE CONFIANZA:
- 0.95+: Nombre de hoja + campos clave coinciden perfectamente
- 0.80-0.94: Campos clave detectados con buena coincidencia semántica  
- 0.60-0.79: Coincidencia parcial, algunos campos reconocibles
- <0.60: Dudoso, pocos campos reconocibles

Responde con la lista de hojas ordenada por confidence DESCENDENTE (mayor confianza primero). INCLUYE detected_comuna en cada hoja si la detectas.`;

  const result = await base44.integrations.Core.InvokeLLM({
    prompt,
    model: 'claude_sonnet_4_6',
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
              detected_comuna: { type: 'string' },
              detected_planilla_model: { type: 'string' },
              field_mapping: { type: 'object', additionalProperties: { type: 'string' } },
              sample_data: { type: 'object', additionalProperties: { type: 'string' } },
            },
            required: ['sheet_name', 'target_entity', 'confidence', 'field_mapping', 'sample_data']
          }
        }
      }
    }
  });

  // Ensure row_count is always set from real data (not LLM guess)
  // También asegurarse de que detected_planilla_model esté poblado
  if (result && result.sheets) {
    result.sheets = result.sheets.map(sheet => {
      const rawRows = raw_data[sheet.sheet_name];
      const sheetInfo = sheetsInfo.find(s => s.sheetName === sheet.sheet_name);
      
      return {
        ...sheet,
        row_count: rawRows ? Math.max(0, rawRows.length - 1) : (sheet.row_count || 0),
        // Si la IA no detectó, usar nuestro análisis local
        detected_planilla_model: sheet.detected_planilla_model || sheetInfo?.planilla_model || null,
      };
    });
  }

  return Response.json(result);
});