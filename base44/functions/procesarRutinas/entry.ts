import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const mesActual = hoy.getMonth() + 1; // 1-12
    const hoyStr = hoy.toISOString().split('T')[0];

    let ordenesCreadas = 0;
    let ordenesVencidas = 0;

    // ── 1. Marcar vencidas ─────────────────────────────────────────────────
    const ordenesAbiertas = await base44.asServiceRole.entities.OrdenRutina.filter({
      estado: 'pendiente',
    });
    const ordenesEnProceso = await base44.asServiceRole.entities.OrdenRutina.filter({
      estado: 'en_proceso',
    });

    for (const orden of [...ordenesAbiertas, ...ordenesEnProceso]) {
      if (orden.fecha_limite && orden.fecha_limite < hoyStr) {
        await base44.asServiceRole.entities.OrdenRutina.update(orden.id, { estado: 'vencida' });
        ordenesVencidas++;
      }
    }

    // ── 2. Generar nuevas órdenes ──────────────────────────────────────────
    const rutinaEdificios = await base44.asServiceRole.entities.RutinaEdificio.filter({ activa: true });

    for (const re of rutinaEdificios) {
      // Verificar si hoy >= proxima_ejecucion
      if (!re.proxima_ejecucion) continue;
      if (re.proxima_ejecucion > hoyStr) continue;

      // ── Verificar estacionalidad ──
      // Buscar la rutina del catálogo para obtener estacionalidad
      const rutinas = await base44.asServiceRole.entities.RutinaCatalogo.filter({ id: re.rutina_id });
      const rutina = rutinas[0];
      if (!rutina) continue;

      if (rutina.estacionalidad && rutina.estacionalidad.trim()) {
        const mesesStr = rutina.estacionalidad.trim();
        // Soportar formatos: "3,4,5,6,7,8,9" o texto libre
        const mesesNum = mesesStr.split(',').map(m => parseInt(m.trim(), 10)).filter(n => !isNaN(n));
        if (mesesNum.length > 0 && !mesesNum.includes(mesActual)) {
          // Fuera de temporada: adelantar proxima_ejecucion sin generar orden
          const next = new Date(hoy);
          next.setDate(next.getDate() + (re.frecuencia_dias || 30));
          await base44.asServiceRole.entities.RutinaEdificio.update(re.id, {
            proxima_ejecucion: next.toISOString().split('T')[0],
          });
          continue;
        }
      }

      // ── Verificar que no exista ya una orden pendiente para este par ──
      const existentes = await base44.asServiceRole.entities.OrdenRutina.filter({
        rutina_edificio_id: re.id,
        estado: 'pendiente',
      });
      if (existentes.length > 0) continue;

      // ── Calcular fecha_limite ──
      const plazo = re.plazo_dias || rutina.plazo_dias || 15;
      const fechaLimite = new Date(hoy);
      fechaLimite.setDate(fechaLimite.getDate() + plazo);

      await base44.asServiceRole.entities.OrdenRutina.create({
        rutina_edificio_id: re.id,
        edificio_id: re.edificio_id,
        edificio_nombre: re.edificio_nombre || '',
        rutina_id: re.rutina_id,
        rutina_objeto: re.rutina_objeto || rutina.objeto || '',
        rubro_nombre: re.rubro_nombre || rutina.rubro_nombre || '',
        ciclo: re.ciclo || rutina.ciclo || '',
        plazo_dias: plazo,
        requiere_informe_matriculado: rutina.requiere_informe_matriculado || false,
        carga_sismesc: rutina.carga_sismesc || false,
        acciones: rutina.acciones || '',
        observaciones_tom: rutina.observaciones_tom || '',
        fecha_generada: hoyStr,
        fecha_limite: fechaLimite.toISOString().split('T')[0],
        estado: 'pendiente',
        adjuntos: [],
      });
      ordenesCreadas++;
    }

    return Response.json({
      ok: true,
      fecha: hoyStr,
      ordenes_creadas: ordenesCreadas,
      ordenes_vencidas: ordenesVencidas,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});