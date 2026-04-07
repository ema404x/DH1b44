import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const TOLERANCE_PCT = 0.005;

function buildItemsPrompt(tipo) {
  if (tipo === 'abono_mensual') {
    return `Extraé los servicios del abono mensual.
IGNORÁ subtotales, totales parciales y agrupaciones — solo ítems de servicio reales.
Cada ítem: descripcion, um ("mes"/"GL"), cantidad (generalmente 1), importe_unitario, importe_total.
subtotal_documento = monto total mensual del contrato (el número explícito en el doc).`;
  }
  if (tipo === 'informe') {
    return `Este documento tiene secciones/grupos con subtotales intermedios.
⚠️ SOLO extraé líneas de ítem INDIVIDUAL: aquellas con renglón propio + descripción de tarea + unidad + cantidad + precio unitario.
IGNORÁ completamente "Subtotal Grupo X", "Total Sección", "Total Estructura", "Total Mampostería", etc.
Cada ítem: descripcion, um, cantidad, importe_unitario, importe_total,
  med_acum_anterior_unidad, med_acum_anterior_importe,
  med_presente_unidad, med_presente_importe,
  med_acum_presente_unidad, med_acum_presente_importe,
  saldo_pendiente_unidad, saldo_pendiente_importe.
subtotal_documento = TOTAL FINAL del certificado (no subtotales de sección).`;
  }
  return `Este documento tiene rubros/secciones con subtotales intermedios.
⚠️ SOLO extraé ítems individuales de trabajo: aquellos con renglón propio + descripción específica + unidad + cantidad + precio unitario.
IGNORÁ "Subtotal Rubro", "Total Sección", "Total Grupo", "Total Parcial" — estas son agrupaciones, NO ítems.
Cada ítem: descripcion, um, cantidad, importe_unitario, importe_total.
subtotal_documento = TOTAL FINAL del presupuesto/contrato (el valor global, no parciales).`;
}

const ITEMS_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      descripcion: { type: "string" },
      um: { type: "string" },
      cantidad: { type: "number" },
      importe_unitario: { type: "number" },
      importe_total: { type: "number" },
      med_acum_anterior_unidad: { type: "number" },
      med_acum_anterior_importe: { type: "number" },
      med_presente_unidad: { type: "number" },
      med_presente_importe: { type: "number" },
      med_acum_presente_unidad: { type: "number" },
      med_acum_presente_importe: { type: "number" },
      saldo_pendiente_unidad: { type: "number" },
      saldo_pendiente_importe: { type: "number" }
    }
  }
};

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    emprendimiento: { type: "string" },
    obra_servicio: { type: "string" },
    contratista: { type: "string" },
    ada_numero: { type: "string" },
    oc_numero: { type: "string" },
    mes_periodo: { type: "string" },
    fecha_inicio: { type: "string" },
    plazo_obra: { type: "string" },
    plazo_entrega: { type: "string" },
    monto_contratado: { type: "number" },
    monto_obra_contratada: { type: "number" },
    porcentaje_avance: { type: "number" },
    condiciones_pago: { type: "string" },
    subtotal_documento: { type: "number" },
    items: ITEMS_SCHEMA
  }
};

function recalcItems(items) {
  return (items || []).map(item => ({
    ...item,
    importe_total: Math.round((item.cantidad || 0) * (item.importe_unitario || 0))
  }));
}

function sumItems(items) {
  return (items || []).reduce((sum, i) => sum + (i.importe_total || 0), 0);
}

function hasDiscrepancy(calculated, docTotal) {
  if (!docTotal || docTotal === 0) return false;
  return Math.abs(calculated - docTotal) / docTotal > TOLERANCE_PCT;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { file_url, tipo_override } = await req.json();

  // Detectar tipo si no viene predefinido
  let tipo = tipo_override;
  if (!tipo) {
    const tipoResult = await base44.integrations.Core.InvokeLLM({
      prompt: `Analizá este documento y determiná su tipo exacto:
- "abono_mensual": contrato de mantenimiento o servicio recurrente mensual
- "obra": presupuesto o contrato de obra civil con ítems de medición
- "informe": informe de avance o certificado de medición con acumulados

Respondé SOLO con uno de esos tres valores, sin explicación ni puntuación.`,
      file_urls: [file_url],
      model: 'gemini_3_flash'
    });
    const raw = (tipoResult || '').toString().trim().toLowerCase().replace(/[^a-z_]/g, '');
    tipo = ['abono_mensual', 'obra', 'informe'].includes(raw) ? raw : 'obra';
  }

  // Extracción principal — solo encabezado + ítems (sin retry acá)
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `Sos experto en contratos y presupuestos de construcción argentinos.

CAMPOS DE ENCABEZADO a extraer:
- emprendimiento, obra_servicio, contratista, ada_numero, oc_numero
- mes_periodo (YYYY-MM), fecha_inicio (YYYY-MM-DD)
- plazo_obra, plazo_entrega, condiciones_pago
- monto_contratado, monto_obra_contratada, porcentaje_avance (0-100)

ÍTEMS:
${buildItemsPrompt(tipo)}

subtotal_documento = el valor total final literal que figura en el documento.
Devolvé SOLO JSON válido.`,
    file_urls: [file_url],
    model: 'gemini_3_flash',
    response_json_schema: EXTRACTION_SCHEMA
  });

  result.items = recalcItems(result.items);
  const calculated = sumItems(result.items);
  const docTotal = result.subtotal_documento;
  const discrepancy = hasDiscrepancy(calculated, docTotal);

  result.subtotal = calculated;
  result.tipo = tipo;
  result._validation = {
    subtotal_documento: docTotal || null,
    subtotal_calculado: calculated,
    coincide: !discrepancy,
    diferencia: docTotal ? Math.abs(calculated - docTotal) : null,
    needs_correction: discrepancy,
    // Pasamos info para posible corrección posterior
    correction_direction: discrepancy
      ? (calculated > docTotal ? 'too_high' : 'too_low')
      : null
  };

  delete result.subtotal_documento;

  return Response.json({ success: true, data: result });
});