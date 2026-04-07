import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { file_url, calculated, docTotal, direction } = await req.json();

  const directionMsg = direction === 'too_high'
    ? `La suma calculada (${calculated}) es MAYOR que el total del documento (${docTotal}). Estás incluyendo subtotales de sección/grupo como si fueran ítems. Eliminá las filas cuyo importe sea igual a la suma de ítems anteriores (son subtotales disfrazados).`
    : `La suma calculada (${calculated}) es MENOR que el total del documento (${docTotal}). Faltan ítems — revisá el documento y agregá los que no extrajiste.`;

  const retry = await base44.integrations.Core.InvokeLLM({
    prompt: `CORRECCIÓN DE ÍTEMS para este documento.

${directionMsg}

Total final correcto según el documento: ${docTotal}
La suma de (cantidad × importe_unitario) de todos los ítems corregidos debe ser exactamente ${docTotal} (tolerancia ±0.5%).

Reglas:
- Ítem REAL: tiene renglón propio, descripción de tarea específica, unidad de medida, cantidad y precio unitario.
- SUBTOTAL/AGRUPACIÓN: texto como "Subtotal", "Total Grupo", "Total Sección", "Total Rubro". NO LO INCLUYAS.

Devolvé SOLO el array "items" corregido en JSON.`,
    file_urls: [file_url],
    model: 'gemini_3_flash',
    response_json_schema: {
      type: "object",
      properties: { items: ITEMS_SCHEMA }
    }
  });

  const items = (retry.items || []).map(item => ({
    ...item,
    importe_total: Math.round((item.cantidad || 0) * (item.importe_unitario || 0))
  }));

  const newCalculated = items.reduce((sum, i) => sum + (i.importe_total || 0), 0);

  return Response.json({ success: true, items, calculated: newCalculated });
});