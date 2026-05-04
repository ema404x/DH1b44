import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url, archivo_nombre } = await req.json();
    if (!file_url) return Response.json({ error: 'file_url required' }, { status: 400 });

    // 1. Usar parseExcelPresupuesto para obtener el contenido del Excel
    const parseRes = await base44.asServiceRole.functions.invoke('parseExcelPresupuesto', { file_url });
    const parsed = parseRes;

    // 2. Convertir a texto plano para la IA
    let textoHojas = '';
    if (parsed && parsed.sheets) {
      for (const [sheetName, sheetData] of Object.entries(parsed.sheets)) {
        const rows = (sheetData.rows || []).slice(0, 200);
        const lines = rows.map(row =>
          (row || []).map(cell => {
            let v = cell?.value;
            if (v && typeof v === 'object' && v.result !== undefined) v = v.result;
            if (v && typeof v === 'object' && v.text !== undefined) v = v.text;
            return v !== null && v !== undefined ? String(v).trim() : '';
          }).filter(Boolean).join(' | ')
        ).filter(Boolean);
        textoHojas += `=== HOJA: ${sheetName} ===\n${lines.join('\n')}\n\n`;
      }
    }

    const textoTotal = textoHojas.slice(0, 25000);

    if (!textoTotal.trim()) {
      return Response.json({ error: 'No se pudo leer el contenido del Excel' }, { status: 400 });
    }

    // 3. IA extrae la estructura del presupuesto
    const datos = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Sos un experto en presupuestos de obras de construcción argentina (GCBA, Ministerio Educación, formato PCP/PAPORC/PAMON).

Analizá este contenido extraído de un Excel de presupuesto de obra y extraé toda la información estructurada.

CONTENIDO DEL EXCEL:
${textoTotal}

INSTRUCCIONES:
- titulo: descripción o nombre de la obra
- codigo: número o código del presupuesto (ej: PPTO-001, 8A-001)
- licitacion: número de licitación si aparece
- cliente_nombre: comitente u organismo contratante
- escuela: nombre del establecimiento educativo si aplica
- direccion_obra: dirección de la obra
- inspector: nombre del inspector
- responsable: supervisor o responsable técnico
- mtom: número MTOM si aparece
- coef_pase: coeficiente de pase (número decimal, buscar en el Excel, default 1.6504)
- coef_oferta: coeficiente de oferta (número decimal, buscar en el Excel, default 1.38)
- plazo: plazo de obra en texto
- rubros: array de capítulos/secciones con sus ítems

Para cada ítem:
- codigo: código alfanumérico del ítem
- descripcion: descripción completa del ítem
- unidad: unidad de medida (m2, ml, gl, kg, etc)
- cantidad: número (puede ser decimal)
- pu_mat: precio unitario de materiales (número)
- pu_mo: precio unitario de mano de obra (número). Si hay un solo precio unitario, ponerlo en pu_mat y 0 en pu_mo
- Si hay columnas de Anterior % y Actual %, extraerlas también

IMPORTANTE: Ignorar filas de totales, subtotales, encabezados. Los rubros agrupan ítems. Si no hay rubros claros, usar un rubro "GENERAL".`,
      response_json_schema: {
        type: 'object',
        properties: {
          titulo: { type: 'string' },
          codigo: { type: 'string' },
          licitacion: { type: 'string' },
          cliente_nombre: { type: 'string' },
          escuela: { type: 'string' },
          direccion_obra: { type: 'string' },
          inspector: { type: 'string' },
          responsable: { type: 'string' },
          mtom: { type: 'string' },
          coef_pase: { type: 'number' },
          coef_oferta: { type: 'number' },
          plazo: { type: 'string' },
          rubros: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                nombre: { type: 'string' },
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      codigo: { type: 'string' },
                      descripcion: { type: 'string' },
                      unidad: { type: 'string' },
                      cantidad: { type: 'number' },
                      pu_mat: { type: 'number' },
                      pu_mo: { type: 'number' },
                      avance_anterior_pct: { type: 'number' },
                      avance_actual_pct: { type: 'number' },
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    // 4. Normalizar valores
    if (!datos.titulo) datos.titulo = archivo_nombre?.replace(/\.(xlsx|xls)$/i, '') || 'Presupuesto importado';
    if (!datos.codigo) datos.codigo = `PPTO-${Date.now()}`;
    if (!datos.coef_pase || isNaN(datos.coef_pase)) datos.coef_pase = 1.6504;
    if (!datos.coef_oferta || isNaN(datos.coef_oferta)) datos.coef_oferta = 1.38;
    if (!Array.isArray(datos.rubros)) datos.rubros = [];

    datos.rubros = datos.rubros.map(r => ({
      ...r,
      nombre: r.nombre || 'GENERAL',
      items: (r.items || []).map(i => ({
        ...i,
        cantidad: Number(i.cantidad) || 0,
        pu_mat: Number(i.pu_mat) || 0,
        pu_mo: Number(i.pu_mo) || 0,
        avance_anterior_pct: Number(i.avance_anterior_pct) || 0,
        avance_actual_pct: Number(i.avance_actual_pct) || 0,
      }))
    })).filter(r => r.items.length > 0);

    // 5. Guardar en base de datos
    const nuevo = await base44.asServiceRole.entities.PresupuestoObraEnhanced.create({
      titulo: datos.titulo,
      codigo: datos.codigo,
      licitacion: datos.licitacion || '',
      cliente_nombre: datos.cliente_nombre || '',
      escuela: datos.escuela || '',
      direccion_obra: datos.direccion_obra || '',
      inspector: datos.inspector || '',
      responsable: datos.responsable || '',
      mtom: datos.mtom || '',
      coef_pase: datos.coef_pase,
      coef_oferta: datos.coef_oferta,
      plazo_dias: datos.plazo ? parseInt(datos.plazo) || null : null,
      rubros: datos.rubros,
      archivo_url: file_url,
      archivo_nombre: archivo_nombre || 'presupuesto.xlsx',
      estado: 'borrador',
    });

    return Response.json({
      success: true,
      presupuesto: nuevo,
      stats: {
        rubros: datos.rubros.length,
        items: datos.rubros.reduce((a, r) => a + r.items.length, 0),
      }
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});