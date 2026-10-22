import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { createScopedClient, sectorErrorResponse } from '../../shared/sectorGuard.ts';
import { resolveCallerSectorCanonical } from '../../shared/callerIdentity.ts';
import { getArDateStr, isExpiredOpenFichaje, buildAutoCierrePayload } from '../../shared/fichajeAutoCierre.ts';

/**
 * Cierre diario automático de fichajes omitidos (al cambio de día en zona horaria de Buenos Aires).
 *
 * Identifica los registros de FichajeUbicacion con estado 'abierta' cuya fecha de entrada
 * (en Argentina UTC-3) sea anterior al día actual, los cierra a las 23:59:59 del día de entrada,
 * mantiene vacíos los campos de firma/GPS de salida reales, y los marca con estado='salida_omitida',
 * salida_omitida=true y estado_admin='incidencia'.
 */
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'gerente') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { sector: callerSector } = await resolveCallerSectorCanonical(base44.asServiceRole, user);
    const body = await req.json().catch(() => ({}));

    if (body.sector_id && callerSector && body.sector_id !== callerSector) {
      return Response.json({ error: 'Sector distinto del activo' }, { status: 403 });
    }

    // Determinar sectores a procesar manteniendo aislamiento estricto por sector
    let sectores = [];
    if (callerSector) {
      sectores = [callerSector];
    } else if (user.role === 'admin') {
      const allSectors = await base44.asServiceRole.entities.Sector.filter({ activo: true }).catch(() => []);
      sectores = allSectors.map(s => s.clave).filter(Boolean);
    }

    if (sectores.length === 0) {
      return Response.json({ error: 'Sin sector asignado' }, { status: 403 });
    }

    const now = new Date();
    const todayAr = getArDateStr(now);
    const porSector = {};
    let totalCerrados = 0;

    for (const sector of sectores) {
      const sb = createScopedClient(base44, sector);
      const abiertas = await sb.entities.FichajeUbicacion.filter({ estado: 'abierta' }, '-entrada_timestamp', 500).catch(() => []);
      const list = Array.isArray(abiertas) ? abiertas : (abiertas?.items || []);
      const vencidas = list.filter(f => isExpiredOpenFichaje(f, now));

      if (body.dry_run === true) {
        porSector[sector] = vencidas.length;
        totalCerrados += vencidas.length;
        continue;
      }

      if (vencidas.length > 0) {
        const updates = vencidas.map(f => ({
          id: f.id,
          ...buildAutoCierrePayload(f, now),
        }));

        for (let i = 0; i < updates.length; i += 100) {
          await sb.entities.FichajeUbicacion.bulkUpdate(updates.slice(i, i + 100));
        }

        await sb.entities.AuditLog.create({
          entity_type: 'FichajeUbicacion',
          entity_id: `sector:${sector}`,
          action: 'update',
          user_email: user.email,
          user_role: user.role,
          timestamp: now.toISOString(),
          changed_fields: ['estado', 'salida_timestamp', 'salida_omitida', 'estado_admin', 'notas_admin'],
          notes: `Cierre automático al cambio de día (${todayAr}): ${vencidas.length} fichaje(s) marcados como salida omitida.`,
        }).catch(() => {});
      }

      porSector[sector] = vencidas.length;
      totalCerrados += vencidas.length;
    }

    return Response.json({
      success: true,
      dry_run: body.dry_run === true,
      fecha_actual_ar: todayAr,
      cerrados: totalCerrados,
      porSector,
    });
  } catch (error) {
    return sectorErrorResponse(error);
  }
}