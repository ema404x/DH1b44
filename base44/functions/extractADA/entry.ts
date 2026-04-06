import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { file_url } = await req.json();

  const prompt = `Eres experto leyendo ADAs (Autorizaciones de Adquisición) y órdenes de compra.

EXTRAE CUIDADOSAMENTE cada línea de la tabla de items:
- descripcion: texto completo del ítem/trabajo
- cantidad: número exacto
- importe_unitario: precio por unidad
- importe_total: cantidad × importe_unitario (CALCULA Y VERIFICA)
- um: unidad de medida ("m2", "GL", "unidad", etc.)

LUEGO busca en el documento el valor de "SUBTOTAL" o "TOTAL" que aparece explícitamente y devuélvelo como subtotal_documento.

Extrae también:
- emprendimiento, obra_servicio, contratista, ada_numero, oc_numero
- mes_periodo, fecha_inicio, plazo_obra, monto_contratado, tipo

IMPORTANTE: asegúrate de extraer TODOS los items. Si el documento tiene muchas líneas, asegúrate de captarlas todas.

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
          subtotal_documento: { type: "number" },
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

    // Recalcular items y subtotal
    if (result.items) {
      result.items = result.items.map(item => ({
        ...item,
        importe_total: (item.cantidad || 0) * (item.importe_unitario || 0)
      }));
      const calculatedSubtotal = result.items.reduce((sum, item) => sum + (item.importe_total || 0), 0);

      // Si hay discrepancia > 5% entre el subtotal calculado y el del documento, reanalizar
      const docSubtotal = result.subtotal_documento;
      if (docSubtotal && Math.abs(calculatedSubtotal - docSubtotal) / docSubtotal > 0.05) {
        // Reanalizar con instrucción más específica
        const retryPrompt = `ANALIZA NUEVAMENTE este ADA con MÁXIMA PRECISIÓN.

El subtotal en el documento es: ${docSubtotal}
Pero la suma de items da: ${calculatedSubtotal}

Esto significa que:
1. Se olvidaron items (busca líneas que no se incluyeron)
2. O los precios/cantidades están mal

Extrae de nuevo TODOS los items sin excepción. Incluye incluso líneas pequeñas o descripciones largas.
Para cada item: cantidad × importe_unitario.

La suma de todos debe ser: ${docSubtotal}

Devolvé JSON.`;

        const retryResult = await base44.integrations.Core.InvokeLLM({
          prompt: retryPrompt,
          file_urls: [file_url],
          response_json_schema: {
            type: "object",
            properties: {
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

        if (retryResult.items) {
          result.items = retryResult.items.map(item => ({
            ...item,
            importe_total: (item.cantidad || 0) * (item.importe_unitario || 0)
          }));
        }
      }

      result.subtotal = result.items.reduce((sum, item) => sum + (item.importe_total || 0), 0);
      delete result.subtotal_documento;
    }

    return Response.json({ success: true, data: result });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});