import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { heredarPorUbicacion } from '../../shared/heredarPorUbicacion.ts';

/**
 * Automatización: hereda OTs/activos al nuevo jefe cuando se reasigna el
 * responsable de una ubicación en Información General (Direccion/Asset).
 * Disparada por entity automation on update de jefe_sitio.
 */
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));
    const dry_run = payload?.dry_run === true;
    const result = await heredarPorUbicacion(base44.asServiceRole, payload, dry_run);
    return Response.json({ success: true, ...result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}