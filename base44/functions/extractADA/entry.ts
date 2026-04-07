import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Tolerancia aceptable de redondeo (0.5%)
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
  // obra
  return `Este documento tiene rubros/secciones con subtotales intermedios.
⚠️ SOLO extraé ítems individuales de trabajo: aquellos con renglón propio + descripción específica + unidad + cantidad + precio unitario.
IGNORÁ "Subtotal Rubro", "Total Sección", "Total Grupo", "Total Parcial" — estas son agrupaciones, NO ítems.
Cada ítem: descripcion, um, cantidad, importe_unitario, importe_total.
subtotal_documento = TOTAL FINAL del presupuesto/contrato (el valor global, no parciales).`;
}

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
    items: {
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
    }
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

  // ── Determinar tipo si no viene del cliente ───────────────────────────────
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

  // ── Extracción principal ──────────────────────────────────────────────────
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `Sos experto en contratos y presupuestos de construcción argentinos.

CAMPOS DE ENCABEZADO a extraer:
- emprendimiento: nombre del edificio/proyecto/obra
- obra_servicio: descripción de la obra o servicio
- contratista: empresa o persona contratista
- ada_numero: número de ADA o autorización
- oc_numero: número de orden de compra (si existe)
- mes_periodo: período (YYYY-MM)
- fecha_inicio: fecha de inicio (YYYY-MM-DD)
- plazo_obra: plazo contractual expresado como texto (ej: "180 días", "6 meses")
- plazo_entrega: fecha o plazo de entrega final si es diferente al plazo_obra
- monto_contratado: monto total contratado originalmente (número)
- monto_obra_contratada: monto total de la obra contratada (puede diferir de monto_contratado si hay redeterminaciones)
- porcentaje_avance: porcentaje de avance de obra (0-100), si figura en el documento
- condiciones_pago: descripción de las condiciones de pago (ej: "30 días hábiles", "a 60 días de la factura")

ÍTEMS:
${buildItemsPrompt(tipo)}

VALIDACIÓN CRÍTICA — ANTES de devolver el JSON verificá:
1. Calculá la suma de (cantidad × importe_unitario) para CADA ítem.
2. Compará esa suma con subtotal_documento.
3. Si difieren en más del 0.5%: revisá si hay ítems que son subtotales de grupo disfrazados de ítems (tienen importe = suma de ítems anteriores) y eliminá esos falsos ítems hasta que la suma coincida.
4. subtotal_documento DEBE ser el valor literal que figura en el documento como total final.

Devolvé SOLO JSON válido.`,
    file_urls: [file_url],
    model: 'gemini_3_1_pro',
    response_json_schema: EXTRACTION_SCHEMA
  });

  // ── Recalcular y validar ──────────────────────────────────────────────────
  result.items = recalcItems(result.items);
  let calculated = sumItems(result.items);
  const docTotal = result.subtotal_documento;

  // Si hay discrepancia significativa, pedir corrección al modelo
  if (hasDiscrepancy(calculated, docTotal)) {
    const direction = calculated > docTotal
      ? `La suma calculada (${calculated}) es MAYOR que el total del documento (${docTotal}). Estás incluyendo subtotales de sección/grupo como si fueran ítems. Eliminá las filas cuyo importe sea igual a la suma de ítems anteriores (son subtotales disfrazados).`
      : `La suma calculada (${calculated}) es MENOR que el total del documento (${docTotal}). Faltan ítems — revisá el documento y agregá los que no extrajiste.`;

    const retry = await base44.integrations.Core.InvokeLLM({
      prompt: `CORRECCIÓN DE ÍTEMS para este documento.

${direction}

Total final correcto según el documento: ${docTotal}
La suma de (cantidad × importe_unitario) de todos los ítems corregidos debe ser exactamente ${docTotal} (tolerancia ±0.5%).

Reglas:
- Ítem REAL: tiene renglón propio, descripción de tarea específica, unidad de medida, cantidad y precio unitario.
- SUBTOTAL/AGRUPACIÓN: texto como "Subtotal", "Total Grupo", "Total Sección", "Total Rubro" + importe = suma de ítems anteriores. NO LO INCLUYAS.

Devolvé SOLO el array "items" corregido en JSON.`,
      file_urls: [file_url],
      model: 'gemini_3_1_pro',
      response_json_schema: {
        type: "object",
        properties: { items: EXTRACTION_SCHEMA.properties.items }
      }
    });

    if (retry.items?.length) {
      result.items = recalcItems(retry.items);
      calculated = sumItems(result.items);
    }
  }

  // ── Armar respuesta final ─────────────────────────────────────────────────
  result.subtotal = calculated;
  result.tipo = tipo;

  // Info de validación para el frontend
  result._validation = {
    subtotal_documento: docTotal || null,
    subtotal_calculado: calculated,
    coincide: !hasDiscrepancy(calculated, docTotal),
    diferencia: docTotal ? Math.abs(calculated - docTotal) : null
  };

  delete result.subtotal_documento;

  return Response.json({ success: true, data: result });
});