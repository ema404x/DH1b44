import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { inspeccion_id } = body;
  if (!inspeccion_id) return Response.json({ error: 'inspeccion_id requerido' }, { status: 400 });

  const inspeccion = await base44.entities.InspeccionColegio.get(inspeccion_id);
  if (!inspeccion) return Response.json({ error: 'No encontrado' }, { status: 404 });

  // Preciario en paralelo con la preparación del contexto
  const preciarioItems = await base44.entities.PrecarioMinisterio.filter({ activo: true }, 'categoria', 200);

  const preciarioTexto = preciarioItems.length > 0
    ? preciarioItems
        .slice(0, 150) // top 150 ítems más relevantes
        .map(p => `[${p.codigo}] ${p.descripcion} | ${p.unidad} | ${p.categoria}${p.subcategoria ? '/' + p.subcategoria : ''}`)
        .join('\n')
    : 'Sin preciario cargado.';

  const fechaFormateada = inspeccion.fecha_inspeccion
    ? new Date(inspeccion.fecha_inspeccion + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });

  const secciones = inspeccion.secciones || [];
  const seccionesCompletadas = secciones.filter(s => s.completada);
  const seccionesPendientes = secciones.filter(s => !s.completada).map(s => s.nombre);
  const totalFotos = secciones.reduce((acc, s) => acc + (s.fotos?.length || 0), 0);
  const allFotos = secciones.flatMap(s => s.fotos || []);

  // Construir detalle de secciones con máximo contexto
  const seccionesTexto = secciones.map(s => {
    const partes = [];
    if (s.transcripcion?.trim()) partes.push(`TRANSCRIPCIÓN DE AUDIO:\n${s.transcripcion.trim()}`);
    if (s.notas_libres?.trim()) partes.push(`NOTAS ADICIONALES:\n${s.notas_libres.trim()}`);
    const nFotos = s.fotos?.length || 0;
    partes.push(`Fotografías registradas: ${nFotos}${nFotos > 0 ? ' (adjuntas para análisis visual)' : ''}`);
    partes.push(`Estado de relevamiento: ${s.completada ? '✓ COMPLETADA' : '⚠ PENDIENTE / NO RELEVADA'}`);
    return `━━━ SECCIÓN: ${s.nombre.toUpperCase()} ━━━\n${partes.join('\n\n') || 'Sin observaciones registradas.'}`;
  }).join('\n\n');

  const prompt = `Sos un ingeniero senior del GCBA con 20 años de experiencia en inspección de establecimientos educativos públicos. Tu tarea es redactar un INFORME TÉCNICO DE INSPECCIÓN EDILICIA de máxima calidad profesional, basado en las observaciones de campo.

═══════════════════════════════════════
DATOS DE LA INSPECCIÓN
═══════════════════════════════════════
Establecimiento: ${inspeccion.establecimiento}
Dirección: ${inspeccion.direccion || 'No especificada'}
Inspector: ${user.full_name || inspeccion.jefe_sitio}
Jefe de sitio: ${inspeccion.jefe_sitio || 'No especificado'}
Fecha de inspección: ${fechaFormateada}
Secciones relevadas: ${seccionesCompletadas.length} de ${secciones.length}
Secciones completadas: ${seccionesCompletadas.map(s => s.nombre).join(', ') || 'Ninguna'}
Secciones pendientes: ${seccionesPendientes.join(', ') || 'Todas completadas'}
Fotografías registradas: ${totalFotos}

═══════════════════════════════════════
OBSERVACIONES RELEVADAS EN CAMPO
═══════════════════════════════════════
${seccionesTexto}

═══════════════════════════════════════
PRECIARIO MINISTERIAL DE REFERENCIA
═══════════════════════════════════════
${preciarioTexto}

═══════════════════════════════════════
INSTRUCCIONES PARA REDACCIÓN DEL INFORME
═══════════════════════════════════════

Redactá el informe completo usando EXACTAMENTE la siguiente estructura Markdown. Sé extremadamente específico, técnico y útil. Cada observación debe incluir ubicación exacta, descripción del problema, riesgo asociado y acción requerida.

# INFORME TÉCNICO DE INSPECCIÓN EDILICIA

## 1. Datos Generales

Tabla con los siguientes campos: Establecimiento | Dirección | Inspector | Jefe de Sitio | Fecha de Inspección | Secciones Relevadas | Total Fotografías | Estado General del Establecimiento (Bueno / Regular / Deficiente / Crítico).

## 2. Resumen Ejecutivo

Párrafo de 5-8 oraciones con terminología técnica de ingeniería civil. Describí: (a) estado integral del establecimiento, (b) sistemas o áreas más comprometidas, (c) hallazgos críticos que requieren atención inmediata, (d) nivel de riesgo general para los usuarios, (e) recomendación de aptitud. Sé directo y preciso, sin eufemismos.

## 3. Detalle por Sección Relevada

Para CADA sección COMPLETADA, redactá:

### 3.X [Nombre de la Sección]

**Estado:** Bueno / Regular / Deficiente / Crítico

**Descripción técnica:** Narrativa técnica detallada de lo observado (3-5 oraciones). Incluí materiales, dimensiones estimadas, sistemas afectados, y condición observada.

**Hallazgos y problemas detectados:**
Numerá cada problema con: ubicación exacta · descripción técnica · nivel de riesgo · urgencia de intervención.
Usá exactamente estos íconos de urgencia: 🔴 URGENTE (riesgo inmediato para personas) | 🟠 IMPORTANTE (requiere solución en 30 días) | 🟡 MODERADO (planificable en 90 días) | 🟢 LEVE (mejora programable)

**Fotografías de referencia:** Indicá cuántas fotos están disponibles y qué muestran (si hay fotos adjuntas, describí lo que observás en ellas).

## 4. Cuadro Consolidado de Hallazgos

Tabla completa con TODOS los problemas detectados, ordenados de mayor a menor urgencia:

| N° | Sección | Descripción del Problema | Ubicación | Urgencia | Estado Actual | Acción Requerida |
|---|---|---|---|---|---|---|

## 5. Plan de Acción y Estimación de Costos

Para cada problema URGENTE e IMPORTANTE, redactá una fila en esta tabla:

| N° | Problema | Acción Concreta | Plazo | Responsable | Cod. Preciario | Estimación |
|---|---|---|---|---|---|---|

Dónde: Plazo = Inmediato / 7 días / 30 días / 90 días. Responsable = Jefe de Sitio / Contratista / GCBA Central. Si el código preciario no aplica, escribí "N/A".

## 6. Conclusión y Clasificación Final

**Puntaje edilicio:** X/10 — Justificación técnica de 2-3 oraciones.

**Clasificación:**
- ✅ APTO: Sin restricciones de uso.
- ⚠️ APTO CON OBSERVACIONES: Uso habitual permitido, con plan de mejoras en ejecución.
- 🔶 APTO CONDICIONADO: Uso parcialmente restringido hasta subsanar observaciones críticas.
- 🚫 NO APTO: Clausura parcial o total recomendada hasta corrección de deficiencias críticas.

**Próxima inspección sugerida:** Fecha estimada y foco recomendado.

**Firma:** ${user.full_name || inspeccion.jefe_sitio} | Inspector | ${fechaFormateada}

═══════════════════════════════════════
REGLAS DE REDACCIÓN OBLIGATORIAS
═══════════════════════════════════════
1. Lenguaje técnico formal de ingeniería civil. Nunca uses frases vagas como "se observaron problemas" sin especificar cuáles.
2. Cada problema debe tener ubicación exacta (local N°, sector, planta, orientación).
3. Si la transcripción de audio menciona números de locales, matafuegos, hidrantes, nichos — incluilos TODOS en el informe.
4. Clasificá los problemas por sistema: protección contra incendio, instalaciones eléctricas, sanitario, estructura, etc.
5. El cuadro consolidado debe incluir absolutamente TODOS los problemas detectados, no solo los críticos.
6. Si hay fotos adjuntas, describí lo que se observa en ellas para enriquecer el informe.
7. Estimaciones de costo: usá el preciario si hay ítems aplicables. Si no, indicá "A presupuestar".
8. No incluyas comentarios meta sobre el informe. Empezá directamente con el título.`;

  const generateAsync = async () => {
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        // claude_sonnet_4_6: más rápido que gpt_5_4 y superior en redacción técnica larga
        model: 'claude_sonnet_4_6',
        file_urls: allFotos.length > 0 ? allFotos.slice(0, 15) : undefined,
      });

      await base44.entities.InspeccionColegio.update(inspeccion_id, {
        informe_generado: result,
        estado: 'completado',
      });
    } catch (err) {
      await base44.entities.InspeccionColegio.update(inspeccion_id, {
        estado: 'en_progreso',
        informe_generado: '',
      }).catch(() => {});
    }
  };

  setTimeout(() => generateAsync(), 0);

  return Response.json({ status: 'generating' });
});