import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { createScopedClient, resolveCallerSector, SectorError } from '../../shared/sectorGuard.ts';
import {
  normalizeName,
  locationDataToEdificioPayload,
  edificioToLocationDataPayload,
  diffPayload,
  LD_TO_EDIFICIO_FIELDS,
  EDIFICIO_TO_LD_FIELDS,
} from '../../shared/locationSync.ts';

// Motor de sincronización bidireccional LocationData ↔ Edificio.
//
// Modos de invocación:
//   1) AUTOMATIZACIÓN (entity create/update): body = { event, data, old_data, changed_fields }
//      → no requiere auth.me(); usa asServiceRole scoped al sector_id del registro.
//   2) MANUAL (admin/gerente): body = { accion, id, ... }
//      → auth.me() + verify admin/gerente + scope al sector del caller.
//
// Acciones:
//   from_locationdata  — upserta Edificio espejo desde un LocationData (por id o data).
//   from_edificio      — sincroniza Edificio → su LocationData vinculado (por id o data).
//   reconciliar_sector — escanea todo el sector, repara huérfanos, re-vincula, reporta.
//   estado             — KPIs: totales, huérfanos, sincronizados, no-resolvibles.
//
// IDEMPOTENCIA: cada escritura compara el payload deseado vs el estado actual y
// solo escribe si hay diff real. La automatización inversa dispara, ve que no
// hay diff, y no escribe → el loop se corta solo, sin flags ni locks.

const ADMIN_ROLES = new Set(['admin', 'gerente']);

function isAutomationCall(body) {
  return !!(body && body.event && body.event.entity_name && body.event.entity_id);
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // ── Resolver scope según modo de invocación ──
    let sb; // scoped client
    let callerSector;

    if (isAutomationCall(body)) {
      // Modo automatización: el registro ya viene con sector_id (sectorGuard).
      // Si data es null (payload_too_large), fetch para resolver sector.
      let recordSector = body.data?.sector_id;
      let recordId = body.event.entity_id;
      if (!recordSector) {
        const raw = base44.asServiceRole.entities[body.event.entity_name];
        const rec = raw ? await raw.get(recordId).catch(() => null) : null;
        recordSector = rec?.sector_id;
      }
      if (!recordSector) {
        return Response.json({ skipped: true, reason: 'registro sin sector_id' });
      }
      callerSector = recordSector;
      sb = createScopedClient(base44, callerSector);
    } else {
      // Modo manual: auth + admin/gerente.
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (!ADMIN_ROLES.has(user.role)) {
        return Response.json({ error: 'Forbidden: solo admin/gerente' }, { status: 403 });
      }
      callerSector = resolveCallerSector(user);
      sb = createScopedClient(base44, callerSector);
    }

    const accion = body.accion;

    // ── from_locationdata ──
    // Upserta el Edificio espejo de un LocationData.
    if (accion === 'from_locationdata' || (isAutomationCall(body) && body.event.entity_name === 'LocationData')) {
      const ldId = body.id || body.data?.id || body.event.entity_id;
      if (!ldId) return Response.json({ error: 'id requerido' }, { status: 400 });
      const ld = await sb.entities.LocationData.get(ldId).catch(() => null);
      if (!ld) return Response.json({ skipped: true, reason: 'LocationData no encontrado' });

      // Buscar Edificio por location_id, luego por nombre normalizado.
      let edificio = null;
      if (ld.id) {
        const byLink = await sb.entities.Edificio.filter({ location_id: ld.id }, '-updated_date', 50);
        edificio = byLink?.[0] || null;
      }
      if (!edificio) {
        const allEd = await sb.entities.Edificio.list('-updated_date', 500);
        const norm = normalizeName(ld.establecimiento || ld.ubic_tecnica);
        if (norm) edificio = allEd.find(e => normalizeName(e.nombre) === norm) || null;
      }

      const desired = locationDataToEdificioPayload(ld);

      if (!edificio) {
        // Crear espejo.
        const created = await sb.entities.Edificio.create({
          nombre: desired.nombre,
          comuna: desired.comuna || 'Otra',
          jefe_sitio: desired.jefe_sitio,
          activo: desired.activo,
          location_id: ld.id,
        });
        return Response.json({ ok: true, accion: 'create_edificio', id: created.id });
      }

      // Actualizar solo si hay diff.
      const changes = diffPayload(edificio, desired, LD_TO_EDIFICIO_FIELDS);
      if (Object.keys(changes).length === 0) {
        return Response.json({ ok: true, skipped: true, reason: 'sin diff' });
      }
      await sb.entities.Edificio.update(edificio.id, changes);
      return Response.json({ ok: true, accion: 'update_edificio', id: edificio.id, changes });
    }

    // ── from_edificio ──
    // Sincroniza un Edificio hacia su LocationData vinculado.
    if (accion === 'from_edificio' || (isAutomationCall(body) && body.event.entity_name === 'Edificio')) {
      const edId = body.id || body.data?.id || body.event.entity_id;
      if (!edId) return Response.json({ error: 'id requerido' }, { status: 400 });
      const ed = await sb.entities.Edificio.get(edId).catch(() => null);
      if (!ed) return Response.json({ skipped: true, reason: 'Edificio no encontrado' });

      // Resolver LocationData: por location_id, luego por nombre.
      let ld = null;
      if (ed.location_id) {
        ld = await sb.entities.LocationData.get(ed.location_id).catch(() => null);
      }
      if (!ld) {
        const allLD = await sb.entities.LocationData.list('-updated_date', 500);
        const norm = normalizeName(ed.nombre);
        if (norm) ld = allLD.find(x => normalizeName(x.establecimiento || x.ubic_tecnica) === norm) || null;
      }

      if (!ld) {
        // No se puede crear LocationData sin ubic_tecnica + comuna (required).
        // Reportar para revisión manual; no romper el flujo.
        return Response.json({ ok: true, skipped: true, reason: 'LocationData no encontrado para vincular', edificio_id: ed.id });
      }

      const desired = edificioToLocationDataPayload(ed);
      const changes = diffPayload(ld, desired, EDIFICIO_TO_LD_FIELDS);

      // Si el Edificio no tenía location_id, vincularlo ahora.
      if (!ed.location_id && ld.id) {
        changes.location_id = ld.id;
        await sb.entities.Edificio.update(ed.id, { location_id: ld.id });
      }

      if (Object.keys(changes).length === 0) {
        return Response.json({ ok: true, skipped: true, reason: 'sin diff' });
      }
      await sb.entities.LocationData.update(ld.id, changes);
      return Response.json({ ok: true, accion: 'update_locationdata', id: ld.id, changes });
    }

    // ── reconciliar_sector ──
    // Escaneo masivo del sector: repara huérfanos, re-vincula, reporta.
    if (accion === 'reconciliar_sector') {
      const [allLD, allEd] = await Promise.all([
        sb.entities.LocationData.list('-updated_date', 5000),
        sb.entities.Edificio.list('-updated_date', 5000),
      ]);

      const ldByNorm = new Map();
      for (const ld of allLD) {
        const n = normalizeName(ld.establecimiento || ld.ubic_tecnica);
        if (n) ldByNorm.set(n, ld);
      }
      const edByNorm = new Map();
      for (const ed of allEd) {
        const n = normalizeName(ed.nombre);
        if (n) edByNorm.set(n, ed);
      }
      const edByLink = new Map();
      for (const ed of allEd) if (ed.location_id) edByLink.set(ed.location_id, ed);

      const created = [];
      const linked = [];
      const updated = [];
      const noResolvibles = [];
      const sincronizados = [];

      // 1) LocationData sin Edificio → crear espejo.
      for (const ld of allLD) {
        const existing = edByLink.get(ld.id) || (normalizeName(ld.establecimiento || ld.ubic_tecnica) ? edByNorm.get(normalizeName(ld.establecimiento || ld.ubic_tecnica)) : null);
        if (existing) {
          if (!existing.location_id) {
            await sb.entities.Edificio.update(existing.id, { location_id: ld.id });
            linked.push({ edificio_id: existing.id, locationdata_id: ld.id });
          }
          // Sincronizar campos compartidos si hay diff.
          const desired = locationDataToEdificioPayload(ld);
          const changes = diffPayload(existing, desired, LD_TO_EDIFICIO_FIELDS);
          if (Object.keys(changes).length > 0) {
            await sb.entities.Edificio.update(existing.id, changes);
            updated.push({ edificio_id: existing.id, changes });
          } else {
            sincronizados.push({ edificio_id: existing.id });
          }
          continue;
        }
        const nuevo = await sb.entities.Edificio.create({
          nombre: ld.establecimiento || ld.ubic_tecnica,
          comuna: ld.comuna || 'Otra',
          jefe_sitio: ld.jefe_sitio || '',
          activo: ld.estado !== 'inactivo',
          location_id: ld.id,
        });
        created.push({ edificio_id: nuevo.id, locationdata_id: ld.id });
      }

      // 2) Edificio sin LocationData → intentar vincular por nombre, sino reportar.
      for (const ed of allEd) {
        if (ed.location_id && edByLink.get(ed.location_id)) continue;
        const norm = normalizeName(ed.nombre);
        const ldMatch = norm ? ldByNorm.get(norm) : null;
        if (ldMatch) {
          await sb.entities.Edificio.update(ed.id, { location_id: ldMatch.id });
          linked.push({ edificio_id: ed.id, locationdata_id: ldMatch.id });
        } else {
          noResolvibles.push({ edificio_id: ed.id, nombre: ed.nombre, motivo: 'sin LocationData matching' });
        }
      }

      return Response.json({
        ok: true,
        accion: 'reconciliar_sector',
        sector: callerSector,
        resumen: {
          locationdata_total: allLD.length,
          edificios_total: allEd.length,
          edificios_creados: created.length,
          edificios_vinculados: linked.length,
          edificios_actualizados: updated.length,
          ya_sincronizados: sincronizados.length,
          no_resolvibles: noResolvibles.length,
        },
        created,
        linked,
        updated: updated.slice(0, 50),
        no_resolvibles: noResolvibles.slice(0, 50),
      });
    }

    // ── estado ── KPIs para el panel.
    if (accion === 'estado') {
      const [allLD, allEd] = await Promise.all([
        sb.entities.LocationData.list('-updated_date', 5000),
        sb.entities.Edificio.list('-updated_date', 5000),
      ]);
      const edByLink = new Map();
      for (const ed of allEd) if (ed.location_id) edByLink.set(ed.location_id, ed);
      const ldIds = new Set(allLD.map(x => x.id));

      let sincronizados = 0, edHuerfanos = 0, ldHuerfanos = 0, conDiff = 0;
      const ldNorm = new Map();
      for (const ld of allLD) ldNorm.set(normalizeName(ld.establecimiento || ld.ubic_tecnica), ld);

      for (const ld of allLD) {
        const ed = edByLink.get(ld.id);
        if (ed) {
          const changes = diffPayload(ed, locationDataToEdificioPayload(ld), LD_TO_EDIFICIO_FIELDS);
          if (Object.keys(changes).length > 0) conDiff++; else sincronizados++;
        } else {
          const norm = normalizeName(ld.establecimiento || ld.ubic_tecnica);
          if (norm && allEd.find(e => normalizeName(e.nombre) === norm)) sincronizados++;
          else ldHuerfanos++;
        }
      }
      for (const ed of allEd) {
        if (!ed.location_id || !ldIds.has(ed.location_id)) {
          const norm = normalizeName(ed.nombre);
          if (!norm || !ldNorm.has(norm)) edHuerfanos++;
        }
      }

      return Response.json({
        ok: true,
        accion: 'estado',
        sector: callerSector,
        kpis: {
          locationdata_total: allLD.length,
          edificios_total: allEd.length,
          sincronizados: sincronizados,
          con_diff: conDiff,
          locationdata_huerfanos: ldHuerfanos,
          edificios_huerfanos: edHuerfanos,
        },
      });
    }

    return Response.json({ error: 'accion inválida (use from_locationdata | from_edificio | reconciliar_sector | estado)' }, { status: 400 });
  } catch (err) {
    if (err instanceof SectorError) return Response.json({ error: err.message }, { status: err.status });
    console.error('sincronizarUbicaciones error:', err);
    return Response.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}