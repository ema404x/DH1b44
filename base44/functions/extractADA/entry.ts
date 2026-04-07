import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const TOLERANCE_PCT = 0.005;

// Schema minimal — solo lo que necesitamos en cada tipo
const BASE_ITEM = {
  type: "object",
  properties: {
    descripcion: { type: "string" },
    um: { type: "string" },
    cantidad: { type: "number" },
    importe_unitario: { type: "number" },
    importe_total: { type: "number" }
  }
};

const INFORME_ITEM = {
  type: "object",
  properties: {
    ...BASE_ITEM.properties,
    med_acum_anterior_unidad: { type: "number" },
    med_acum_anterior_importe: { type: "number" },
    med_presente_unidad: { type: "number" },
    med_presente_importe: { type: "number" },
    med_acum_presente_unidad: { type: "number" },
    med_acum_presente_importe: { type: "number" },
    saldo_pendiente_unidad: { type: "number" },
    saldo_pendiente_importe: { type: "number" }
  }
};

const SCHEMA_BASE = {
  type: "object",
  properties: {
    tipo: { type: "string", enum: ["abono_mensual", "obra", "informe"] },
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
    items: { type: "array", items: INFORME_ITEM } // informe tiene más campos; para obra/abono los extras quedan en 0
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

  const tipoInstruccion = tipo_override
    ? `El tipo de documento ya fue definido por el usuario: "${tipo_override}". Usalo directamente.`
    : `Determiná el tipo del documento:
- "abono_mensual": contrato de mantenimiento/servicio mensual recurrente
- "obra": presupuesto o contrato de obra con ítems de medición
- "informe": informe de avance o certificado con columnas de acumulado`;

  const prompt = `Sos experto en contratos de construcción argentinos. Analizá este PDF y extraé TODO en una sola pasada.

TIPO: ${tipoInstruccion}

ENCABEZADO (extraé lo que figure, dejá vacío lo que no):
- emprendimiento, obra_servicio, contratista, ada_numero, oc_numero
- mes_periodo (YYYY-MM), fecha_inicio (YYYY-MM-DD)
- plazo_obra, plazo_entrega, condiciones_pago
- monto_contratado, monto_obra_contratada, porcentaje_avance (0-100)
- subtotal_documento = el número TOTAL FINAL literal del documento (no parciales)

ÍTEMS — regla crítica:
⚠️ Extraé SOLO ítems individuales de trabajo (renglón + descripción + unidad + cantidad + precio unitario).
⚠️ IGNORÁ filas de "Subtotal", "Total Rubro", "Total Sección", "Total Grupo" — son agrupaciones, no ítems.
Un ítem es subtotal disfrazado si su importe = suma de los ítems anteriores del mismo grupo.

Si el tipo es "informe", incluí también las columnas de medición acumulada (med_acum_anterior, med_presente, etc.).

Verificá antes de responder: la suma de (cantidad × importe_unitario) debe coincidir con subtotal_documento (±0.5%).
Si no coincide, revisá y eliminá falsos ítems hasta que cuadre.

Devolvé SOLO JSON válido.`;

  const result = await base44.integrations.Core.InvokeLLM({
    prompt,
    file_urls: [file_url],
    model: 'gemini_3_flash',
    response_json_schema: SCHEMA_BASE
  });

  // Si el usuario definió el tipo, forzarlo (la IA puede equivocarse)
  if (tipo_override) result.tipo = tipo_override;

  result.items = recalcItems(result.items);
  const calculated = sumItems(result.items);
  const docTotal = result.subtotal_documento;
  const discrepancy = hasDiscrepancy(calculated, docTotal);

  result.subtotal = calculated;
  result._validation = {
    subtotal_documento: docTotal || null,
    subtotal_calculado: calculated,
    coincide: !discrepancy,
    diferencia: docTotal ? Math.abs(calculated - docTotal) : null,
    needs_correction: discrepancy,
    correction_direction: discrepancy
      ? (calculated > docTotal ? 'too_high' : 'too_low')
      : null
  };

  delete result.subtotal_documento;

  return Response.json({ success: true, data: result });
});