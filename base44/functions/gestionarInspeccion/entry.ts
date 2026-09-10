import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { resolveAndReconcileSector } from '../../shared/callerIdentity.ts';
import { fetchAll } from '../../shared/fetchAllSector.ts';
import { resolveAdminView, norm } from '../../shared/visibilityResolver.ts';

/**
 * gestionarInspeccion — Punto único de escritura/lectura para InspeccionColegio.
 *
 * PROBLEMA
 *   El frontend hacía base44.entities.InspeccionColegio.update(id, { secciones })
 *   directamente desde el cliente. Ese update pasa por la RLS de `update`, que
 *   exige `data.jefe_sitio === user.full_name` con STRING EXACTO. Pero la
 *   visibilidad (read) se resuelve con norm() (lowercase + sin acentos + trim).
 *   Resultado: el usuario VE la inspección (match normalizado) pero NO puede
 *   GUARDARLA (match exacto falla por acentos/espacios/mayúsculas) → 403
 *   silencioso → "Error al guardar la sección" → se pierde el relevamiento.
 *
 * SOLUCIÓN
 *   Una sola función backend que:
 *   1. Resuelve identidad del caller (resolveAndReconcileSector — misma fuente
 *      que getInspeccionModuleData).
 *   2. Verifica ownership con el MISMO predicado que getInspeccionModuleData:
 *      created_by_id === userId OR norm(jefe_sitio) === norm(displayName)
 *      OR establecimiento en estabsSet OR adminView.
 *      Garantiza "si lo ves, lo podés guardar".
 *   3. Escribe vía asServiceRole (bypass RLS), que no depende de string matching.
 *
 * ACCIONES
 *   - guardar_secciones: valida estructura + escribe { secciones }
 *   - set_generando:     escribe { estado:'generando', secciones, informe_generado:'' }
 *   - get:               retorna el registro completo (bypass RLS de read)
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const sb = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const { inspeccion_id, accion, secciones, estado } = body;

    if (!inspeccion_id) return Response.json({ error: 'inspeccion_id requerido' }, { status: 400 });
    if (!accion) return Response.json({ error: 'accion requerida' }, { status: 400 });

    // ── Resolver identidad canónica del caller ──
    const { sector, employee } = await resolveAndReconcileSector(sb, user);
    if (!sector) return Response.json({ error: 'Sin sector asignado' }, { status: 403 });

    const userId = user.id;
    const displayName = employee?.full_name || user.full_name || '';
    const employeeEmail = employee?.email || user.email || '';
    const targetName = norm(displayName);
    const targetEmail = employeeEmail ? norm(employeeEmail) : '';

    // ── Fetch del registro via asServiceRole (bypass RLS de read) ──
    const inspeccion = await sb.entities.InspeccionColegio.get(inspeccion_id);
    if (!inspeccion) return Response.json({ error: 'Inspección no encontrada' }, { status: 404 });

    // ── Guard de sector: el registro debe pertenecer al sector del caller ──
    if (inspeccion.sector_id !== sector) {
      return Response.json({ error: 'No tenés permiso sobre esta inspección' }, { status: 403 });
    }

    // ── Ownership check: MISMO predicado que getInspeccionModuleData ──
    // 1) Creador directo
    const isCreator = inspeccion.created_by_id && inspeccion.created_by_id === userId;

    // 2) Jefe asignado por nombre normalizado
    const isJefeByName = inspeccion.jefe_sitio && targetName
      && norm(inspeccion.jefe_sitio) === targetName;

    // 3) admin_view desde el rol del EMPLEADO (no platform role)
    const adminView = await resolveAdminView(sb, employee, 'InspeccionColegio');

    // 4) Establecimiento asignado (cruce Direccion + Asset con norm)
    let isEstablecimientoAsignado = false;
    if (!isCreator && !isJefeByName && !adminView && inspeccion.establecimiento) {
      const [dirs, assets] = await Promise.all([
        fetchAll(sb, 'Direccion', { sector_id: sector }),
        fetchAll(sb, 'Asset', { sector_id: sector }),
      ]);
      const estabsSet = new Set();
      const matchJefe = (jefeStr) => {
        if (!jefeStr) return false;
        const n = norm(jefeStr);
        return (targetName && n === targetName) || (targetEmail && n === targetEmail);
      };
      (dirs || []).forEach((d) => {
        if (matchJefe(d.jefe_sitio) && d.direccion) estabsSet.add(norm(d.direccion));
      });
      (assets || []).forEach((a) => {
        if (matchJefe(a.jefe_sitio)) {
          if (a.sede) estabsSet.add(norm(a.sede));
          if (a.location) estabsSet.add(norm(a.location));
        }
      });
      isEstablecimientoAsignado = estabsSet.has(norm(inspeccion.establecimiento));
    }

    const hasOwnership = isCreator || isJefeByName || adminView || isEstablecimientoAsignado;
    if (!hasOwnership) {
      return Response.json({ error: 'No tenés permiso sobre esta inspección' }, { status: 403 });
    }

    // ── Ejecutar acción ──
    switch (accion) {
      case 'guardar_secciones': {
        if (!Array.isArray(secciones)) {
          return Response.json({ error: 'secciones debe ser un array' }, { status: 400 });
        }
        // Validación de estructura: cada item debe tener id (string) y nombre (string).
        // fotos debe ser array si está presente. Esto previene escribir basura.
        for (const s of secciones) {
          if (!s || typeof s.id !== 'string' || typeof s.nombre !== 'string') {
            return Response.json({ error: 'Estructura de sección inválida' }, { status: 400 });
          }
          if (s.fotos !== undefined && !Array.isArray(s.fotos)) {
            return Response.json({ error: 'fotos debe ser un array' }, { status: 400 });
          }
        }
        await sb.entities.InspeccionColegio.update(inspeccion_id, { secciones });
        return Response.json({ ok: true });
      }

      case 'set_generando': {
        if (!Array.isArray(secciones)) {
          return Response.json({ error: 'secciones debe ser un array' }, { status: 400 });
        }
        await sb.entities.InspeccionColegio.update(inspeccion_id, {
          estado: 'generando',
          secciones,
          informe_generado: '',
        });
        return Response.json({ ok: true });
      }

      case 'get': {
        // Retornar el registro completo (bypass RLS de read).
        // Usado por el polling de generación de informe.
        return Response.json({ inspeccion });
      }

      case 'set_estado': {
        // Actualizar estado genérico (ej: 'en_progreso', 'completado').
        if (!estado || typeof estado !== 'string') {
          return Response.json({ error: 'estado requerido para accion=set_estado' }, { status: 400 });
        }
        const payload = { estado };
        if (Array.isArray(secciones)) payload.secciones = secciones;
        await sb.entities.InspeccionColegio.update(inspeccion_id, payload);
        return Response.json({ ok: true });
      }

      default:
        return Response.json({ error: `Acción desconocida: ${accion}` }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}