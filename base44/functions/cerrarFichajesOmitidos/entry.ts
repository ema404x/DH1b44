import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import { createScopedClient, sectorErrorResponse } from '../../shared/sectorGuard.ts';
import { resolveCallerSectorCanonical } from '../../shared/callerIdentity.ts';
import {
  getArDateStr,
  isExpiredOpenFichaje,
  fetchAllFichajesPaginated,
  reconcileExpiredOpenFichajes,
} from '../../shared/fichajeAutoCierre.ts';

/**
 * Cierre diario automático de fichajes omitidos (al cambio de día en zona horaria de Buenos Aires).
 *
 * Autorización exclusiva para el workflow programado (ejecutado como admin autenticado con
 * indicador explícito de disparo de workflow/automatización).
 * Pagina todos los fichajes abiertos por sector sin truncarse en 500 registros y verifica cada
 * actualización sin ocultar errores.
 */
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: exclusivo para ejecución administrativa del workflow' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const isWorkflowTrigger =
      body?.workflow_trigger === true ||
      req.headers.get('x-automation-trigger') === 'scheduled';

    if (!isWorkflowTrigger) {
      return Response.json(
        { error: 'Forbidden: esta función solo puede ser ejecutada por el workflow programado' },
        { status: 403 }
      );
    }

    const { sector: callerSector } = await resolveCallerSectorCanonical(base44.asServiceRole, user);

    if (body.sector_id && callerSector && body.sector_id !== callerSector) {
      return Response.json({ error: 'Sector distinto del activo' }, { status: 403 });
    }

    // Determinar sectores permitidos manteniendo el aislamiento por sector
    let sectores = [];
    if (body.sector_id) {
      sectores = [body.sector_id];
    } else {
      const allSectors = await base44.asServiceRole.entities.Sector.filter({ activo: true }, { limit: 100 });
      const sectorItems = Array.isArray(allSectors) ? allSectors : (allSectors?.items || []);
      sectores = sectorItems.map(s => s.clave).filter(Boolean);
      if (sectores.length === 0 && callerSector) {
        sectores = [callerSector];
      }
    }

    if (sectores.length === 0) {
      return Response.json({ error: 'Sin sectores activos para procesar' }, { status: 403 });
    }

    const now = new Date();
    const todayAr = getArDateStr(now);
    const porSector = {};
    const fallosPorSector = {};
    let totalCerrados = 0;
    let totalFallidos = 0;
    let totalEvaluados = 0;

    for (const sector of sectores) {
      const sb = createScopedClient(base44, sector);
      const abiertas = await fetchAllFichajesPaginated(sb, { estado: 'abierta' }, 'entrada_timestamp');
      totalEvaluados += abiertas.length;
      const vencidas = abiertas.filter(f => isExpiredOpenFichaje(f, now));

      if (body.dry_run === true) {
        porSector[sector] = { candidatas: vencidas.length, abiertas_totales: abiertas.length, cerrados: 0, fallidos: 0 };
        totalCerrados += vencidas.length;
        continue;
      }

      if (vencidas.length > 0) {
        const result = await reconcileExpiredOpenFichajes(sb, vencidas, now, { throwOnFailure: false });
        porSector[sector] = {
          abiertas_totales: abiertas.length,
          candidatas: vencidas.length,
          cerrados: result.closedCount,
          fallidos: result.failedCount,
        };
        totalCerrados += result.closedCount;
        totalFallidos += result.failedCount;
        if (result.failedCount > 0) {
          fallosPorSector[sector] = result.failed;
        }

        if (result.closedCount > 0) {
          await sb.entities.AuditLog.create({
            entity_type: 'FichajeUbicacion',
            entity_id: `sector:${sector}`,
            action: 'update',
            user_email: user.email,
            user_role: user.role,
            timestamp: now.toISOString(),
            changed_fields: ['estado', 'salida_timestamp', 'salida_omitida', 'estado_admin', 'notas_admin'],
            notes: `Cierre automático al cambio de día (${todayAr}): ${result.closedCount} fichaje(s) cerrados como salida omitida${result.failedCount > 0 ? `, ${result.failedCount} fallido(s)` : ''}.`,
          });
        }
      } else {
        porSector[sector] = { abiertas_totales: abiertas.length, candidatas: 0, cerrados: 0, fallidos: 0 };
      }
    }

    if (totalFallidos > 0) {
      return Response.json(
        {
          success: false,
          error: `Se completó con errores parciales: ${totalCerrados} cerrados, ${totalFallidos} fallidos.`,
          fecha_actual_ar: todayAr,
          evaluados: totalEvaluados,
          cerrados: totalCerrados,
          fallidos: totalFallidos,
          porSector,
          fallosPorSector,
        },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      dry_run: body.dry_run === true,
      fecha_actual_ar: todayAr,
      evaluados: totalEvaluados,
      cerrados: totalCerrados,
      fallidos: 0,
      porSector,
    });
  } catch (error) {
    return sectorErrorResponse(error);
  }
}