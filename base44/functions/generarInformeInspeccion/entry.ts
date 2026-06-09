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

  const prompt = `Sos un ingeniero civil senior especializado en inspección de establecimientos educativos públicos (GCBA). Redactá un INFORME TÉCNICO DE INSPECCIÓN EDILICIA formal y conciso en base a los datos relevados.

DATOS:
- Establecimiento: ${inspeccion.establecimiento}
- Dirección: ${inspeccion.direccion || 'No especificada'}
- Inspector: ${user.full_name || inspeccion.jefe_sitio}
- Fecha: ${inspeccion.fecha_inspeccion || new Date().toLocaleDateString('es-AR')}
- Secciones completadas: ${seccionesCompletadas.join(', ') || 'Ninguna'}
- Secciones pendientes: ${seccionesPendientes.join(', ') || 'Todas completadas'}
- Fotografías: ${totalFotos}

OBSERVACIONES POR SECCIÓN:
${seccionesTexto}

PRECIARIO DISPONIBLE (para estimaciones):
${preciarioTexto.substring(0, 3000)}

ESTRUCTURA DEL INFORME (usá exactamente estos encabezados Markdown):

# INFORME TÉCNICO DE INSPECCIÓN EDILICIA

## 1. Datos Generales
Tabla con: Establecimiento, Dirección, Inspector, Fecha, Secciones relevadas, Fotos tomadas, Estado general (Bueno/Regular/Deficiente/Crítico).

## 2. Resumen Ejecutivo
4-6 oraciones con terminología técnica: estado general, sistemas afectados, hallazgos críticos, nivel de urgencia global.

## 3. Detalle por Sección Relevada
Para cada sección COMPLETADA:
### 3.X [Nombre]
- **Estado:** Bueno/Regular/Deficiente/Crítico
- **Descripción técnica:** qué se observó
- **Problemas detectados:** lista numerada con ubicación exacta
- **Urgencia:** 🔴 URGENTE / 🟡 IMPORTANTE / 🟢 LEVE por cada problema

## 4. Cuadro Consolidado de Problemas
| N° | Sección | Descripción | Urgencia | Estado |
Ordenado de mayor a menor urgencia.

## 5. Plan de Acción
Para cada problema urgente/importante:
- Acción concreta · Plazo (Inmediato/7d/30d) · Responsable · Código preciario si aplica

## 6. Conclusión
- Puntaje edilicio 1-10 con justificación
- Clasificación: Apto / Apto con observaciones / Apto condicionado / No apto
- Próxima inspección sugerida

REGLAS: Lenguaje técnico formal. Sé específico (dónde, qué dimensión, qué riesgo). No uses frases vagas. No incluyas bloque de firma al final.`;

  // Responder inmediatamente — el proceso pesado corre en background
  // El frontend podrá hacer polling hasta que estado === 'completado'
  const generateAsync = async () => {
    try {
      const allFotos = (inspeccion.secciones || []).flatMap(s => s.fotos || []);
      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        model: 'gpt_5_4',
        file_urls: allFotos.length > 0 ? allFotos.slice(0, 10) : undefined,
      });

      const MAX_DB = 9000;
      const informeParaDB = result.length > MAX_DB
        ? result.substring(0, MAX_DB) + '\n\n---\n*(informe truncado — descargá el PDF para la versión completa)*'
        : result;

      await base44.entities.InspeccionColegio.update(inspeccion_id, {
        informe_generado: informeParaDB,
        estado: 'completado',
      });
    } catch (err) {
      await base44.entities.InspeccionColegio.update(inspeccion_id, {
        estado: 'en_progreso',
        informe_generado: '',
      }).catch(() => {});
    }
  };

  // Fire and forget con setTimeout(0) — retorna HTTP inmediatamente
  setTimeout(() => generateAsync(), 0);

  return Response.json({ status: 'generating' });
});