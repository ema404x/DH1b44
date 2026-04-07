import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { file_url } = await req.json();

  // ── PASO 1: detectar tipo de documento ───────────────────────────────────
  const tipoResult = await base44.integrations.Core.InvokeLLM({
    prompt: `Analizá este documento y determiná su tipo:
- "abono_mensual": contrato de mantenimiento / servicio recurrente mensual (abono, mantenimiento periódico)
- "obra": presupuesto / contrato de obra civil, construcción, refacción, trabajo puntual con ítems de medición
- "informe": informe de avance, certificado de medición de obra con mediciones acumuladas

Respondé SOLO con uno de esos tres valores exactos, sin explicación.`,
    file_urls: [file_url],
    model: 'claude_sonnet_4_6'
  });

  const tipoDoc = (tipoResult || '').toString().trim().toLowerCase().replace(/[^a-z_]/g, '');
  const tipo = ['abono_mensual', 'obra', 'informe'].includes(tipoDoc) ? tipoDoc : 'obra';

  // ── PASO 2: extraer datos según tipo ─────────────────────────────────────
  let prompt = '';

  if (tipo === 'abono_mensual') {
    prompt = `Sos experto en contratos de mantenimiento y abonos mensuales argentinos.

Extraé del documento:
- emprendimiento: nombre del edificio/proyecto
- obra_servicio: descripción del servicio de mantenimiento
- contratista: empresa o persona que brinda el servicio
- ada_numero: número de ADA o autorización
- oc_numero: número de orden de compra
- mes_periodo: mes y año del servicio (formato YYYY-MM)
- fecha_inicio: fecha de inicio del contrato
- monto_contratado: monto mensual del abono (número)
- items: lista de servicios incluidos en el abono

Para los items, extraé SOLO los servicios reales (no subtotales):
- descripcion: nombre del servicio
- um: unidad ("mes", "GL", etc.)
- cantidad: 1 (generalmente)
- importe_unitario: precio del ítem
- importe_total: importe_unitario × cantidad

⚠️ CRÍTICO: NO incluyas líneas de subtotal, total ni agrupaciones como ítems.
El subtotal_documento es la suma total del abono mensual.`;

  } else if (tipo === 'informe') {
    prompt = `Sos experto en certificados de medición de obra e informes de avance argentinos.

Este documento es un INFORME / CERTIFICADO DE MEDICIÓN. Puede tener secciones (Estructura, Mampostería, etc.) y grupos (Grupo 1, Grupo 2, etc.) con subtotales intermedios.

⚠️ REGLA CRÍTICA ANTI-DUPLICACIÓN:
- Extraé SOLO las líneas de ítem de trabajo INDIVIDUAL con número de renglón, descripción, unidad, cantidad y precio unitario.
- Las líneas "Subtotal Grupo X", "Subtotal Sección X", "Total Estructura", etc. NO son ítems — IGNORÁLAS completamente.
- Si un ítem aparece en un grupo y luego hay un subtotal del grupo, solo incluí el ítem, no el subtotal.

Para cada ítem real extraé:
- descripcion: descripción del trabajo
- um: unidad de medida (m2, m3, ml, kg, GL, unidad, hs, etc.)
- cantidad: cantidad contratada total
- importe_unitario: precio unitario
- importe_total: cantidad × importe_unitario
- med_presente_unidad: medición del presente certificado (unidades)
- med_presente_importe: medición del presente certificado ($)
- med_acum_anterior_unidad: medición acumulada anterior (unidades)
- med_acum_anterior_importe: medición acumulada anterior ($)
- med_acum_presente_unidad: acumulado presente (unidades)
- med_acum_presente_importe: acumulado presente ($)
- saldo_pendiente_unidad: saldo pendiente (unidades)
- saldo_pendiente_importe: saldo pendiente ($)

El subtotal_documento es el TOTAL FINAL del certificado (no subtotales parciales).`;

  } else {
    // obra
    prompt = `Sos experto en contratos de obra civil y presupuestos de construcción argentinos.

Este documento es un CONTRATO DE OBRA o PRESUPUESTO. Puede tener rubros, secciones o grupos con subtotales.

⚠️ REGLA CRÍTICA ANTI-DUPLICACIÓN:
- Extraé SOLO los ítems individuales de trabajo: aquellos con número de renglón, descripción de tarea específica, unidad de medida, cantidad y precio unitario.
- IGNORÁ completamente las líneas de "Subtotal Rubro", "Total Sección", "Subtotal Grupo X", "Total Parcial", etc.
- Verificación: la suma de importe_total de todos los ítems debe coincidir con el subtotal_documento del documento.

Para cada ítem:
- descripcion: descripción del trabajo
- um: unidad (m2, m3, ml, kg, GL, unidad, hs, etc.)
- cantidad: cantidad
- importe_unitario: precio unitario
- importe_total: cantidad × importe_unitario

subtotal_documento: valor TOTAL FINAL del presupuesto (la suma de todos los rubros).`;
  }

  // Prompt base común
  const fullPrompt = `${prompt}

Extraé también estos campos del encabezado:
- emprendimiento: nombre del edificio/proyecto/obra
- obra_servicio: descripción de la obra o servicio
- contratista: empresa contratista
- ada_numero: número de ADA o autorización
- oc_numero: número de orden de compra (si existe)
- mes_periodo: período (YYYY-MM)
- fecha_inicio: fecha de inicio
- plazo_obra: plazo en días/meses (si aplica)
- monto_contratado: monto total contratado

Devolvé SOLO JSON válido, sin explicaciones.`;

  const result = await base44.integrations.Core.InvokeLLM({
    prompt: fullPrompt,
    file_urls: [file_url],
    model: 'claude_sonnet_4_6',
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

  // ── PASO 3: recalcular y verificar ───────────────────────────────────────
  if (result.items) {
    result.items = result.items.map(item => ({
      ...item,
      importe_total: (item.cantidad || 0) * (item.importe_unitario || 0)
    }));

    const calculatedSubtotal = result.items.reduce((sum, i) => sum + (i.importe_total || 0), 0);
    const docSubtotal = result.subtotal_documento;

    // Si hay discrepancia > 5%, reintentar con instrucción explícita de eliminar subtotales
    if (docSubtotal && Math.abs(calculatedSubtotal - docSubtotal) / docSubtotal > 0.05) {
      const direction = calculatedSubtotal > docSubtotal
        ? `La suma calculada (${calculatedSubtotal}) es MAYOR que el total del documento (${docSubtotal}). Esto significa que estás incluyendo SUBTOTALES DE SECCIÓN/GRUPO como ítems. Eliminá todas las filas que sean subtotales o totales parciales.`
        : `La suma calculada (${calculatedSubtotal}) es MENOR que el total del documento (${docSubtotal}). Faltan ítems — revisá si hay ítems que no extrajiste.`;

      const retry = await base44.integrations.Core.InvokeLLM({
        prompt: `CORRECCIÓN NECESARIA para este ADA/Presupuesto.

${direction}

El total final correcto del documento es: ${docSubtotal}

Reglas:
- Un ÍTEM REAL tiene: renglón, descripción de tarea, unidad de medida, cantidad numérica, precio unitario numérico.
- Un SUBTOTAL tiene texto como "Subtotal", "Total Grupo", "Total Sección", "Total Rubro" — NO LO INCLUYAS.
- La suma de (cantidad × precio_unitario) de todos los ítems debe ser exactamente ${docSubtotal}.

Devolvé SOLO el array de ítems corregido en JSON.`,
        file_urls: [file_url],
        model: 'claude_sonnet_4_6',
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

      if (retry.items?.length) {
        result.items = retry.items.map(item => ({
          ...item,
          importe_total: (item.cantidad || 0) * (item.importe_unitario || 0)
        }));
      }
    }

    result.subtotal = result.items.reduce((sum, i) => sum + (i.importe_total || 0), 0);
    delete result.subtotal_documento;
  }

  result.tipo = tipo;

  return Response.json({ success: true, data: result });
});