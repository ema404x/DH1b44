import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { file_url } = await req.json();

  const prompt = `Sos un sistema experto en leer Autorizaciones de Adquisición (ADA) de la empresa Mejores Hospitales S.A.
Analizá este documento PDF que es una ADA/Orden de Compra y extraé TODA la información estructurada.

Reglas:
- "emprendimiento" = obra/sector (ej: "ESCUELA COMUNA 8A")
- "obra_servicio" = descripción del trabajo o servicio
- "contratista" = nombre o razón social del proveedor/contratista
- "ada_numero" = número de ADA (ej: "3845/24")
- "oc_numero" = número de OC si aparece, sino null
- "mes_periodo" = período de vigencia o mes de entrega
- "fecha_inicio" = fecha de emisión o inicio en formato YYYY-MM-DD
- "plazo_obra" = plazo de entrega (ej: "Mensual", "30 días")
- "monto_contratado" = monto TOTAL incluyendo IVA (número sin símbolos)
- "items" = array con cada ítem de trabajo. Para cada uno: descripcion, cantidad (número), importe_unitario (número), importe_total (número), um (unidad de medida, si no hay poner "GL")
- "subtotal" = subtotal sin IVA (número)
- "tipo" = "abono_mensual" si es un servicio mensual recurrente, "obra" si es una obra puntual

Devolvé SOLO el JSON, sin texto adicional.`;

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

  return Response.json({ data: result });
});