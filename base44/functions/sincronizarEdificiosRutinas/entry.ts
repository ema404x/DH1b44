import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acceso solo para administradores' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const accion = body.accion || 'info';

    // ── INFO: estado actual ──
    if (accion === 'info') {
      const [edificios, rutinas] = await Promise.all([
        base44.asServiceRole.entities.Edificio.list(),
        base44.asServiceRole.entities.RutinaCatalogo.filter({ activa: true }),
      ]);

      // Contar asignaciones por edificio (sample de primeros 50 para no saturar)
      const asignaciones = await base44.asServiceRole.entities.RutinaEdificio.list('-created_date', 5000);
      const edificiosConAsig = new Set(asignaciones.map(a => a.edificio_id));
      const sinAsig = edificios.filter(e => !edificiosConAsig.has(e.id));

      return Response.json({
        ok: true,
        edificios_total: edificios.length,
        edificios_sin_asignacion: sinAsig.length,
        rutinas_catalogo: rutinas.length,
        asignaciones_existentes: asignaciones.length,
        pendientes_ids: sinAsig.map(e => ({ id: e.id, nombre: e.nombre })),
      });
    }

    // ── SYNC_EDIFICIOS: crear edificios faltantes desde LocationData ──
    if (accion === 'sync_edificios') {
      const [locations, edificiosExistentes] = await Promise.all([
        base44.asServiceRole.entities.LocationData.filter({ estado: 'activo' }),
        base44.asServiceRole.entities.Edificio.list(),
      ]);

      const nombresExistentes = new Set(edificiosExistentes.map(e => e.nombre?.trim().toLowerCase()));
      const nuevas = [];
      const seen = new Set();

      for (const loc of locations) {
        const nombre = (loc.establecimiento || loc.ubic_tecnica || '').trim();
        if (!nombre) continue;
        const key = nombre.toLowerCase();
        if (seen.has(key) || nombresExistentes.has(key)) continue;
        seen.add(key);
        nuevas.push({
          nombre,
          direccion: '',
          comuna: ['8A', '8B', '10A'].includes(loc.comuna) ? loc.comuna : 'Otra',
          activo: true,
          jefe_sitio: loc.jefe_sitio || '',
          location_id: loc.id,
        });
      }

      let creados = 0;
      const BATCH = 25;
      for (let i = 0; i < nuevas.length; i += BATCH) {
        await base44.asServiceRole.entities.Edificio.bulkCreate(nuevas.slice(i, i + BATCH));
        creados += Math.min(BATCH, nuevas.length - i);
        if (i + BATCH < nuevas.length) await sleep(400);
      }

      return Response.json({ ok: true, edificios_creados: creados });
    }

    // ── SYNC_RUTINAS: asignar rutinas a LOTE de edificios (paginado) ──
    // body: { accion: 'sync_rutinas', edificio_ids: [...] }
    if (accion === 'sync_rutinas') {
      const { edificio_ids = [] } = body;
      if (!edificio_ids.length) return Response.json({ ok: true, asignaciones_creadas: 0 });

      const rutinas = await base44.asServiceRole.entities.RutinaCatalogo.filter({ activa: true });

      let asignacionesCreadas = 0;
      const BATCH = 20;

      for (const edificio_id of edificio_ids) {
        // Verificar si ya tiene asignaciones
        const existing = await base44.asServiceRole.entities.RutinaEdificio.filter({ edificio_id });
        if (existing.length > 0) continue;

        // Obtener datos del edificio
        const edificios = await base44.asServiceRole.entities.Edificio.filter({ id: edificio_id });
        const edificio = edificios[0];
        if (!edificio) continue;

        const nuevas = rutinas.map(r => ({
          edificio_id,
          edificio_nombre: edificio.nombre,
          rutina_id: r.id,
          rutina_objeto: r.objeto,
          rubro_nombre: r.rubro_nombre,
          ciclo: r.ciclo,
          frecuencia_dias: r.frecuencia_dias,
          plazo_dias: r.plazo_dias,
          activa: true,
        }));

        for (let i = 0; i < nuevas.length; i += BATCH) {
          await base44.asServiceRole.entities.RutinaEdificio.bulkCreate(nuevas.slice(i, i + BATCH));
          asignacionesCreadas += Math.min(BATCH, nuevas.length - i);
          if (i + BATCH < nuevas.length) await sleep(200);
        }
        // Pausa entre edificios
        await sleep(300);
      }

      return Response.json({ ok: true, asignaciones_creadas: asignacionesCreadas });
    }

    return Response.json({ error: 'Accion inválida' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});