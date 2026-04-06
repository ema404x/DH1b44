import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { file_url } = await req.json();

  const prompt = `Extrae la información del ADA/Orden de Compra:

- emprendimiento, obra_servicio, contratista, ada_numero, oc_numero
- mes_periodo, fecha_inicio, plazo_obra, monto_contratado, tipo
- items: descripcion, cantidad, importe_unitario, importe_total, um (o "GL")
- subtotal = suma de importe_total de items

Devolvé SOLO JSON.`;

  try {
    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      file_urls: [file_url],
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
          subtotal: { type: "number" },
          tipo: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                descripcion: { type: "string" },
                um: { type: "string" },
                cantidad: { type: "number" },
                importe_unitario: { type: "number" },
                importe_total: { type: "number" }
              }
            }
          }
        }
      }
    });

    // Solo corregir cálculos de items, sin validación compleja
    if (result.items) {
      result.items = result.items.map(item => ({
        ...item,
        importe_total: (item.cantidad || 0) * (item.importe_unitario || 0)
      }));
      result.subtotal = result.items.reduce((sum, item) => sum + (item.importe_total || 0), 0);
    }

    return Response.json({ success: true, data: result });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});