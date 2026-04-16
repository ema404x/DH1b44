import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const isScheduled = req.headers.get('x-automation-trigger') === 'scheduled';
    let isManualTest = false;
    if (!isScheduled) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      isManualTest = true;
    }

    const sb = base44.asServiceRole;

    const configs = await sb.entities.AlertaConfig.filter({ activo: true });
    if (!configs || configs.length === 0) {
      return Response.json({ message: 'Sin configuraciones activas', alertas: 0 });
    }

    const ahora = new Date();
    const hoy = ahora.toISOString().split('T')[0];
    let totalAlertas = 0;
    const resumen = [];

    for (const cfg of configs) {
      if (!isManualTest && cfg.ultima_notificacion) {
        const ultimaFecha = cfg.ultima_notificacion.split('T')[0];
        if (ultimaFecha === hoy) continue;
      }

      const alertasGeneradas = [];

      // ── 1. GARANTÍA DE ACTIVOS ─────────────────────────────────────────
      if (cfg.tipo === 'garantia_activo') {
        const assets = await sb.entities.Asset.list();
        const diasAnticipacion = cfg.dias_anticipacion || 30;

        for (const asset of assets) {
          if (!asset.warranty_expiry) continue;
          const vencimiento = new Date(asset.warranty_expiry);
          const diasRestantes = Math.ceil((vencimiento - ahora) / (1000 * 60 * 60 * 24));

          if (diasRestantes <= diasAnticipacion) {
            const nivel = diasRestantes < 0 ? 'critical' : diasRestantes <= 7 ? 'critical' : 'warning';
            const titulo = diasRestantes < 0
              ? `Garantía VENCIDA hace ${Math.abs(diasRestantes)} días`
              : `Garantía vence en ${diasRestantes} días`;

            await sb.entities.AlertaLog.create({
              config_id: cfg.id,
              tipo: 'garantia_activo',
              nivel,
              titulo,
              mensaje: `El activo "${asset.name}" tiene su garantía ${diasRestantes < 0 ? 'vencida' : 'por vencer'}.`,
              entidad_tipo: 'Asset',
              entidad_id: asset.id,
              entidad_nombre: asset.name,
              email_enviado: false,
              leida: false,
              fecha_alerta: ahora.toISOString(),
            });

            alertasGeneradas.push({ nombre: asset.name });
            totalAlertas++;
          }
        }
      }

      // ── 2. STOCK CRÍTICO DE MATERIALES ────────────────────────────────
      if (cfg.tipo === 'stock_material') {
        const materials = await sb.entities.Material.list();
        const pctExtra = cfg.umbral_stock_pct || 0;

        for (const mat of materials) {
          if (!mat.min_stock || mat.min_stock === 0) continue;
          const umbral = mat.min_stock * (1 + pctExtra / 100);
          if (mat.stock <= umbral) {
            const nivel = mat.stock === 0 ? 'critical' : 'warning';
            const titulo = mat.stock === 0 ? 'Sin stock' : `Stock bajo (${mat.stock} ${mat.unit || ''})`;

            await sb.entities.AlertaLog.create({
              config_id: cfg.id,
              tipo: 'stock_material',
              nivel,
              titulo,
              mensaje: `El material "${mat.name}" tiene stock ${mat.stock} (mínimo: ${mat.min_stock}).`,
              entidad_tipo: 'Material',
              entidad_id: mat.id,
              entidad_nombre: mat.name,
              email_enviado: false,
              leida: false,
              fecha_alerta: ahora.toISOString(),
            });

            alertasGeneradas.push({ nombre: mat.name });
            totalAlertas++;
          }
        }
      }

      // ── 3. PENDIENTES ALTAMENTE VENCIDOS ─────────────────────────────
      if (cfg.tipo === 'pendiente_vencido') {
        const pendientes = await sb.entities.Pendiente.filter({ estado: 'pendiente' });
        const diasLimite = cfg.dias_vencimiento_pendiente || 7;

        for (const p of pendientes) {
          if (!p.fecha_limite) continue;
          const limite = new Date(p.fecha_limite);
          const diasVencidos = Math.ceil((ahora - limite) / (1000 * 60 * 60 * 24));

          if (diasVencidos >= diasLimite) {
            const nivel = diasVencidos >= diasLimite * 2 ? 'critical' : 'warning';

            await sb.entities.AlertaLog.create({
              config_id: cfg.id,
              tipo: 'pendiente_vencido',
              nivel,
              titulo: `Pendiente vencido hace ${diasVencidos} días`,
              mensaje: `El pendiente "${p.descripcion?.substring(0, 60)}" lleva ${diasVencidos} días vencido.`,
              entidad_tipo: 'Pendiente',
              entidad_id: p.id,
              entidad_nombre: p.establecimiento || p.descripcion?.substring(0, 40),
              email_enviado: false,
              leida: false,
              fecha_alerta: ahora.toISOString(),
            });

            alertasGeneradas.push({ nombre: p.establecimiento || p.descripcion?.substring(0, 40) });
            totalAlertas++;
          }
        }
      }

      resumen.push({ config: cfg.nombre, tipo: cfg.tipo, alertas: alertasGeneradas.length });
    }

    return Response.json({ success: true, totalAlertas, resumen });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});