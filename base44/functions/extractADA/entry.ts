import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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
      model: 'claude_sonnet_4_6'
    });
    const raw = (tipoResult || '').toString().trim().toLowerCase().replace(/[^a-z_]/g, '');
    tipo = ['abono_mensual', 'obra', 'informe'].includes(raw) ? raw : 'obra';
  }

  // ── Prompt según tipo ─────────────────────────────────────────────────────
  let itemsPrompt = '';

  if (tipo === 'abono_mensual') {
    itemsPrompt = `Extraé los servicios del abono mensual.
IGNORÁ subtotales, totales parciales y agrupaciones — solo ítems de servicio reales.
Cada ítem: descripcion, um ("mes"/"GL"), cantidad (1), importe_unitario, importe_total.
El subtotal_documento es el monto total mensual del contrato.`;

  } else if (tipo === 'informe') {
    itemsPrompt = `Este documento tiene secciones/grupos con subtotales intermedios.
⚠️ SOLO extraé líneas de ítem INDIVIDUAL (tienen renglón + descripción + unidad + cantidad + precio).
IGNORÁ completamente "Subtotal Grupo X", "Total Sección", "Total Estructura", etc.
Cada ítem: descripcion, um, cantidad, importe_unitario, importe_total,
  med_acum_anterior_unidad, med_acum_anterior_importe,
  med_presente_unidad, med_presente_importe,
  med_acum_presente_unidad, med_acum_presente_importe,
  saldo_pendiente_unidad, saldo_pendiente_importe.
El subtotal_documento es el TOTAL FINAL (no subtotales parciales).`;

  } else {
    itemsPrompt = `Este documento tiene rubros/secciones con subtotales intermedios.
⚠️ SOLO extraé ítems individuales de trabajo (tienen renglón + descripción + unidad + cantidad + precio unitario).
IGNORÁ líneas de "Subtotal Rubro", "Total Sección", "Total Grupo", "Total Parcial".
Cada ítem: descripcion, um, cantidad, importe_unitario, importe_total.
El subtotal_documento es el TOTAL FINAL del presupuesto/contrato.`;
  }

  // ── Extracción principal ──────────────────────────────────────────────────
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `Sos experto en contratos y presupuestos de construcción argentinos.

DATOS DEL ENCABEZADO a extraer:
- emprendimiento: nombre del edificio/proyecto
- obra_servicio: descripción de la obra o servicio
- contratista: empresa contratista
- ada_numero: número de ADA o autorización
- oc_numero: número de orden de compra
- mes_periodo: período en formato YYYY-MM
- fecha_inicio: fecha de inicio (YYYY-MM-DD)
- plazo_obra: plazo (si aplica)
- monto_contratado: monto total contratado (número)

ÍTEMS:
${itemsPrompt}

Devolvé SOLO JSON válido.`,
    file_urls: [file_url],
    model: 'gemini_3_1_pro',
    response_json_schema: {
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
        monto_contratado: { type: "number" },
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
    }
  });

  // ── Recalcular importes ───────────────────────────────────────────────────
  if (result.items) {
    result.items = result.items.map(item => ({
      ...item,
      importe_total: Math.round((item.cantidad || 0) * (item.importe_unitario || 0))
    }));
    result.subtotal = result.items.reduce((sum, i) => sum + (i.importe_total || 0), 0);
    delete result.subtotal_documento;
  }

  result.tipo = tipo;
  return Response.json({ success: true, data: result });
});