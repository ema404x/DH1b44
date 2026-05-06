import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { inspeccion_id } = await req.json();
  if (!inspeccion_id) return Response.json({ error: 'inspeccion_id requerido' }, { status: 400 });

  const inspeccion = await base44.entities.InspeccionColegio.get(inspeccion_id);
  if (!inspeccion) return Response.json({ error: 'No encontrado' }, { status: 404 });

  const preciarioItems = await base44.entities.PrecarioMinisterio.filter({ activo: true, comuna: '8A' }, 'categoria', 300);

  const preciarioTexto = preciarioItems.length > 0
    ? preciarioItems.map(p =>
        `[${p.codigo}] ${p.descripcion} | Unidad: ${p.unidad} | Cat: ${p.categoria}${p.subcategoria ? ' / ' + p.subcategoria : ''}`
      ).join('\n')
    : 'No hay preciario cargado.';

  const seccionesTexto = (inspeccion.secciones || [])
    .map(s => {
      const partes = [];
      if (s.transcripcion) partes.push(`Audio transcripto: ${s.transcripcion}`);
      if (s.notas_libres) partes.push(`Notas escritas: ${s.notas_libres}`);
      const fotosCount = s.fotos?.length || 0;
      partes.push(`Fotos adjuntas: ${fotosCount}`);
      partes.push(`Estado de sección: ${s.completada ? 'COMPLETADA' : 'NO COMPLETADA / PENDIENTE'}`);
      return `### SECCIÓN: ${s.nombre}\n${partes.join('\n') || 'Sin observaciones registradas'}`;
    }).join('\n\n');

  const seccionesCompletadas = (inspeccion.secciones || []).filter(s => s.completada).map(s => s.nombre);
  const seccionesPendientes = (inspeccion.secciones || []).filter(s => !s.completada).map(s => s.nombre);
  const totalSecciones = (inspeccion.secciones || []).length;

  const prompt = `Sos un ingeniero civil senior especializado en inspección de establecimientos educativos públicos, con amplia experiencia en mantenimiento edilicio, normativa de seguridad escolar y gestión de obras del Ministerio de Educación de la Ciudad de Buenos Aires.

Tu tarea es redactar un INFORME TÉCNICO DE INSPECCIÓN exhaustivo, formal y completamente detallado, sin omitir ningún dato relevante. El informe debe ser útil para la toma de decisiones de la autoridad supervisora y debe dejar constancia explícita tanto de lo inspeccionado como de lo pendiente.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DATOS DE LA INSPECCIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Establecimiento: ${inspeccion.establecimiento}
Dirección: ${inspeccion.direccion || 'No especificada'}
Jefe de sitio: ${inspeccion.jefe_sitio}
Fecha de inspección: ${inspeccion.fecha_inspeccion || new Date().toLocaleDateString('es-AR')}
Inspector responsable: ${user.full_name || inspeccion.jefe_sitio}
Secciones relevadas: ${seccionesCompletadas.length} de ${totalSecciones}
Secciones completadas: ${seccionesCompletadas.length > 0 ? seccionesCompletadas.join(', ') : 'Ninguna'}
Secciones NO relevadas / pendientes: ${seccionesPendientes.length > 0 ? seccionesPendientes.join(', ') : 'Todas completadas'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OBSERVACIONES RELEVADAS POR SECCIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${seccionesTexto}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRECIARIO MINISTERIAL DISPONIBLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${preciarioTexto}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSTRUCCIONES PARA REDACTAR EL INFORME
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generá el informe con EXACTAMENTE los siguientes apartados, sin saltear ninguno:

# INFORME TÉCNICO DE INSPECCIÓN EDILICIA

## 1. Datos Generales
Tabla resumen con: establecimiento, dirección, jefe de sitio, inspector, fecha, cantidad de secciones relevadas vs totales, estado general (Bueno / Regular / Deficiente / Crítico).

## 2. Resumen Ejecutivo
Párrafo de 4 a 6 oraciones describiendo el estado general del establecimiento, los hallazgos más relevantes, nivel de urgencia global y conclusión ejecutiva. Debe poder leerse de forma autónoma como síntesis del informe.

## 3. Detalle por Sección Relevada
Para CADA sección que fue inspeccionada, incluí una subsección con:
- **Estado general:** (Bueno / Regular / Deficiente / Crítico)
- **Observaciones:** descripción detallada de todo lo observado
- **Problemas detectados:** lista numerada de cada problema encontrado
- **Nivel de urgencia de cada problema:** 🔴 URGENTE / 🟡 IMPORTANTE / 🟢 LEVE / ✅ SIN NOVEDAD
- **Fotos:** indicar si hay fotos adjuntas y cuántas

## 4. Secciones No Relevadas / Pendientes
Si hay secciones que NO fueron inspeccionadas, listarlas explícitamente con una nota indicando que quedaron pendientes de inspección y deben incluirse en la próxima visita. Si todas fueron completadas, indicarlo.

## 5. Cuadro Consolidado de Problemas Detectados
Tabla con TODOS los problemas encontrados en toda la inspección, ordenados por urgencia:

| N° | Sección | Problema | Urgencia | Estado |
|----|---------|----------|----------|--------|
| ... | ... | ... | 🔴 URGENTE / 🟡 IMPORTANTE / 🟢 LEVE | Pendiente de resolución |

## 6. Análisis de Riesgos
Lista de los problemas que representan riesgo para la seguridad de alumnos y personal, con descripción del riesgo potencial. Si no hay riesgos críticos, indicarlo explícitamente.

## 7. Recomendaciones y Plan de Acción
Para cada problema urgente o importante, indicar:
- Acción concreta a realizar
- Plazo sugerido (Inmediato / 7 días / 30 días / Próximo ciclo)
- Responsable sugerido

## 8. Materiales y Trabajos según Preciario Ministerial
Basándote en los problemas detectados y el preciario disponible, armá la tabla completa:

| Código | Descripción del ítem | Unidad | Cantidad est. | Sección | Observación |
|--------|---------------------|--------|---------------|---------|-------------|
| ... | ... | ... | ... | ... | ... |

Si no encontrás el ítem exacto, usá el más cercano e indicalo en Observación. Incluí todos los ítems necesarios.

## 9. Resumen Fotográfico
Indicar por sección la cantidad de fotos tomadas y una descripción breve de qué documentan (inferirlo de las observaciones). Total de fotos: X.

## 10. Conclusión y Próximos Pasos
- Evaluación final del estado del establecimiento con puntaje general (1 a 10)
- Lista de acciones prioritarias inmediatas
- Fecha sugerida para próxima inspección de seguimiento
- Secciones pendientes que deben relevarse en la próxima visita

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGLAS DE REDACCIÓN OBLIGATORIAS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Usá lenguaje técnico formal, como lo haría un ingeniero civil en un informe oficial
- NO omitás ninguna sección del informe aunque no haya problemas (en ese caso indicar "Sin novedades")
- NO uses frases vagas como "se observaron problemas" — sé específico sobre QUÉ problema, DÓNDE exactamente, y CUÁL es el riesgo
- Si una sección no fue relevada, SIEMPRE dejá constancia explícita de ello
- Las tablas deben completarse íntegramente, sin filas vacías ni puntos suspensivos
- Los niveles de urgencia deben ser coherentes con la gravedad real del problema
- El informe debe ser autosuficiente: alguien que no estuvo en la inspección debe poder entender todo leyéndolo`;

  const result = await base44.integrations.Core.InvokeLLM({
    prompt,
    model: 'claude_sonnet_4_6',
  });

  // El informe puede ser muy largo — intentar guardar directo primero,
  // si falla por tamaño, subirlo como archivo y guardar la URL
  try {
    await base44.entities.InspeccionColegio.update(inspeccion_id, {
      informe_generado: result,
      estado: 'completado',
    });
  } catch (e) {
    if (e.message?.includes('maximum allowed size')) {
      // Subir el texto como archivo .txt
      const blob = new Blob([result], { type: 'text/plain' });
      const file = new File([blob], 'informe.txt', { type: 'text/plain' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      // Guardar un resumen truncado + la URL del archivo completo
      const resumen = result.substring(0, 3000) + '\n\n---\n⚠️ El informe completo fue guardado como archivo. URL: ' + file_url;
      await base44.entities.InspeccionColegio.update(inspeccion_id, {
        informe_generado: resumen,
        estado: 'completado',
      });
    } else {
      throw e;
    }
  }

  return Response.json({ informe: result });
});