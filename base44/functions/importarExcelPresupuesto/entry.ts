import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
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
    // Priorizar hoja PCP que contiene los datos del presupuesto real
    let textoHojas = '';
    const sheetOrder = ['PCP', ...workbook.SheetNames.filter(n => n !== 'PCP')];
    for (const sheetName of sheetOrder) {
      if (!workbook.SheetNames.includes(sheetName)) continue;
      const ws = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false });
      const lines = csv.split('\n')
        .map(l => l.trim())
        .filter(l => l && l.replace(/,/g, '').trim());
      if (lines.length > 0) {
        // Para PCP damos más líneas ya que es la hoja principal
        const maxLines = sheetName === 'PCP' ? 300 : 50;
        textoHojas += `=== HOJA: ${sheetName} ===\n${lines.slice(0, maxLines).join('\n')}\n\n`;
      }
    }

    const textoTotal = textoHojas.slice(0, 32000);

    if (!textoTotal.trim()) {
      return Response.json({ error: 'El Excel está vacío o no se pudo leer su contenido' }, { status: 400 });
    }

    // 4. IA extrae la estructura del presupuesto
    const datos = await base44.asServiceRole.integrations.Core.InvokeLLM({
      model: 'claude_sonnet_4_6',
      prompt: `Sos un experto en presupuestos de obras de construcción del GCBA (Gobierno de la Ciudad de Buenos Aires), formato PCP (Planilla de Cómputo y Presupuesto) / PAPORC / PAMON del Ministerio de Educación.

FORMATO REAL DEL EXCEL (hoja PCP):
- Las primeras filas son metadatos: COMITENTE, LICITACIÓN, zona (ej: "8 B"), empresa, Nº PRESUPUESTO, FECHA ingreso sap, DIRECCIÓN, ESCUELA, OBRA, MTOM Nº, SUPERVISOR, INSPECTOR, Coef. Pase, Coef. Oferta, PLAZO, Preciario Utilizado
- Luego viene la tabla de ítems con columnas: código preciario | descripción | UNID | CANT | P.U.MAT | P.U.M.O | TOTAL | precio actual sin IVA | coef deflador | precio deflacionado | coef total | coef oferta | PRECIO RESULTANTE | SUBTOTAL
- Los RUBROS son filas con solo texto en mayúsculas sin valores numéricos (ej: "DEMOLICIONES", "ALBAÑILERÍA", "ESTRUCTURAS DE HIERRO", "GENERALES - VOLQUETES - ANDAMIOS")
- Los ítems tienen un número (1.1, 1.2, 2.1, etc.) o código alfanumérico, descripción detallada, unidad, cantidad y precios

CONTENIDO DEL EXCEL (formato CSV):
${textoTotal}

EXTRAÉ:
- titulo: nombre/descripción de la OBRA (buscar campo "OBRA:" o similar, o armar desde la dirección/escuela)
- codigo: Nº PRESUPUESTO (ej: "14-26")
- licitacion: número de licitación (ej: "LICIT. PÚBLICA Nº 558-0002-LPU23")
- cliente_nombre: COMITENTE (ej: "GCBA - MINISTERIO DE EDUCACIÓN...")
- escuela: nombre del establecimiento (campo ESCUELA o DIRECCIÓN)
- direccion_obra: dirección completa
- inspector: INSPECTOR
- responsable: SUPERVISOR
- mtom: número MTOM (ej: "421172950")
- coef_pase: Coef. Pase (número decimal, default 1.6504)
- coef_oferta: Coef. Oferta (número decimal, default 1.38)
- plazo: plazo en días (ej: "60")
- rubros: array de rubros, cada uno con su nombre y sus ítems

Para cada ÍTEM extraé:
- codigo: código del preciario (ej: "DMDE004", "MS0628", "s/n")
- descripcion: descripción completa del trabajo
- unidad: unidad de medida (M2, M3, UN, HR, HH, ML, KG, GL, etc.)
- cantidad: cantidad numérica
- pu_mat: P.U.MAT (precio unitario materiales, número)
- pu_mo: P.U.M.O (precio unitario mano de obra, número)

REGLAS CRÍTICAS:
1. Los rubros son encabezados en MAYÚSCULAS sin números de ítem ni precios
2. Ignorar filas de TOTAL, SUBTOTAL, TOTAL PRESUPUESTO
3. Ignorar filas de encabezado de tabla (UNID, CANT, P.U.MAT, etc.)
4. Los ítems con "s/n" en código son válidos (sin número de preciario)
5. Si P.U.MAT y P.U.M.O están ambos en 0 pero hay un precio fuera de preciario (columna separada), usarlo en pu_mat
6. Mantener el orden real de rubros e ítems del Excel`,
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