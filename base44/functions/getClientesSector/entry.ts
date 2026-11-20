import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { resolveCallerSectorCanonical } from '../../shared/callerIdentity.ts';
import { fetchAll } from '../../shared/fetchAllSector.ts';
import { resolveAdminView } from '../../shared/visibilityResolver.ts';

/**
 * Proveedores/clientes visibles para el usuario actual (solo lectura).
 * - admin / gerente de plataforma: todo su sector (igual que la regla de acceso).
 * - Otros: todo su sector SOLO si su rol tiene "ver todo" en el módulo Client.
 *   Sin "ver todo" no ve ninguno (igual que la regla de acceso de Client).
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const sb = base44.asServiceRole;

    const { sector, employee } = await resolveCallerSectorCanonical(sb, user);
    if (!sector) return Response.json({ error: 'Sin sector asignado' }, { status: 403 });

    const permitido = user.role === 'admin' || user.role === 'gerente'
      || await resolveAdminView(sb, employee, 'Client', user);
    if (!permitido) return Response.json({ clientes: [], admin_view: false });

    const clientes = await fetchAll(sb, 'Client', { sector_id: sector });
    clientes.sort((a, b) => String(b.created_date || '').localeCompare(String(a.created_date || '')));
    return Response.json({ clientes, admin_view: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}