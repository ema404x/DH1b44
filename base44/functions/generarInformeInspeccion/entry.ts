import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { inspeccion_id } = await req.json();
  if (!inspeccion_id) return Response.json({ error: 'inspeccion_id requerido' }, { status: 400 });

  const inspeccion = await base44.entities.InspeccionColegio.get(inspeccion_id);
  if (!inspeccion) return Response.json({ error: 'No encontrado' }, { status: 404 });

  const preciarioItems = await base44.entities.PrecarioMinisterio.filter({ activo: true }, 'categoria', 300);

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
      const fotosUrls = s.fotos?.length > 0
        ? `Fotos adjuntas (${fotosCount}): ${s.fotos.map((u, i) => `Foto ${i + 1}: ${u}`).join(' | ')}`
        : `Fotos adjuntas: 0`;
      partes.push(fotosUrls);
      partes.push(`Estado: ${s.completada ? 'COMPLETADA' : 'PENDIENTE / NO RELEVADA'}`);
      return `### SECCIÓN: ${s.nombre}\n${partes.join('\n') || 'Sin observaciones registradas.'}`;
    }).join('\n\n');

  const seccionesCompletadas = (inspeccion.secciones || []).filter(s => s.completada).map(s => s.nombre);
  const seccionesPendientes = (inspeccion.secciones || []).filter(s => !s.completada).map(s => s.nombre);
  const totalSecciones = (inspeccion.secciones || []).length;
  const totalFotos = (inspeccion.secciones || []).reduce((acc, s) => acc + (s.fotos?.length || 0), 0);

  const prompt = `Sos un ingeniero civil senior especializado en inspección de establecimientos educativos públicos de la Ciudad de Buenos Aires. Tenés más de 20 años de experiencia en mantenimiento edilicio, normativa de seguridad escolar (Resoluciones del GCBA), habilitaciones y gestión de obras del Ministerio de Educación.

Tu tarea es redactar un INFORME TÉCNICO DE INSPECCIÓN EDILICIA completo, formal, exhaustivo y sin omisiones. El informe debe servir como documento oficial para la toma de decisiones de la autoridad supervisora y como constancia legal de lo inspeccionado.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DATOS DE LA INSPECCIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Establecimiento: ${inspeccion.establecimiento}
Dirección: ${inspeccion.direccion || 'No especificada'}
Jefe de sitio: ${inspeccion.jefe_sitio}
Fecha de inspección: ${inspeccion.fecha_inspeccion || new Date().toLocaleDateString('es-AR')}
Inspector responsable: ${user.full_name || inspeccion.jefe_sitio}
Secciones completadas: ${seccionesCompletadas.length} de ${totalSecciones}
Secciones relevadas: ${seccionesCompletadas.length > 0 ? seccionesCompletadas.join(', ') : 'Ninguna'}
Secciones pendientes: ${seccionesPendientes.length > 0 ? seccionesPendientes.join(', ') : 'Todas completadas'}
Total de fotografías relevadas: ${totalFotos}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OBSERVACIONES RELEVADAS POR SECCIÓN (con fotos y notas)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${seccionesTexto}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRECIARIO MINISTERIAL DISPONIBLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${preciarioTexto}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSTRUCCIONES PARA REDACTAR EL INFORME
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generá el informe con EXACTAMENTE los siguientes apartados. No saltees ninguno. Si una sección no tiene datos, escribí "Sin novedades en esta sección."

# INFORME TÉCNICO DE INSPECCIÓN EDILICIA

## 1. Datos Generales
Tabla completa con los siguientes campos: Establecimiento, Dirección, Jefe de sitio, Inspector responsable, Fecha de inspección, Secciones relevadas, Secciones pendientes, Total de fotografías, Estado general del establecimiento (Bueno / Regular / Deficiente / Crítico — evaluá vos según los hallazgos).

## 2. Resumen Ejecutivo
Redactá 5 a 8 oraciones describiendo con precisión: el estado general del edificio, los sistemas más afectados (estructura, instalaciones eléctricas, sanitarias, etc.), los hallazgos más críticos con ubicación exacta, el nivel de urgencia global y la conclusión principal. Este resumen debe poder leerse de forma autónoma como síntesis ejecutiva del informe completo. Usá terminología técnica propia de la ingeniería civil.

## 3. Detalle por Sección Relevada

Para CADA sección que fue inspeccionada y marcada como COMPLETADA, creá una subsección con el siguiente formato:

### 3.X [Nombre de la Sección]
- **Estado general de la sección:** Bueno / Regular / Deficiente / Crítico
- **Descripción técnica:** Describí en detalle qué se observó en esta sección (materiales, estado de conservación, patologías edilicias detectadas, funcionamiento de instalaciones, etc.)
- **Problemas detectados:**
  1. [Descripción precisa del problema — ubicación exacta — dimensión estimada si aplica]
  2. ...
- **Nivel de urgencia por problema:**
  - Problema 1: 🔴 URGENTE / 🟡 IMPORTANTE / 🟢 LEVE / ✅ SIN NOVEDAD
  - ...
- **Evidencia fotográfica:** Indicá cuántas fotos fueron tomadas en esta sección y describí brevemente qué documenta cada una (inferirlo de las observaciones). Si hay URLs de fotos disponibles, mencioná que están disponibles como adjuntos digitales.

## 4. Secciones No Relevadas / Pendientes de Inspección
Si hay secciones que NO se completaron, listarlas con una nota clara indicando que quedaron pendientes y deben relevarse en la próxima visita. Si todas fueron completadas, indicarlo con esa misma frase.

## 5. Cuadro Consolidado de Problemas Detectados
Completá la siguiente tabla con TODOS los problemas encontrados en la inspección, ordenados de mayor a menor urgencia:

| N° | Sección | Descripción del problema | Urgencia | Estado actual |
|----|---------|--------------------------|----------|---------------|
| 1 | ... | ... | 🔴 URGENTE | Pendiente de resolución |
| ... | ... | ... | ... | ... |

Si no se detectaron problemas, indicarlo en la tabla con una fila que diga "Sin problemas detectados".

## 6. Análisis de Riesgos para la Seguridad
Listá todos los problemas que representen riesgo real para la seguridad de alumnos, docentes o personal. Para cada uno indicá:
- Descripción del riesgo
- Población afectada (alumnos / docentes / personal de mantenimiento / todos)
- Consecuencia potencial si no se resuelve
- Nivel de criticidad (CRÍTICO / ALTO / MEDIO / BAJO)

Si no hay riesgos identificados, indicarlo explícitamente.

## 7. Recomendaciones y Plan de Acción
Para cada problema urgente o importante, indicá:
- **Acción técnica concreta:** qué trabajo hay que realizar (ej: "Reemplazo de luminaria tipo LED 2x40W", "Reparación de cielorraso con yeso y pintura látex")
- **Plazo sugerido:** Inmediato (dentro de 48h) / Urgente (7 días) / Normal (30 días) / Diferible (próximo ciclo)
- **Responsable sugerido:** Jefe de sitio / Contratista especializado / Inspección técnica ministerial
- **Estimación de recursos:** si podés estimarlo con el preciario disponible, indicalo

## 8. Materiales y Trabajos según Preciario Ministerial
Basándote en los problemas detectados y el preciario disponible, completá la siguiente tabla. Incluí TODOS los ítems necesarios para resolver los problemas identificados:

| Código | Descripción del ítem | Unidad | Cantidad est. | Sección | Observación |
|--------|---------------------|--------|---------------|---------|-------------|
| ... | ... | ... | ... | ... | ... |

Si no encontrás el código exacto en el preciario, usá el más cercano e indicalo en la columna Observación. Si no se detectaron trabajos, escribí "No se requieren trabajos en este período."

## 9. Registro Fotográfico
Creá un registro detallado de las fotos tomadas:

| N° | Sección | Descripción de lo fotografiado | Cantidad de fotos |
|----|---------|--------------------------------|-------------------|
| 1 | ... | ... | ... |

Total de fotografías de la inspección: ${totalFotos}
Indicá para cada sección si hay fotos disponibles como adjuntos digitales en el sistema.

## 10. Conclusión y Próximos Pasos
- **Evaluación final del estado edilicio:** puntaje de 1 a 10 (1=ruinoso, 10=óptimo) con justificación técnica de 2-3 oraciones
- **Clasificación del establecimiento:** Apto sin observaciones / Apto con observaciones menores / Apto condicionado a reparaciones / No apto (requiere intervención inmediata)
- **Acciones prioritarias inmediatas** (lista numerada, máximo 5 ítems)
- **Fecha sugerida para próxima inspección de seguimiento**
- **Secciones pendientes** que deben relevarse en la próxima visita (si las hubiera)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGLAS DE REDACCIÓN OBLIGATORIAS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Usá lenguaje técnico formal de ingeniería civil. Nada de lenguaje coloquial.
- NO omitás ninguna sección del informe.
- Sé MUY específico: qué problema, DÓNDE exactamente (sala, piso, orientación), CUÁL es la dimensión estimada y CUÁL es el riesgo.
- Inferí información técnica razonable a partir de las notas y audios: si dicen "goteras en el techo", describí como "filtraciones en cubierta con posible deterioro de membrana impermeabilizante".
- Las tablas deben completarse íntegramente. Sin filas con solo puntos suspensivos.
- Los niveles de urgencia deben ser coherentes con la gravedad real del problema.
- Si la inspección fue muy completa y hay muchas notas, el informe debe ser proporcionalmente extenso.
- El informe debe ser autosuficiente: alguien que NO estuvo en la inspección debe poder entender TODO.
- NO incluyas al final ningún bloque de firma, ni campos como "Firma:", "Aclaración:", "Nombre:". El informe termina con la sección 10.
- NO uses frases vagas. Reemplazá "se observaron problemas" por descripciones técnicas precisas.`;

  const result = await base44.integrations.Core.InvokeLLM({
    prompt,
    model: 'claude_sonnet_4_6',
    file_urls: (() => {
      const allFotos = (inspeccion.secciones || []).flatMap(s => s.fotos || []);
      return allFotos.length > 0 ? allFotos.slice(0, 20) : undefined;
    })(),
  });

  try {
    await base44.entities.InspeccionColegio.update(inspeccion_id, {
      informe_generado: result,
      estado: 'completado',
    });
  } catch (e) {
    if (e.message?.includes('maximum allowed size')) {
      const blob = new Blob([result], { type: 'text/plain' });
      const file = new File([blob], 'informe.txt', { type: 'text/plain' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
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