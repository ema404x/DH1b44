import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { inspeccion_id } = await req.json();
  if (!inspeccion_id) return Response.json({ error: 'inspeccion_id requerido' }, { status: 400 });

  const inspeccion = await base44.entities.InspeccionColegio.get(inspeccion_id);
  if (!inspeccion) return Response.json({ error: 'No encontrado' }, { status: 404 });

  // Obtener preciario relevante (hasta 300 ítems para no saturar el prompt)
  const preciarioItems = await base44.entities.PrecarioMinisterio.filter({ activo: true, comuna: '8A' }, 'categoria', 300);

  const preciarioTexto = preciarioItems.length > 0
    ? preciarioItems.map(p =>
        `[${p.codigo}] ${p.descripcion} | Unidad: ${p.unidad} | Cat: ${p.categoria}${p.subcategoria ? ' / ' + p.subcategoria : ''}`
      ).join('\n')
    : 'No hay preciario cargado.';

  const seccionesTexto = (inspeccion.secciones || [])
    .map(s => {
      const partes = [];
      if (s.transcripcion) partes.push(`Audio: ${s.transcripcion}`);
      if (s.notas_libres) partes.push(`Notas: ${s.notas_libres}`);
      const fotosCount = s.fotos?.length || 0;
      if (fotosCount > 0) partes.push(`Fotos adjuntas: ${fotosCount}`);
      return `## ${s.nombre}\n${partes.join('\n') || 'Sin observaciones'}`;
    }).join('\n\n');

  const prompt = `Sos un profesional en inspección de establecimientos educativos con amplio conocimiento en construcción y mantenimiento edilicio.
Generá un informe técnico formal de inspección en base a las observaciones del jefe de sitio.

Establecimiento: ${inspeccion.establecimiento}
Dirección: ${inspeccion.direccion || 'No especificada'}
Jefe de sitio: ${inspeccion.jefe_sitio}
Fecha: ${inspeccion.fecha_inspeccion || new Date().toLocaleDateString('es-AR')}

OBSERVACIONES POR SECCIÓN:
${seccionesTexto}

PRECIARIO MINISTERIAL DISPONIBLE (para armar el listado de materiales):
${preciarioTexto}

Generá un informe técnico estructurado con los siguientes apartados exactos:

# INFORME TÉCNICO DE INSPECCIÓN

## 1. Resumen Ejecutivo
Síntesis general del estado del establecimiento.

## 2. Detalle por Sección
Para cada sección inspeccionada: estado observado, problemas detectados y nivel de urgencia (Urgente / Importante / Leve / Sin novedad).

## 3. Problemas Detectados
Lista de los problemas encontrados ordenados por urgencia.

## 4. Recomendaciones y Acciones Sugeridas
Acciones concretas recomendadas.

## 5. Listado de Materiales y Trabajos (según Preciario Ministerial)
Basándote en los problemas detectados y el preciario disponible, armá una tabla con los ítems del preciario que se necesitarían para resolver los trabajos. Usá EXACTAMENTE este formato de tabla Markdown:

| Código | Descripción | Unidad | Cantidad estimada | Observación |
|--------|-------------|--------|-------------------|-------------|
| ... | ... | ... | ... | ... |

Solo incluí ítems que realmente apliquen a las observaciones. Si no encontrás el ítem exacto en el preciario, indicá el más cercano. Si no hay problemas que requieran materiales, indicalo.

## 6. Conclusión
Evaluación final del estado general y próximos pasos.

Usá un tono profesional y formal. El informe debe ser claro y accionable.`;

  const result = await base44.integrations.Core.InvokeLLM({
    prompt,
    model: 'claude_sonnet_4_6',
  });

  await base44.entities.InspeccionColegio.update(inspeccion_id, {
    informe_generado: result,
    estado: 'completado',
  });

  return Response.json({ informe: result });
});