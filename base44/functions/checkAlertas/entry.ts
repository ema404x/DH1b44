import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const isScheduled = req.headers.get('x-automation-trigger') === 'scheduled';
    if (!isScheduled) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
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

    // ── LIMPIEZA: marcar como leídas las alertas de entidades eliminadas ──
    const logsNoLeidos = await sb.entities.AlertaLog.filter({ leida: false }, '-fecha_alerta', 200).catch(() => []);
    if (logsNoLeidos.length > 0) {
      await Promise.allSettled(logsNoLeidos.map(async (log) => {
        if (!log.entidad_id || !log.entidad_tipo) return;
        try {
          let items = [];
          if (log.entidad_tipo === 'Pendiente')   items = await sb.entities.Pendiente.filter({ id: log.entidad_id });
          else if (log.entidad_tipo === 'Asset')   items = await sb.entities.Asset.filter({ id: log.entidad_id });
          else if (log.entidad_tipo === 'Material') items = await sb.entities.Material.filter({ id: log.entidad_id });
          else if (log.entidad_tipo === 'WorkOrder') items = await sb.entities.WorkOrder.filter({ id: log.entidad_id });
          else return; // tipo desconocido, conservar

          if (items.length === 0) {
            await sb.entities.AlertaLog.update(log.id, { leida: true });
          }
        } catch { /* ignorar errores individuales */ }
      }));
    }

    // Pre-cargar logs de hoy para evitar duplicados
    const logsHoy = await sb.entities.AlertaLog.list('-fecha_alerta', 500);
    const logsHoyFiltrados = logsHoy.filter(l => l.fecha_alerta?.startsWith(hoy));
    const keyExistente = (tipo, entidadId) =>
      logsHoyFiltrados.some(l => l.tipo === tipo && l.entidad_id === entidadId);

    for (const cfg of configs) {
      const alertasGeneradas = [];

      // ── 1. GARANTÍA DE ACTIVOS ────────────────────────────────────────
      if (cfg.tipo === 'garantia_activo') {
        const assets = await sb.entities.Asset.list();
        const diasAnticipacion = cfg.dias_anticipacion || 30;

        for (const asset of assets) {
          if (!asset.warranty_expiry) continue;
          if (keyExistente('garantia_activo', asset.id)) continue;

          const vencimiento = new Date(asset.warranty_expiry);
          const diasRestantes = Math.ceil((vencimiento - ahora) / (1000 * 60 * 60 * 24));

          if (diasRestantes <= diasAnticipacion) {
            const nivel = diasRestantes <= 0 ? 'critical' : diasRestantes <= 7 ? 'critical' : 'warning';
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
            alertasGeneradas.push({ nombre: asset.name, nivel });
            totalAlertas++;
          }
        }
      }

      // ── 2. STOCK CRÍTICO DE MATERIALES ───────────────────────────────
      if (cfg.tipo === 'stock_material') {
        const materials = await sb.entities.Material.list();
        const pctExtra = cfg.umbral_stock_pct || 0;

        for (const mat of materials) {
          if (!mat.min_stock || mat.min_stock === 0) continue;
          if (keyExistente('stock_material', mat.id)) continue;

          const umbral = mat.min_stock * (1 + pctExtra / 100);
          if (mat.stock <= umbral) {
            const nivel = mat.stock === 0 ? 'critical' : 'warning';
            const titulo = mat.stock === 0
              ? `Sin stock: ${mat.name}`
              : `Stock bajo: ${mat.name} (${mat.stock} ${mat.unit || ''})`;

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
            alertasGeneradas.push({ nombre: mat.name, nivel });
            totalAlertas++;
          }
        }
      }

      // ── 3. PENDIENTES ALTAMENTE VENCIDOS ─────────────────────────────
      if (cfg.tipo === 'pendiente_vencido') {
        // Solo estados que realmente siguen abiertos (no resueltos ni eliminados)
        const pendientes = await sb.entities.Pendiente.filter({ estado: 'pendiente' })
          .catch(() => []);
        const diasLimite = cfg.dias_vencimiento_pendiente || 7;

        for (const p of pendientes) {
          if (!p.fecha_limite) continue;
          if (keyExistente('pendiente_vencido', p.id)) continue;

          const limite = new Date(p.fecha_limite);
          const diasVencidos = Math.ceil((ahora - limite) / (1000 * 60 * 60 * 24));

          if (diasVencidos >= diasLimite) {
            const nivel = diasVencidos >= diasLimite * 2 ? 'critical' : 'warning';

            await sb.entities.AlertaLog.create({
              config_id: cfg.id,
              tipo: 'pendiente_vencido',
              nivel,
              titulo: `Pendiente vencido hace ${diasVencidos} días`,
              mensaje: `El pendiente "${(p.descripcion || p.establecimiento || '')?.substring(0, 60)}" lleva ${diasVencidos} días vencido.`,
              entidad_tipo: 'Pendiente',
              entidad_id: p.id,
              entidad_nombre: p.establecimiento || p.descripcion?.substring(0, 40) || p.id,
              email_enviado: false,
              leida: false,
              fecha_alerta: ahora.toISOString(),
            });
            alertasGeneradas.push({ nombre: p.establecimiento || p.id, nivel });
            totalAlertas++;
          }
        }
      }

      // ── 4. OTs VENCIDAS ──────────────────────────────────────────────
      if (cfg.tipo === 'ot_vencida') {
        const orders = await sb.entities.WorkOrder.list();
        const diasLimite = cfg.dias_vencimiento_ot || 1;

        for (const ot of orders) {
          if (!ot.scheduled_date) continue;
          if (['completada', 'cancelada'].includes(ot.status)) continue;
          if (keyExistente('ot_vencida', ot.id)) continue;

          const fecha = new Date(ot.scheduled_date);
          const diasVencidos = Math.ceil((ahora - fecha) / (1000 * 60 * 60 * 24));

          if (diasVencidos >= diasLimite) {
            const nivel = diasVencidos >= 7 ? 'critical' : 'warning';

            await sb.entities.AlertaLog.create({
              config_id: cfg.id,
              tipo: 'ot_vencida',
              nivel,
              titulo: `OT vencida hace ${diasVencidos} día${diasVencidos !== 1 ? 's' : ''}`,
              mensaje: `La OT "${ot.title}" (${ot.code || ot.id}) lleva ${diasVencidos} días sin completar.`,
              entidad_tipo: 'WorkOrder',
              entidad_id: ot.id,
              entidad_nombre: ot.title,
              email_enviado: false,
              leida: false,
              fecha_alerta: ahora.toISOString(),
            });
            alertasGeneradas.push({ nombre: ot.title, nivel });
            totalAlertas++;
          }
        }
      }

      // Actualizar ultima_notificacion si se generaron alertas
      if (alertasGeneradas.length > 0) {
        await sb.entities.AlertaConfig.update(cfg.id, {
          ultima_notificacion: ahora.toISOString(),
        });
      }

      resumen.push({ config: cfg.nombre, tipo: cfg.tipo, alertas: alertasGeneradas.length });
    }

    return Response.json({ success: true, totalAlertas, resumen });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});