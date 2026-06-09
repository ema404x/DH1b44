import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Esta función hace TODO el trabajo en una sola llamada.
// El frontend la llama sin await y hace polling a la DB cada 5s.
// gemini_3_1_pro: soporta imágenes + contexto largo + más rápido que claude para outputs extensos.

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { inspeccion_id } = body;
  if (!inspeccion_id) return Response.json({ error: 'inspeccion_id requerido' }, { status: 400 });

  const inspeccion = await base44.entities.InspeccionColegio.get(inspeccion_id);
  if (!inspeccion) return Response.json({ error: 'No encontrado' }, { status: 404 });

  const preciarioItems = await base44.entities.PrecarioMinisterio.filter({ activo: true }, 'categoria', 200);

  const preciarioTexto = preciarioItems.length > 0
    ? preciarioItems.slice(0, 100)
        .map(p => `[${p.codigo}] ${p.descripcion} | ${p.unidad} | ${p.categoria}`)
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

  const seccionesTexto = secciones.map(s => {
    const partes = [];
    if (s.transcripcion?.trim()) partes.push(`TRANSCRIPCIÓN:\n${s.transcripcion.trim()}`);
    if (s.notas_libres?.trim()) partes.push(`NOTAS:\n${s.notas_libres.trim()}`);
    partes.push(`Fotos: ${s.fotos?.length || 0} | Estado: ${s.completada ? '✓ COMPLETADA' : '⚠ PENDIENTE'}`);
    return `=== ${s.nombre.toUpperCase()} ===\n${partes.join('\n\n') || 'Sin observaciones.'}`;
  }).join('\n\n');

  const prompt = `Sos un ingeniero senior del GCBA especializado en inspección de establecimientos educativos. Redactá un INFORME TÉCNICO DE INSPECCIÓN EDILICIA profesional y completo.

DATOS:
- Establecimiento: ${inspeccion.establecimiento}
- Dirección: ${inspeccion.direccion || 'No especificada'}
- Inspector: ${user.full_name || inspeccion.jefe_sitio}
- Jefe de sitio: ${inspeccion.jefe_sitio}
- Fecha: ${fechaFormateada}
- Secciones completadas: ${seccionesCompletadas.map(s => s.nombre).join(', ') || 'Ninguna'}
- Secciones pendientes: ${seccionesPendientes.join(', ') || 'Ninguna'}
- Fotografías: ${totalFotos}

OBSERVACIONES DE CAMPO:
${seccionesTexto}

PRECIARIO DE REFERENCIA:
${preciarioTexto}

ESTRUCTURA OBLIGATORIA (Markdown):

# INFORME TÉCNICO DE INSPECCIÓN EDILICIA

## 1. Datos Generales
Tabla: Establecimiento | Dirección | Inspector | Jefe de Sitio | Fecha | Secciones Relevadas | Fotos | Estado General (Bueno/Regular/Deficiente/Crítico)

## 2. Resumen Ejecutivo
5-7 oraciones técnicas: estado integral, sistemas comprometidos, hallazgos críticos, nivel de riesgo, recomendación de aptitud.

## 3. Detalle por Sección Relevada
Por cada sección COMPLETADA:
### 3.X [Nombre]
- **Estado:** Bueno/Regular/Deficiente/Crítico
- **Descripción técnica:** qué se observó (3-4 oraciones con terminología de ingeniería civil)
- **Hallazgos detectados:** lista numerada con ubicación exacta (local N°, sector) + 🔴 URGENTE / 🟠 IMPORTANTE / 🟡 MODERADO / 🟢 LEVE

## 4. Cuadro Consolidado de Hallazgos
GENERA ÚNICAMENTE UNA TABLA MARKDOWN con esta estructura exacta (no escribas texto antes ni después de la tabla):

| N° | Sección | Problema detectado | Ubicación | Urgencia | Acción requerida |
| :---: | :--- | :--- | :--- | :---: | :--- |
| 1 | [sección] | [problema concreto] | [local/sector] | 🔴 URGENTE | [acción] |
| 2 | [sección] | [problema concreto] | [local/sector] | 🟠 IMPORTANTE | [acción] |
| 3 | [sección] | [problema concreto] | [local/sector] | 🟡 MODERADO | [acción] |
| 4 | [sección] | [problema concreto] | [local/sector] | 🟢 LEVE | [acción] |

Reglas para esta sección: (a) una fila por cada problema individual detectado; (b) ordenado de mayor a menor urgencia; (c) la fila de separador con :--- es OBLIGATORIA después del encabezado; (d) ningún texto fuera de la tabla.

## 5. Plan de Acción
| N° | Problema | Acción | Plazo | Responsable | Cód. Preciario |
Solo problemas URGENTES e IMPORTANTES. Plazo: Inmediato/7 días/30 días.

## 6. Conclusión
- **Puntaje edilicio:** X/10 con justificación técnica
- **Clasificación:** ✅ APTO / ⚠️ APTO CON OBSERVACIONES / 🔶 APTO CONDICIONADO / 🚫 NO APTO
- **Próxima inspección:** fecha sugerida y foco

**Firma:** ${user.full_name || inspeccion.jefe_sitio} | ${fechaFormateada}

REGLAS: Sé específico con números de locales y sectores. Incluí TODOS los ítems mencionados en las transcripciones. Lenguaje técnico formal. Sin frases vagas.`;

  try {
    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      model: 'gemini_3_1_pro',
      file_urls: allFotos.length > 0 ? allFotos.slice(0, 10) : undefined,
    });

    await base44.asServiceRole.entities.InspeccionColegio.update(inspeccion_id, {
      informe_generado: result,
      estado: 'completado',
    });

    return Response.json({ status: 'done', informe: result });
  } catch (err) {
    await base44.asServiceRole.entities.InspeccionColegio.update(inspeccion_id, {
      estado: 'en_progreso',
      informe_generado: '',
    }).catch(() => {});
    return Response.json({ error: err.message }, { status: 500 });
  }
});