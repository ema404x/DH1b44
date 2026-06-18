import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acceso solo para administradores' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const paso = body.paso || 1; // paso 1 = crear edificios, paso 2 = asignar rutinas a un edificio

    // ── PASO 1: Crear Edificios desde LocationData ──
    if (paso === 1) {
      const locations = await base44.asServiceRole.entities.LocationData.filter({ estado: 'activo' });
      const edificiosExistentes = await base44.asServiceRole.entities.Edificio.list();
      const nombresExistentes = new Set(edificiosExistentes.map(e => e.nombre?.trim().toLowerCase()));

      // Deduplicar por nombre de establecimiento
      const ubicacionesUnicas = {};
      for (const loc of locations) {
        const nombre = (loc.establecimiento || loc.ubic_tecnica || '').trim();
        if (!nombre) continue;
        const key = nombre.toLowerCase();
        if (!ubicacionesUnicas[key]) {
          ubicacionesUnicas[key] = {
            nombre,
            jefe_sitio: loc.jefe_sitio || '',
            comuna: loc.comuna || 'Otra',
            location_id: loc.id,
          };
        }
      }

      const nuevas = Object.values(ubicacionesUnicas).filter(
        u => !nombresExistentes.has(u.nombre.toLowerCase())
      );

      let edificiosCreados = 0;
      const BATCH = 50;
      for (let i = 0; i < nuevas.length; i += BATCH) {
        const lote = nuevas.slice(i, i + BATCH).map(u => ({
          nombre: u.nombre,
          direccion: '',
          comuna: ['8A', '8B', '10A'].includes(u.comuna) ? u.comuna : 'Otra',
          activo: true,
          jefe_sitio: u.jefe_sitio,
          location_id: u.location_id,
        }));
        const creados = await base44.asServiceRole.entities.Edificio.bulkCreate(lote);
        edificiosCreados += creados.length;
      }

      const totalEdificios = edificiosExistentes.length + edificiosCreados;

      return Response.json({
        ok: true,
        paso: 1,
        edificios_creados: edificiosCreados,
        edificios_ya_existian: edificiosExistentes.length,
        edificios_totales: totalEdificios,
        mensaje: `Paso 1 completo: ${edificiosCreados} edificios creados. Total: ${totalEdificios} edificios.`,
      });
    }

    // ── PASO 2: Asignar rutinas a UN edificio (se llama N veces desde el frontend) ──
    if (paso === 2) {
      const { edificio_id, edificio_nombre } = body;
      if (!edificio_id) return Response.json({ error: 'Falta edificio_id' }, { status: 400 });

      const rutinas = await base44.asServiceRole.entities.RutinaCatalogo.filter({ activa: true });
      const asignacionesExistentes = await base44.asServiceRole.entities.RutinaEdificio.filter({ edificio_id });
      const rutinaIdsAsignadas = new Set(asignacionesExistentes.map(a => a.rutina_id));

      const nuevasAsignaciones = rutinas
        .filter(r => !rutinaIdsAsignadas.has(r.id))
        .map(r => ({
          edificio_id,
          edificio_nombre,
          rutina_id: r.id,
          rutina_objeto: r.objeto,
          rubro_nombre: r.rubro_nombre,
          ciclo: r.ciclo,
          frecuencia_dias: r.frecuencia_dias,
          plazo_dias: r.plazo_dias,
          activa: true,
        }));

      let asignacionesCreadas = 0;
      const BATCH = 50;
      for (let i = 0; i < nuevasAsignaciones.length; i += BATCH) {
        const lote = nuevasAsignaciones.slice(i, i + BATCH);
        await base44.asServiceRole.entities.RutinaEdificio.bulkCreate(lote);
        asignacionesCreadas += lote.length;
      }

      return Response.json({
        ok: true,
        paso: 2,
        edificio_id,
        asignaciones_creadas: asignacionesCreadas,
      });
    }

    return Response.json({ error: 'Paso inválido' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});