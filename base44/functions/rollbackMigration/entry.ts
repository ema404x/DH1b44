import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { rollbackMigration } from '../../shared/migrationFramework.ts';

/**
 * Ejecuta el rollback de una migración desde su MigrationRecord snapshot.
 * Recibe { migration_id } y restaura los campos snapshoteados. Admin-only.
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — solo admin' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { migration_id } = body;
    if (!migration_id) {
      return Response.json({ error: 'migration_id requerido' }, { status: 400 });
    }

    const result = await rollbackMigration(base44.asServiceRole, migration_id, user.email || 'admin');
    return Response.json({ ok: true, result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}