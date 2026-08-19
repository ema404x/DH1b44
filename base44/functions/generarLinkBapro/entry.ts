import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { resolveCallerSector, SectorError } from "../../shared/sectorGuard.ts";

// Genera un link de revisión BAPRO (token único) para un sector + scope de sede + mes.
// El admin comparte el link con el banco; el banco marca visto sin login.
// Usa asServiceRole directo con aislamiento manual por sector (patrón robusto).

function genToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `bpr_${hex}`;
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: solo admin' }, { status: 403 });

    const callerSector = resolveCallerSector(user);
    const sb = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const { sede_scope, sede_nombre, mes_periodo, dias_expiracion, notas, activo_ids } = body;

    const mes = mes_periodo || currentMonth();
    const dias = Math.max(1, Math.min(365, parseInt(dias_expiracion, 10) || 30));
    const expiracion = new Date(Date.now() + dias * 86400000).toISOString();

    // Calcular total de activos en scope (aislamiento por sector manual).
    let totalActivos = 0;
    let activoIdsFinal = [];
    if (Array.isArray(activo_ids) && activo_ids.length > 0) {
      activoIdsFinal = activo_ids;
      totalActivos = activo_ids.length;
    } else {
      const query = (sede_scope && sede_scope !== 'TODAS')
        ? { sector_id: callerSector, location_id: sede_scope }
        : { sector_id: callerSector };
      const activos = await sb.entities.Asset.filter(query, '-updated_date', 500).catch(() => []);
      activoIdsFinal = activos.map(a => a.id);
      totalActivos = activos.length;
    }

    const token = genToken();
    const tokenRecord = await sb.entities.RevisionBaproToken.create({
      token,
      sector_id: callerSector,
      sede_scope: sede_scope || 'TODAS',
      sede_nombre: sede_nombre || 'Todas las sedes',
      mes_periodo: mes,
      activo_ids: activoIdsFinal,
      expiracion,
      creado_por: user.full_name || user.email,
      creado_por_email: user.email,
      estado: 'activo',
      total_activos: totalActivos,
      vistos_count: 0,
      notas: notas || '',
    });

    const origin = req.headers.get('origin') || '';
    const link = `${origin}/revision-bapro/${token}`;

    return Response.json({ ok: true, token, link, expiracion, total_activos: totalActivos, mes_periodo: mes });
  } catch (err) {
    if (err instanceof SectorError) return Response.json({ error: err.message }, { status: err.status });
    console.error('generarLinkBapro error:', err);
    return Response.json({ error: `Error interno: ${err.message}` }, { status: 500 });
  }
});