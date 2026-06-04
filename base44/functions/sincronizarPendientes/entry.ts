/**
 * Sincronización global: actualiza jefe_sitio e inspector en todos los módulos
 * que usan esa información (Pendiente, ObraCertificacion, EquipamientoCalefaccion).
 *
 * Estrategia de matching (en orden de prioridad):
 * 1. LocationData por establecimiento (nombre exacto normalizado)
 * 2. LocationData por dirección física
 * 3. Direccion por inspector (inspector → jefe_sitio)
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const norm = (s) => s ? String(s).trim().toUpperCase().replace(/\s+/g, ' ') : '';

/** Construye todos los índices de lookup a partir de LocationData y Direccion */
function buildIndexes(locations, direcciones, employees) {
  const byEstablecimiento = new Map(); // norm(establecimiento) → { jefe_sitio, inspector }
  const byDireccion = new Map();       // norm(direccion física) → { jefe_sitio, inspector }

  for (const loc of locations) {
    const info = { jefe_sitio: loc.jefe_sitio, inspector: loc.inspector };
    if (loc.establecimiento) byEstablecimiento.set(norm(loc.establecimiento), info);
  }

  // Direccion entity: indexar por dirección y también poblar byEstablecimiento
  // con las escuelas de cada dirección si la LocationData las tiene vinculadas.
  // Adicionalmente, cada Direccion tiene jefe_sitio e inspector propios.
  const dirByInspector = new Map(); // norm(inspector) → dir
  for (const dir of direcciones) {
    if (dir.inspector) dirByInspector.set(norm(dir.inspector), dir);
    if (dir.direccion) {
      // La dirección misma sirve como clave de sitio en Pendiente.sitio
      byDireccion.set(norm(dir.direccion), { jefe_sitio: dir.jefe_sitio, inspector: dir.inspector });
    }
  }

  // Mezclar: LocationData con su direccion vinculada si tiene direccion_id
  // Para ello, armar mapa direccion_id → Direccion
  const dirById = new Map();
  for (const dir of direcciones) dirById.set(dir.id, dir);

  for (const loc of locations) {
    const info = { jefe_sitio: loc.jefe_sitio, inspector: loc.inspector };
    // Si loc no tiene jefe_sitio propio, heredar de su Direccion padre
    if (!info.jefe_sitio && loc.direccion_id) {
      const parent = dirById.get(loc.direccion_id);
      if (parent) {
        info.jefe_sitio = parent.jefe_sitio;
        info.inspector = info.inspector || parent.inspector;
      }
    }
    if (loc.establecimiento) byEstablecimiento.set(norm(loc.establecimiento), info);
  }

  const empEmail = new Map(); // norm(full_name) → email
  for (const e of employees) {
    if (e.full_name) empEmail.set(norm(e.full_name), e.email || '');
  }

  return { byEstablecimiento, byDireccion, dirByInspector, empEmail };
}

/**
 * Resuelve jefe_sitio e inspector para un registro dado sus campos de ubicación.
 * Devuelve { jefe_sitio, jefe_sitio_email, inspector } o {} si no hay datos.
 */
function resolveFromIndexes(indexes, { establecimiento, sitio, direccion, inspector: currentInspector }) {
  const { byEstablecimiento, byDireccion, dirByInspector, empEmail } = indexes;

  // 1. Match por nombre de establecimiento
  let info = (establecimiento && byEstablecimiento.get(norm(establecimiento)))
          || (sitio && byEstablecimiento.get(norm(sitio)))
          || null;

  // 2. Match por dirección física (campo direccion o sitio)
  if (!info) {
    info = (direccion && byDireccion.get(norm(direccion)))
        || (sitio && byDireccion.get(norm(sitio)))
        || null;
  }

  const result = {};

  if (info) {
    if (info.jefe_sitio) {
      result.jefe_sitio = info.jefe_sitio;
      result.jefe_sitio_email = empEmail.get(norm(info.jefe_sitio)) || '';
    }
    if (info.inspector) result.inspector = info.inspector;
  }

  // 3. Fallback: si hay inspector pero sin jefe, buscar en Direccion por inspector
  const inspectorToLookup = result.inspector || currentInspector;
  if (!result.jefe_sitio && inspectorToLookup) {
    const dir = dirByInspector.get(norm(inspectorToLookup));
    if (dir?.jefe_sitio) {
      result.jefe_sitio = dir.jefe_sitio;
      result.jefe_sitio_email = empEmail.get(norm(dir.jefe_sitio)) || '';
    }
  }

  return result;
}

/** Calcula el patch a aplicar (solo campos que realmente cambian) */
function buildPatch(current, resolved, canSetEstado = false) {
  const patch = {};
  if (resolved.jefe_sitio && resolved.jefe_sitio !== (current.jefe_sitio || '')) {
    patch.jefe_sitio = resolved.jefe_sitio;
  }
  if (resolved.jefe_sitio_email && resolved.jefe_sitio_email !== (current.jefe_sitio_email || '')) {
    patch.jefe_sitio_email = resolved.jefe_sitio_email;
  }
  if (resolved.inspector && resolved.inspector !== (current.inspector || '')) {
    patch.inspector = resolved.inspector;
  }
  if (canSetEstado && patch.jefe_sitio && (current.estado === 'pendiente')) {
    patch.estado = 'asignado';
  }
  return patch;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { modules = ['pendientes', 'obras', 'calefaccion'], force_all = true } = body;

    // Cargar todo en paralelo
    const [pendientes, obras, calefaccion, locations, direcciones, employees] = await Promise.all([
      modules.includes('pendientes') ? base44.entities.Pendiente.list() : Promise.resolve([]),
      modules.includes('obras') ? base44.entities.ObraCertificacion.list() : Promise.resolve([]),
      modules.includes('calefaccion') ? base44.entities.EquipamientoCalefaccion.list() : Promise.resolve([]),
      base44.entities.LocationData.list(),
      base44.entities.Direccion.list(),
      base44.entities.Employee.list(),
    ]);

    const indexes = buildIndexes(locations, direcciones, employees);

    const summary = {};

    // --- PENDIENTES ---
    if (modules.includes('pendientes')) {
      let updated = 0, unchanged = 0, errors = 0;
      const targets = pendientes.filter(p =>
        p.estado !== 'resuelto' && p.estado !== 'cancelado' &&
        (force_all || !p.jefe_sitio || !p.inspector)
      );

      for (const p of targets) {
        const resolved = resolveFromIndexes(indexes, {
          establecimiento: p.establecimiento,
          sitio: p.sitio,
          inspector: p.inspector,
        });
        const patch = buildPatch(p, resolved, true);
        if (Object.keys(patch).length === 0) { unchanged++; continue; }
        try {
          await base44.entities.Pendiente.update(p.id, patch);
          updated++;
        } catch { errors++; }
      }
      summary.pendientes = { procesados: targets.length, actualizados: updated, sin_cambios: unchanged, errors };
    }

    // --- OBRAS CERTIFICACION ---
    if (modules.includes('obras')) {
      let updated = 0, unchanged = 0, errors = 0;
      const targets = obras.filter(o =>
        !o.ciclo_archivado && (force_all || !o.jefe_sitio || !o.inspector)
      );

      for (const o of targets) {
        const resolved = resolveFromIndexes(indexes, {
          establecimiento: o.establecimiento,
          direccion: o.direccion,
          inspector: o.inspector,
        });
        const patch = buildPatch(o, resolved, false);
        if (Object.keys(patch).length === 0) { unchanged++; continue; }
        try {
          await base44.entities.ObraCertificacion.update(o.id, patch);
          updated++;
        } catch { errors++; }
      }
      summary.obras = { procesados: targets.length, actualizados: updated, sin_cambios: unchanged, errors };
    }

    // --- CALEFACCION ---
    if (modules.includes('calefaccion')) {
      let updated = 0, unchanged = 0, errors = 0;
      const targets = calefaccion.filter(c =>
        force_all || !c.jefe_sitio || !c.inspector
      );

      for (const c of targets) {
        const resolved = resolveFromIndexes(indexes, {
          establecimiento: c.escuela,
          inspector: null,
        });
        // Calefaccion solo tiene jefe_sitio
        const patch = {};
        if (resolved.jefe_sitio && resolved.jefe_sitio !== (c.jefe_sitio || '')) {
          patch.jefe_sitio = resolved.jefe_sitio;
        }
        if (Object.keys(patch).length === 0) { unchanged++; continue; }
        try {
          await base44.entities.EquipamientoCalefaccion.update(c.id, patch);
          updated++;
        } catch { errors++; }
      }
      summary.calefaccion = { procesados: targets.length, actualizados: updated, sin_cambios: unchanged, errors };
    }

    const totalActualizados = Object.values(summary).reduce((s, m) => s + m.actualizados, 0);
    const totalProcesados = Object.values(summary).reduce((s, m) => s + m.procesados, 0);

    return Response.json({
      success: true,
      total_procesados: totalProcesados,
      total_actualizados: totalActualizados,
      detalle: summary,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});