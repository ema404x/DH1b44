import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import { createScopedClient, SectorError } from '../../shared/sectorGuard.ts';
import { resolveCallerSectorCanonical } from '../../shared/callerIdentity.ts';
import { isAdminLevelRole } from '../../shared/roles.ts';
import { cargarItems, ordenar } from './datos.ts';
import { geocodificarLote } from './geocoder.ts';
import { aplicarCoordenadas, marcarBien, historial, HttpError } from './acciones.ts';

// Revisar ubicaciones (solo admin y gerente). Compara las coordenadas guardadas
// con las de la dirección en OpenStreetMap. Nunca cambia coordenadas por sí sola:
// solo con las acciones 'aplicar' u 'ok', disparadas por un botón.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e: any) => (e?.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));

    const { sector, employee } = await resolveCallerSectorCanonical(base44.asServiceRole, user);
    if (!sector) return Response.json({ error: 'Sin sector asignado' }, { status: 403 });
    const permitido = user.role === 'admin' || user.role === 'gerente' || isAdminLevelRole(employee?.role);
    if (!permitido) return Response.json({ error: 'Solo admin y gerente pueden revisar ubicaciones.' }, { status: 403 });

    const sb = createScopedClient(base44, sector);
    const ctx = { nombre: employee?.full_name || user.full_name || user.email || 'Usuario', email: user.email || '' };

    switch (body.action) {
      case 'listar': {
        const { items, pendientes } = await cargarItems(sb);
        const visibles = ordenar(items.filter((i: any) => !i.revisada));
        return Response.json({ items: visibles, revisadas: items.length - visibles.length, pendientes: pendientes.length, umbral: 300 });
      }
      case 'geocodificar': {
        const { pendientes } = await cargarItems(sb);
        const r = await geocodificarLote(sb, pendientes, 20);
        return Response.json({ ...r, restantes: Math.max(0, pendientes.length - r.procesadas) });
      }
      case 'aplicar': return Response.json(await aplicarCoordenadas(sb, ctx, body));
      case 'ok': return Response.json(await marcarBien(sb, ctx, body));
      case 'historial': return Response.json(await historial(sb));
      default: return Response.json({ error: 'Acción inválida' }, { status: 400 });
    }
  } catch (error: any) {
    if (error instanceof HttpError || error instanceof SectorError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: error?.message || 'Error interno' }, { status: 500 });
  }
}