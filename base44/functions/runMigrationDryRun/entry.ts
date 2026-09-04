import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { runDryRun } from '../../shared/migrationFramework.ts';

/**
 * Ejecuta un dry-run de migración. SOLO LECTURA — nunca escribe.
 * Recibe { scanner_id, params } y devuelve un reporte estructurado.
 * Admin-only: las migraciones tocan datos sensibles.
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — solo admin' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { scanner_id, params } = body;
    if (!scanner_id) {
      return Response.json({ error: 'scanner_id requerido' }, { status: 400 });
    }

    const report = await runDryRun(base44.asServiceRole, scanner_id, params || {});
    return Response.json({ ok: true, report });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}