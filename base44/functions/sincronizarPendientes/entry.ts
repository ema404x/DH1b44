/**
 * Sincronizar pendientes con la información del módulo Información General.
 * 
 * Lógica de matching (en orden de prioridad):
 * 1. Por LocationData: si el sitio/establecimiento del pendiente coincide con
 *    un LocationData, se toman jefe_sitio e inspector de ese registro.
 * 2. Por Direccion (inspector → jefe_sitio): si el pendiente tiene inspector
 *    y no se encontró match en LocationData, se busca en Direccion por inspector.
 *
 * Solo se actualizan registros donde realmente cambia algo.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function normalize(s) {
  if (!s) return '';
  return String(s).trim().toUpperCase().replace(/\s+/g, ' ');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { comuna, force_all = false } = body;

    // Cargar todos los datos necesarios en paralelo
    const [pendientes, locations, direcciones, employees] = await Promise.all([
      base44.entities.Pendiente.list(),
      base44.entities.LocationData.list(),
      base44.entities.Direccion.list(),
      base44.entities.Employee.list(),
    ]);

    // Índice de LocationData: normalizar establecimiento y sitio para búsqueda rápida
    const locByEstablecimiento = new Map();
    const locBySitio = new Map();
    for (const loc of locations) {
      if (loc.establecimiento) locByEstablecimiento.set(normalize(loc.establecimiento), loc);
      if (loc.ubic_tecnica) locBySitio.set(normalize(loc.ubic_tecnica), loc);
    }

    // Índice de Direccion: inspector → { jefe_sitio, inspector }
    const dirByInspector = new Map();
    for (const dir of direcciones) {
      if (dir.inspector) dirByInspector.set(normalize(dir.inspector), dir);
    }

    // Índice de employees: nombre → email
    const empByName = new Map();
    for (const e of employees) {
      if (e.full_name) empByName.set(normalize(e.full_name), e.email || '');
    }

    // Filtrar pendientes a procesar
    const targets = pendientes.filter(p => {
      if (p.estado === 'resuelto' || p.estado === 'cancelado') return false;
      if (comuna && p.comuna !== comuna) return false;
      // force_all: procesar todos, incluso los ya asignados
      // por defecto: solo los que les falta jefe_sitio o inspector
      if (!force_all && p.jefe_sitio && p.inspector) return false;
      return true;
    });

    let updated = 0;
    let unchanged = 0;
    const errores = [];

    for (const p of targets) {
      let newJefe = p.jefe_sitio || null;
      let newJefeEmail = p.jefe_sitio_email || null;
      let newInspector = p.inspector || null;

      // 1. Buscar en LocationData por establecimiento o sitio
      const normEstab = normalize(p.establecimiento);
      const normSitio = normalize(p.sitio);

      const loc = (normEstab && locByEstablecimiento.get(normEstab))
               || (normSitio && locBySitio.get(normSitio))
               || null;

      if (loc) {
        if (loc.jefe_sitio) {
          newJefe = loc.jefe_sitio;
          newJefeEmail = empByName.get(normalize(loc.jefe_sitio)) || newJefeEmail;
        }
        if (loc.inspector) newInspector = loc.inspector;
      }

      // 2. Si todavía falta el jefe, buscar en Direccion por inspector
      if (!newJefe && newInspector) {
        const dir = dirByInspector.get(normalize(newInspector));
        if (dir?.jefe_sitio) {
          newJefe = dir.jefe_sitio;
          newJefeEmail = empByName.get(normalize(dir.jefe_sitio)) || newJefeEmail;
        }
      }

      // 3. Solo actualizar si hay cambio real
      const changed = newJefe !== (p.jefe_sitio || null)
                   || newInspector !== (p.inspector || null)
                   || (newJefeEmail && newJefeEmail !== (p.jefe_sitio_email || null));

      if (!changed) { unchanged++; continue; }

      try {
        const patch = {};
        if (newJefe !== (p.jefe_sitio || null)) patch.jefe_sitio = newJefe;
        if (newJefeEmail && newJefeEmail !== (p.jefe_sitio_email || null)) patch.jefe_sitio_email = newJefeEmail;
        if (newInspector !== (p.inspector || null)) patch.inspector = newInspector;
        if (newJefe && p.estado === 'pendiente') patch.estado = 'asignado';

        await base44.entities.Pendiente.update(p.id, patch);
        updated++;
      } catch (e) {
        errores.push(`Pendiente ${p.numero_sap || p.id}: ${e.message}`);
      }
    }

    return Response.json({
      success: true,
      total_procesados: targets.length,
      actualizados: updated,
      sin_cambios: unchanged,
      errores: errores.slice(0, 10),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});