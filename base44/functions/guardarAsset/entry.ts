import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { createScopedClient, resolveCallerSector, sectorErrorResponse, SectorError } from "../../shared/sectorGuard.ts";

/**
 * guardarAsset — Crea/actualiza un Asset con validación de jerarquía UpKeep-style
 * y registro automático de historial (AssetHistory).
 *
 * Reglas de oro (aislamiento primero):
 *   - Fail-closed: sin sector → 403 (resolveCallerSector).
 *   - Herencia de sector: un sub-activo hereda el sector del padre; el padre DEBE
 *     estar en el mismo sector del caller (scoped get lo garantiza → 403 si no).
 *   - Anti-ciclo: al editar, ningún ancestro del padre puede ser el propio activo.
 *   - Historial: registra creado / cambio_estado / mantenimiento / baja en
 *     AssetHistory (mismo sector, vía scoped client).
 *
 * Solo admin/gerente. El frontend invoca base44.functions.invoke('guardarAsset', { id, data }).
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'gerente') {
      return Response.json({ error: 'Forbidden: solo admin/gerente' }, { status: 403 });
    }

    const callerSector = resolveCallerSector(user);
    const sb = createScopedClient(base44, callerSector);

    const body = await req.json().catch(() => ({}));
    const id = body.id || null;
    const data = { ...(body.data || {}) };

    // ── 1) Jerarquía: padre en el mismo sector + anti-ciclo ──
    if (data.parent_asset_id) {
      let parent;
      try {
        parent = await sb.entities.Asset.get(data.parent_asset_id);
      } catch (e) {
        if (e instanceof SectorError) return sectorErrorResponse(e);
        return Response.json({ error: 'Activo padre no encontrado en tu sector' }, { status: 400 });
      }
      if (id) {
        let cursor = parent;
        for (let i = 0; i < 50 && cursor; i++) {
          if (cursor.id === id) {
            return Response.json({ error: 'Ciclo de jerarquía detectado: el activo no puede ser su propio ancestro' }, { status: 400 });
          }
          if (!cursor.parent_asset_id) break;
          try { cursor = await sb.entities.Asset.get(cursor.parent_asset_id); }
          catch { break; }
        }
      }
    }
    // El scoped create estampa sector_id = callerSector por construcción.
    // Lo fijamos acá también para que el update lo lleve (fail-closed, mismo valor).
    data.sector_id = callerSector;

    // ── 2) Snapshot previo para detectar cambios de historial (solo edición) ──
    let existing = null;
    if (id) {
      try { existing = await sb.entities.Asset.get(id); } catch (_) {}
    }

    // ── 3) Crear o actualizar (scoped: estampa/verifica sector) ──
    let saved;
    if (id) {
      saved = await sb.entities.Asset.update(id, data);
    } else {
      saved = await sb.entities.Asset.create(data);
    }

    // ── 4) Registrar eventos en AssetHistory ──
    const usuario = user.full_name || user.email || '';
    const uid = user.id;
    const events = [];
    if (!existing) {
      events.push({ asset_id: saved.id, asset_name: saved.name, tipo_evento: 'creado', descripcion: 'Alta del activo', usuario, usuario_id: uid });
    } else {
      if ((existing.status || null) !== (saved.status || null)) {
        events.push({ asset_id: saved.id, asset_name: saved.name, tipo_evento: 'cambio_estado', descripcion: `Estado: ${existing.status || '—'} → ${saved.status}`, usuario, usuario_id: uid });
        if (saved.status === 'baja') {
          events.push({ asset_id: saved.id, asset_name: saved.name, tipo_evento: 'baja', descripcion: 'Activo dado de baja', usuario, usuario_id: uid });
        }
      }
      if (saved.last_maintenance && (existing.last_maintenance || null) !== (saved.last_maintenance || null)) {
        events.push({ asset_id: saved.id, asset_name: saved.name, tipo_evento: 'mantenimiento', descripcion: `Mantenimiento registrado: ${saved.last_maintenance}`, usuario, usuario_id: uid });
      }
    }
    for (const ev of events) {
      try { await sb.entities.AssetHistory.create(ev); }
      catch (e) { console.warn('[guardarAsset] history error:', e?.message); }
    }

    return Response.json(saved);
  } catch (error) {
    return sectorErrorResponse(error);
  }
});