import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';
import { createScopedClient, sectorErrorResponse } from '../../shared/sectorGuard.ts';
import { resolveCallerSectorCanonical } from '../../shared/callerIdentity.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Aislamiento de raíz: las órdenes de rutina caen al sector activo del operador.
    const { sector: callerSector } = await resolveCallerSectorCanonical(base44.asServiceRole, user);
    const sb = createScopedClient(base44, callerSector);
    const body = await req.json().catch(() => ({}));
    if (body.sector_id && body.sector_id !== callerSector) return Response.json({ error: 'Sector distinto del activo' }, { status: 403 });
    if (body.dry_run === true) return Response.json({ ok: true, sector: callerSector, dry_run: true });

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const mesActual = hoy.getMonth() + 1; // 1-12
    const hoyStr = hoy.toISOString().split('T')[0];

    let ordenesCreadas = 0;
    let ordenesVencidas = 0;

    // ── 1. Marcar vencidas ─────────────────────────────────────────────────
    // Pre-cargar en paralelo órdenes abiertas (2 queries en vez de N updates individuales)
    const [ordenesAbiertas, ordenesEnProceso] = await Promise.all([
      sb.entities.OrdenRutina.filter({ estado: 'pendiente' }),
      sb.entities.OrdenRutina.filter({ estado: 'en_proceso' }),
    ]);
    const toVencer = [...ordenesAbiertas, ...ordenesEnProceso]
      .filter(o => o.fecha_limite && o.fecha_limite < hoyStr);

    if (toVencer.length > 0) {
      const updatesBulk = toVencer.map(o => ({ id: o.id, estado: 'vencida' }));
      for (let i = 0; i < updatesBulk.length; i += 100) {
        await sb.entities.OrdenRutina.bulkUpdate(updatesBulk.slice(i, i + 100));
      }
      ordenesVencidas = toVencer.length;
    }

    // ── 2. Generar nuevas órdenes ──────────────────────────────────────────
    const rutinaEdificios = await sb.entities.RutinaEdificio.filter({ activa: true });

    // Pre-cargar catálogo y órdenes pendientes para evitar N+1 queries
    const allCatalogo = await base44.asServiceRole.entities.RutinaCatalogo.list();
    const catalogoMap = new Map(allCatalogo.map(r => [r.id, r]));
    const pendientesExistentes = await sb.entities.OrdenRutina.filter({ estado: 'pendiente' });
    const pendientesSet = new Set(pendientesExistentes.map(o => o.rutina_edificio_id));

    for (const re of rutinaEdificios) {
      // No generar órdenes a partir de relaciones cruzadas o sin sector.
      if (!re.proxima_ejecucion || re.proxima_ejecucion > hoyStr || !re.edificio_id) continue;
      const edificio = await sb.entities.Edificio.get(re.edificio_id);

      // ── Verificar estacionalidad ──
      const rutina = catalogoMap.get(re.rutina_id);
      if (!rutina) continue;

      if (rutina.estacionalidad && rutina.estacionalidad.trim()) {
        const mesesStr = rutina.estacionalidad.trim();
        // Soportar formatos: "3,4,5,6,7,8,9" o texto libre
        const mesesNum = mesesStr.split(',').map(m => parseInt(m.trim(), 10)).filter(n => !isNaN(n));
        if (mesesNum.length > 0 && !mesesNum.includes(mesActual)) {
          // Fuera de temporada: adelantar proxima_ejecucion sin generar orden
          const next = new Date(hoy);
          next.setDate(next.getDate() + (re.frecuencia_dias || 30));
          await sb.entities.RutinaEdificio.update(re.id, {
            proxima_ejecucion: next.toISOString().split('T')[0],
          });
          continue;
        }
      }

      // ── Verificar que no exista ya una orden pendiente para este par ──
      if (pendientesSet.has(re.id)) continue;

      // ── Calcular fecha_limite ──
      const plazo = re.plazo_dias || rutina.plazo_dias || 15;
      const fechaLimite = new Date(hoy);
      fechaLimite.setDate(fechaLimite.getDate() + plazo);

      await sb.entities.OrdenRutina.create({
        sector_id: callerSector,
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
    return sectorErrorResponse(error);
  }
}