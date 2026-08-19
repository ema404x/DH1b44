# Principios de trabajo — NO MODIFICAR

## Regla de oro (prioridad absoluta)

> **NUNCA implementes absolutamente nada — ni un solo carácter de código — si se va a romper algo existente.**

Antes de cualquier cambio, seguir SIEMPRE este orden:

1. **Analizar primero** el impacto del cambio en todo lo que ya funciona.
2. **Notificar** al usuario qué podría romperse ANTES de implementar, si hay riesgo.
3. **Implementar solo** cuando se tiene certeza razonable de que nada existente se rompe.
4. Si no se puede garantizar que no rompe nada → avisar al usuario y esperar confirmación.

## Reglas derivadas

- **Preferir la no-regresión sobre la mejora.** Un cambio que agrega aislamiento/seguridad/calidad pero rompe una vista existente NO se aplica hasta que se verifique que la vista sigue funcionando.
- **Backfill antes que RLS.** Al endurecer RLS (agregar `hard-AND` de sector), primero garantizar que todos los registros existentes tengan el campo requerido (`sector_id`). Un RLS estricto sin backfill = registros existentes invisibles = datos que "desaparecen".
- **No inventar gates de rol que no existían.** Al pedir "aislamiento por sector", aplicar SOLO `data.sector_id === {{user.data.sector_id}}` como hard-AND. Agregar `$or` de rol/propiedad额外 puede ocultar registros que usuarios legítimos veían antes.
- **Una sola fuente de verdad para el sector.** `data.sector_id` es canónico (lo lee la RLS). Cualquier lector frontend debe priorizar `data.sector_id` sobre el top-level `sector_id` (legacy, puede desincronizarse).
- **Verificar el dato real antes de tocar el schema.** Diagnosticar (contar registros, comparar valores de sector del usuario vs. los registros) antes de cambiar RLS. Nunca asumir.
- **Cada cambio aislado y reversible.** Hacer el cambio mínimo, verificar, y dejar el sistema en un estado funcional tras cada paso.
- **Probar en caliente.** Después de un cambio de RLS/schema, confirmar con datos reales (list + filter) que la visibilidad se mantiene.

## Casos ya aprendidos (no repetir)

- Endurecer RLS de 14 entidades de una vez sin backfill previo dejó registros existentes sin `sector_id` → invisibles. **Backfill siempre antes o simultáneo al hard-AND.**
- Agregar `$or` de `role: admin` o `jefe_sitio === full_name` al `read` de Edificio/RutinaEdificio ocultó 328 edificios a gerentes/users. **El `read` de datos de referencia debe ser sector-only.**
- El campo top-level `sector_id` del admin quedó en "escuela" mientras `data.sector_id` era "bapro" → el cliente filtraba con "escuela" y eliminaba los registros de "bapro" que devolvía el backend → listas vacías. **Priorizar `data.sector_id` en todos los lectores.**
- Cambiar `cambiarSectorActivo` para escribir solo `data.sector_id` dejó el top-level stale. **Sincronizar ambos campos en cada switch.**

## Procedimiento ante cualquier nuevo requerimiento

1. Leer/analizar el estado actual (datos reales, archivos involucrados).
2. Identificar todo lo que podría romperse.
3. Si hay riesgo → **notificar al usuario antes de implementar**.
4. Implementar el cambio mínimo que no rompe nada existente.
5. Verificar con datos reales que todo sigue funcionando.