import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { inspeccion_id } = await req.json();
  if (!inspeccion_id) return Response.json({ error: 'inspeccion_id requerido' }, { status: 400 });

  const inspeccion = await base44.entities.InspeccionColegio.get(inspeccion_id);
  if (!inspeccion) return Response.json({ error: 'No encontrado' }, { status: 404 });

  const seccionesTexto = (inspeccion.secciones || [])
    .map(s => {
      const partes = [];
      if (s.transcripcion) partes.push(`Audio: ${s.transcripcion}`);
      if (s.notas_libres) partes.push(`Notas: ${s.notas_libres}`);
      const fotosCount = s.fotos?.length || 0;
      if (fotosCount > 0) partes.push(`Fotos adjuntas: ${fotosCount}`);
      return `## ${s.nombre}\n${partes.join('\n') || 'Sin observaciones'}`;
    }).join('\n\n');

  const prompt = `Sos un profesional en inspección de establecimientos educativos. 
Generá un informe técnico formal de inspección en base a las observaciones del jefe de sitio.

Establecimiento: ${inspeccion.establecimiento}
Dirección: ${inspeccion.direccion || 'No especificada'}
Jefe de sitio: ${inspeccion.jefe_sitio}
Fecha: ${inspeccion.fecha_inspeccion || new Date().toLocaleDateString('es-AR')}

OBSERVACIONES POR SECCIÓN:
${seccionesTexto}

Generá un informe técnico estructurado con:
1. Resumen ejecutivo
2. Detalle por sección con estado y observaciones
3. Problemas detectados (si los hay)
4. Recomendaciones y acciones sugeridas
5. Conclusión

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