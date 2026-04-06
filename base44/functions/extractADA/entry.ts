import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Función de validación y corrección
async function validateAndCorrectData(data, file_url, base44) {
  // 1. Validar que existan items
  if (!data.items || data.items.length === 0) {
    return {
      success: false,
      error: 'No se encontraron items en el documento',
      data: null
    };
  }

  // 2. Calcular suma de items
  const calculatedItemsTotal = data.items.reduce((sum, item) => {
    const itemTotal = (item.cantidad || 0) * (item.importe_unitario || 0);
    return sum + itemTotal;
  }, 0);

  // 3. Validar que cada item tenga importe_total correcto
  let itemsFixed = false;
  const correctedItems = data.items.map((item) => {
    const calculatedTotal = (item.cantidad || 0) * (item.importe_unitario || 0);
    if (Math.abs(calculatedTotal - (item.importe_total || 0)) > 0.01) {
      itemsFixed = true;
      return { ...item, importe_total: calculatedTotal };
    }
    return item;
  });

  // 4. Calcular subtotal correcto
  const correctSubtotal = calculatedItemsTotal;
  const subtotalMismatch = Math.abs(correctSubtotal - (data.subtotal || 0)) > 0.01;

  // 5. Validar monto_contratado vs subtotal
  const montoMismatch = Math.abs(correctSubtotal - (data.monto_contratado || 0)) > 0.01;

  if (itemsFixed || subtotalMismatch || montoMismatch) {
    // Si hay discrepancias, re-analizar el documento
    const correctionPrompt = `REANALIZA ESTE DOCUMENTO CON EXTREMA PRECISIÓN.

El primer análisis encontró discrepancias:
- Suma calculada de items: ${correctSubtotal}
- Subtotal reportado: ${data.subtotal}
- Monto total reportado: ${data.monto_contratado}

INSTRUCCIONES CRÍTICAS:
1. Extraé CADA LÍNEA de producto/servicio del documento
2. Para cada línea: cantidad × precio unitario = total del línea (VERIFICA MANUALMENTE)
3. Suma TODOS los totales de línea = subtotal (sin IVA)
4. El monto_contratado debe ser igual al subtotal (o incluir solo impuestos si están detallados)
5. TODOS los números deben ser exactos, sin redondeos

Devolvé el JSON corregido con precisión absoluta:`;

    const correctionResult = await base44.integrations.Core.InvokeLLM({
      prompt: correctionPrompt,
      file_urls: [file_url],
      model: 'claude_sonnet_4_6', // Usar modelo más preciso para correcciones
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
          },
          analisis_validacion: { type: "string" }
        }
      }
    });

    // Re-validar los datos corregidos
    const finalItemsTotal = correctionResult.items.reduce((sum, item) => {
      return sum + ((item.cantidad || 0) * (item.importe_unitario || 0));
    }, 0);

    const finalMismatch = Math.abs(finalItemsTotal - (correctionResult.monto_contratado || 0)) > 0.01 ||
                          Math.abs(finalItemsTotal - (correctionResult.subtotal || 0)) > 0.01;

    return {
      success: !finalMismatch,
      correctionApplied: true,
      data: correctionResult,
      validationStatus: finalMismatch ? 'Error persistente - requiere revisión manual' : 'Corregido y validado'
    };
  }

  return {
    success: true,
    correctionApplied: false,
    data: { ...data, items: correctedItems },
    validationStatus: 'Validado correctamente'
  };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { file_url } = await req.json();

  const prompt = `Sos un sistema experto en leer Autorizaciones de Adquisición (ADA) de la empresa Mejores Hospitales S.A.
Analizá este documento PDF que es una ADA/Orden de Compra y extraé TODA la información estructurada con precisión absoluta.

REGLAS CRÍTICAS:
- "emprendimiento" = obra/sector (ej: "ESCUELA COMUNA 8A")
- "obra_servicio" = descripción del trabajo o servicio
- "contratista" = nombre o razón social del proveedor/contratista
- "ada_numero" = número de ADA (ej: "3845/24")
- "oc_numero" = número de OC si aparece, sino null
- "mes_periodo" = período de vigencia o mes de entrega
- "fecha_inicio" = fecha de emisión o inicio en formato YYYY-MM-DD
- "plazo_obra" = plazo de entrega (ej: "Mensual", "30 días")
- "tipo" = "abono_mensual" si es un servicio mensual recurrente, "obra" si es una obra puntual
- "items" = EXTRAÉ CADA LÍNEA del documento. Para cada una: descripcion, cantidad (número), importe_unitario (número), um (unidad de medida, si no hay poner "GL")
- "importe_total" en cada item = cantidad × importe_unitario (VERIFICA QUE SEA EXACTO)
- "subtotal" = SUMA DE TODOS los importe_total de items (sin IVA)
- "monto_contratado" = total que aparece en el documento (debe coincidir con subtotal si no hay IVA detallado)

IMPORTANTE: Los números deben ser exactos. Si hay discrepancias en el documento, usa los valores que aparecen explícitamente.

Devolvé SOLO el JSON, sin texto adicional.`;

  try {
    const initialResult = await base44.integrations.Core.InvokeLLM({
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

    // Validar y corregir si es necesario
    const validationResult = await validateAndCorrectData(initialResult, file_url, base44);

    if (!validationResult.success) {
      return Response.json({
        success: false,
        error: validationResult.error || 'Validación fallida',
        validationStatus: validationResult.validationStatus
      }, { status: 400 });
    }

    return Response.json({
      success: true,
      data: validationResult.data,
      correctionApplied: validationResult.correctionApplied,
      validationStatus: validationResult.validationStatus
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});