import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import * as XLSX from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url, archivo_nombre } = await req.json();
    if (!file_url) return Response.json({ error: 'file_url required' }, { status: 400 });

    // 1. Descargar el archivo Excel
    const fileRes = await fetch(file_url);
    if (!fileRes.ok) return Response.json({ error: 'No se pudo descargar el archivo' }, { status: 400 });
    const arrayBuffer = await fileRes.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // 2. Parsear con xlsx (SheetJS)
    const workbook = XLSX.read(uint8Array, { type: 'array' });

    // 3. Convertir todas las hojas a texto plano
    let textoHojas = '';
    for (const sheetName of workbook.SheetNames) {
      const ws = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false });
      const lines = csv.split('\n')
        .map(l => l.trim())
        .filter(l => l && l.replace(/,/g, '').trim());
      if (lines.length > 0) {
        textoHojas += `=== HOJA: ${sheetName} ===\n${lines.slice(0, 200).join('\n')}\n\n`;
      }
    }

    const textoTotal = textoHojas.slice(0, 28000);

    if (!textoTotal.trim()) {
      return Response.json({ error: 'El Excel está vacío o no se pudo leer su contenido' }, { status: 400 });
    }

    // 4. IA extrae la estructura del presupuesto
    const datos = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Sos un experto en presupuestos de obras de construcción argentina (GCBA, Ministerio Educación, formato PCP/PAPORC/PAMON).

Analizá este contenido extraído de un Excel de presupuesto de obra y extraé toda la información estructurada.

CONTENIDO DEL EXCEL (formato CSV por hoja):
${textoTotal}

INSTRUCCIONES:
- titulo: descripción o nombre de la obra
- codigo: número o código del presupuesto
- licitacion: número de licitación si aparece
- cliente_nombre: comitente u organismo contratante
- escuela: nombre del establecimiento educativo si aplica
- direccion_obra: dirección de la obra
- inspector: nombre del inspector
- responsable: supervisor o responsable técnico
- mtom: número MTOM si aparece
- coef_pase: coeficiente de pase (número decimal, default 1.6504)
- coef_oferta: coeficiente de oferta (número decimal, default 1.38)
- plazo: plazo de obra en texto
- rubros: array de capítulos/secciones con sus ítems

Para cada ÍTEM:
- codigo: código alfanumérico
- descripcion: descripción completa
- unidad: unidad de medida (m2, ml, gl, kg, etc)
- cantidad: número
- pu_mat: precio unitario materiales (si hay un solo PU, usarlo aquí)
- pu_mo: precio unitario mano de obra (0 si no se distingue)

IMPORTANTE: Ignorar filas de TOTALES, SUBTOTALES y ENCABEZADOS. Si no hay rubros claros usar un rubro "GENERAL".`,
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
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    // 5. Normalizar
    if (!datos.titulo) datos.titulo = archivo_nombre?.replace(/\.(xlsx|xls)$/i, '') || 'Presupuesto importado';
    if (!datos.codigo) datos.codigo = `PPTO-${Date.now()}`;
    if (!datos.coef_pase || isNaN(datos.coef_pase)) datos.coef_pase = 1.6504;
    if (!datos.coef_oferta || isNaN(datos.coef_oferta)) datos.coef_oferta = 1.38;
    if (!Array.isArray(datos.rubros)) datos.rubros = [];

    datos.rubros = datos.rubros
      .map(r => ({
        nombre: r.nombre || 'GENERAL',
        items: (r.items || []).map(i => ({
          codigo: i.codigo || '',
          descripcion: i.descripcion || '',
          unidad: i.unidad || '',
          cantidad: Number(i.cantidad) || 0,
          pu_mat: Number(i.pu_mat) || 0,
          pu_mo: Number(i.pu_mo) || 0,
          avance_anterior_pct: 0,
          avance_actual_pct: 0,
        }))
      }))
      .filter(r => r.items.length > 0);

    if (datos.rubros.length === 0) {
      datos.rubros = [{ nombre: 'GENERAL', items: [] }];
    }

    // 6. Guardar en BD
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