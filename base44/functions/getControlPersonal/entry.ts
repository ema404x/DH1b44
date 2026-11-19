import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import { HttpError } from './util.ts';
import { resolveAcceso, resolveScope, leanEmpleado } from './scope.ts';
import { calcularHoy, contarNoFicharon } from './hoy.ts';
import { accionFichajes, accionRevisar } from './fichajes.ts';
import { accionPersona } from './persona.ts';
import { accionLugares } from './lugares.ts';
import { accionHorario, accionGuardarHorario } from './horario.ts';
import { cargarControlados } from './controlados.ts';

// Control de Personal: lectura de asistencias con visibilidad aplicada en servidor.
// No modifica el fichaje público ni sus funciones; solo lee FichajeUbicacion y
// actualiza el estado administrativo (mismos campos que la revisión del Mapa).
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e: any) => (e?.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    const sb = base44.asServiceRole;

    const acceso = await resolveAcceso(sb, user);
    if (action === 'aviso') {
      if (!acceso.canAccess) return Response.json({ count: 0 });
      return Response.json(await contarNoFicharon(sb, await resolveScope(sb, acceso)));
    }
    if (!acceso.sector) return Response.json({ error: 'Sin sector asignado' }, { status: 403 });
    if (!acceso.canAccess) return Response.json({ error: 'Sin acceso a Control de personal' }, { status: 403 });

    if (action === 'horario') {
      const control = await cargarControlados(sb, await resolveScope(sb, acceso));
      return Response.json({
        ...(await accionHorario(sb, acceso)),
        controlados: control.empleados.map(leanEmpleado).sort((a: any, b: any) => a.full_name.localeCompare(b.full_name, 'es')),
      });
    }
    if (action === 'guardarHorario') return Response.json(await accionGuardarHorario(sb, acceso, body));

    const scope = await resolveScope(sb, acceso);
    switch (action) {
      case 'hoy': return Response.json(await calcularHoy(sb, scope));
      case 'fichajes': return Response.json(await accionFichajes(sb, scope, body));
      case 'revisar': return Response.json(await accionRevisar(sb, scope, body));
      case 'lugares': return Response.json(await accionLugares(sb, scope));
      case 'persona': return Response.json(await accionPersona(sb, scope, body));
      case 'personas': return Response.json({
        personas: scope.visibleEmployees.map(leanEmpleado).sort((a: any, b: any) => a.full_name.localeCompare(b.full_name, 'es')),
      });
      default: return Response.json({ error: 'Acción inválida' }, { status: 400 });
    }
  } catch (error: any) {
    if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: error?.message || 'Error interno' }, { status: 500 });
  }
}