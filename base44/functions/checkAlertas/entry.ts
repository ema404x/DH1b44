import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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
    let totalNotificaciones = 0;
    const resumen = [];

    // Determinar qué tipos de entidad se necesitan según las configs activas
    const tiposActivos = new Set(configs.map(c => c.tipo));
    const necesitaAssets    = tiposActivos.has('garantia_activo');
    const necesitaMaterials  = tiposActivos.has('stock_material');
    const necesitaPendientes = tiposActivos.has('pendiente_vencido');
    const necesitaWOs        = tiposActivos.has('ot_vencida');

    // Pre-cargar todas las entidades necesarias
    const [logsNoLeidos, logsHoy, assets, materials, pendientesVencidos, workOrders] = await Promise.all([
      sb.entities.AlertaLog.filter({ leida: false }, '-fecha_alerta', 200).catch(() => []),
      sb.entities.AlertaLog.list('-fecha_alerta', 500).catch(() => []),
      necesitaAssets    ? sb.entities.Asset.list('-updated_date', 500).catch(() => [])                         : Promise.resolve([]),
      necesitaMaterials  ? sb.entities.Material.list('-updated_date', 500).catch(() => [])                      : Promise.resolve([]),
      necesitaPendientes ? sb.entities.Pendiente.filter({ estado: 'pendiente' }).catch(() => [])                : Promise.resolve([]),
      necesitaWOs        ? sb.entities.WorkOrder.list('-updated_date', 500).catch(() => [])                     : Promise.resolve([]),
    ]);

    // Índice de logs de hoy para lookup O(1)
    const logsHoyFiltrados = logsHoy.filter(l => l.fecha_alerta?.startsWith(hoy));
    const keyExistenteSet = new Set(logsHoyFiltrados.map(l => `${l.tipo}::${l.entidad_id}`));
    const keyExistente = (tipo, entidadId) => keyExistenteSet.has(`${tipo}::${entidadId}`);

    // ── LIMPIEZA: marcar como leídas las alertas de entidades eliminadas ──
    if (logsNoLeidos.length > 0) {
      const tiposEnLogs = new Set(logsNoLeidos.map(l => l.entidad_tipo).filter(Boolean));
      const extraSets = {};
      const extraFetches = [];

      for (const tipo of tiposEnLogs) {
        if (tipo === 'Asset' && necesitaAssets)       { extraSets['Asset']     = new Set(assets.map(e => e.id)); continue; }
        if (tipo === 'Material' && necesitaMaterials)  { extraSets['Material']  = new Set(materials.map(e => e.id)); continue; }
        if (tipo === 'WorkOrder' && necesitaWOs)       { extraSets['WorkOrder'] = new Set(workOrders.map(e => e.id)); continue; }
        if (tipo === 'Pendiente' && necesitaPendientes){ extraSets['Pendiente'] = new Set(pendientesVencidos.map(e => e.id)); continue; }
        extraFetches.push(
          sb.entities[tipo]?.list('-created_date', 1000).catch(() => []).then(rows => {
            extraSets[tipo] = new Set(rows.map(r => r.id));
          })
        );
      }
      if (extraFetches.length > 0) await Promise.all(extraFetches);

      const toMarkRead = logsNoLeidos.filter(log => {
        if (!log.entidad_id || !log.entidad_tipo) return false;
        const set = extraSets[log.entidad_tipo];
        return set && !set.has(log.entidad_id);
      });

      if (toMarkRead.length > 0) {
        await Promise.allSettled(
          toMarkRead.map(log => sb.entities.AlertaLog.update(log.id, { leida: true }).catch(() => {}))
        );
      }
    }

    // ── Verificar intervalo mínimo de email para evitar spam ──
    const puedeEnviarEmail = (cfg) => {
      if (!cfg.ultima_email) return true;
      const horasTranscurridas = (ahora - new Date(cfg.ultima_email)) / 3600000;
      return horasTranscurridas >= (cfg.intervalo_minimo_email_horas || 24);
    };

    // ── Función para decidir si notificar según urgencia ──
    const debeNotificar = (cfg, nivel) => {
      const levelOrder = { critical: 3, warning: 2, info: 1 };
      const minimo = levelOrder[cfg.nivel_minimo_notificar || 'critical'] || 3;
      const actual = levelOrder[nivel] || 1;
      return actual >= minimo;
    };

    // ── Procesar configs ──
    for (const cfg of configs) {
      const alertasGeneradas = [];
      const alertasParaNotificar = [];

      // 1. GARANTÍA DE ACTIVOS
      if (cfg.tipo === 'garantia_activo') {
        const diasAnticipacion = cfg.dias_anticipacion || 30;
        const nuevasAlertas = [];
        for (const asset of assets) {
          if (!asset.warranty_expiry) continue;
          if (keyExistente('garantia_activo', asset.id)) continue;
          const diasRestantes = Math.ceil((new Date(asset.warranty_expiry) - ahora) / 86400000);
          if (diasRestantes <= diasAnticipacion) {
            const nivel = diasRestantes <= 7 ? 'critical' : 'warning';
            const titulo = diasRestantes < 0
              ? `Garantía VENCIDA hace ${Math.abs(diasRestantes)} días`
              : `Garantía vence en ${diasRestantes} días`;
            
            const alerta = {
              config_id: cfg.id, tipo: 'garantia_activo', nivel, titulo,
              mensaje: `El activo "${asset.name}" tiene su garantía ${diasRestantes < 0 ? 'vencida' : 'por vencer'}.`,
              entidad_tipo: 'Asset', entidad_id: asset.id, entidad_nombre: asset.name,
              email_enviado: false, leida: false, fecha_alerta: ahora.toISOString()
            };
            nuevasAlertas.push(alerta);
            
            // Solo agregar a notificar si cumple urgencia
            if (debeNotificar(cfg, nivel)) {
              alertasParaNotificar.push(alerta);
            }
            alertasGeneradas.push({ nombre: asset.name, nivel });
          }
        }
        if (nuevasAlertas.length > 0) {
          await sb.entities.AlertaLog.bulkCreate(nuevasAlertas);
          totalAlertas += nuevasAlertas.length;
        }
      }

      // 2. STOCK CRÍTICO DE MATERIALES
      if (cfg.tipo === 'stock_material') {
        const pctExtra = cfg.umbral_stock_pct || 0;
        const nuevasAlertas = [];
        for (const mat of materials) {
          if (!mat.min_stock || mat.min_stock === 0) continue;
          if (keyExistente('stock_material', mat.id)) continue;
          const umbral = mat.min_stock * (1 + pctExtra / 100);
          if (mat.stock <= umbral) {
            const nivel = mat.stock === 0 ? 'critical' : 'warning';
            const titulo = mat.stock === 0
              ? `Sin stock: ${mat.name}`
              : `Stock bajo: ${mat.name} (${mat.stock} ${mat.unit || ''})`;
            
            const alerta = {
              config_id: cfg.id, tipo: 'stock_material', nivel, titulo,
              mensaje: `El material "${mat.name}" tiene stock ${mat.stock} (mínimo: ${mat.min_stock}).`,
              entidad_tipo: 'Material', entidad_id: mat.id, entidad_nombre: mat.name,
              email_enviado: false, leida: false, fecha_alerta: ahora.toISOString()
            };
            nuevasAlertas.push(alerta);
            
            if (debeNotificar(cfg, nivel)) {
              alertasParaNotificar.push(alerta);
            }
            alertasGeneradas.push({ nombre: mat.name, nivel });
          }
        }
        if (nuevasAlertas.length > 0) {
          await sb.entities.AlertaLog.bulkCreate(nuevasAlertas);
          totalAlertas += nuevasAlertas.length;
        }
      }

      // 3. PENDIENTES VENCIDOS
      if (cfg.tipo === 'pendiente_vencido') {
        const diasLimite = cfg.dias_vencimiento_pendiente || 7;
        const nuevasAlertas = [];
        for (const p of pendientesVencidos) {
          if (!p.fecha_limite) continue;
          if (keyExistente('pendiente_vencido', p.id)) continue;
          const diasVencidos = Math.ceil((ahora - new Date(p.fecha_limite)) / 86400000);
          if (diasVencidos >= diasLimite) {
            const nivel = diasVencidos >= diasLimite * 2 ? 'critical' : 'warning';
            
            const alerta = {
              config_id: cfg.id, tipo: 'pendiente_vencido', nivel,
              titulo: `Pendiente vencido hace ${diasVencidos} días`,
              mensaje: `El pendiente "${(p.descripcion || p.establecimiento || '')?.substring(0, 60)}" lleva ${diasVencidos} días vencido.`,
              entidad_tipo: 'Pendiente', entidad_id: p.id,
              entidad_nombre: p.establecimiento || p.descripcion?.substring(0, 40) || p.id,
              email_enviado: false, leida: false, fecha_alerta: ahora.toISOString()
            };
            nuevasAlertas.push(alerta);
            
            if (debeNotificar(cfg, nivel)) {
              alertasParaNotificar.push(alerta);
            }
            alertasGeneradas.push({ nombre: p.establecimiento || p.id, nivel });
          }
        }
        if (nuevasAlertas.length > 0) {
          await sb.entities.AlertaLog.bulkCreate(nuevasAlertas);
          totalAlertas += nuevasAlertas.length;
        }
      }

      // 4. OTs VENCIDAS
      if (cfg.tipo === 'ot_vencida') {
        const diasLimite = cfg.dias_vencimiento_ot || 1;
        const nuevasAlertas = [];
        for (const ot of workOrders) {
          if (!ot.scheduled_date) continue;
          if (['completada', 'cancelada'].includes(ot.status)) continue;
          if (keyExistente('ot_vencida', ot.id)) continue;
          const diasVencidos = Math.ceil((ahora - new Date(ot.scheduled_date)) / 86400000);
          if (diasVencidos >= diasLimite) {
            const nivel = diasVencidos >= 7 ? 'critical' : 'warning';
            
            const alerta = {
              config_id: cfg.id, tipo: 'ot_vencida', nivel,
              titulo: `OT vencida hace ${diasVencidos} día${diasVencidos !== 1 ? 's' : ''}`,
              mensaje: `La OT "${ot.title}" (${ot.code || ot.id}) lleva ${diasVencidos} días sin completar.`,
              entidad_tipo: 'WorkOrder', entidad_id: ot.id, entidad_nombre: ot.title,
              email_enviado: false, leida: false, fecha_alerta: ahora.toISOString()
            };
            nuevasAlertas.push(alerta);
            
            if (debeNotificar(cfg, nivel)) {
              alertasParaNotificar.push(alerta);
            }
            alertasGeneradas.push({ nombre: ot.title, nivel });
          }
        }
        if (nuevasAlertas.length > 0) {
          await sb.entities.AlertaLog.bulkCreate(nuevasAlertas);
          totalAlertas += nuevasAlertas.length;
        }
      }

      // ── Enviar notificaciones SOLO si cumple urgencia + intervalo mínimo ──
      if (alertasParaNotificar.length > 0 && cfg.notificar_email && puedeEnviarEmail(cfg)) {
        const criticas = alertasParaNotificar.filter(a => a.nivel === 'critical');
        if (criticas.length > 0) {
          // Enviar email solo de alertas críticas
          const asunto = `🚨 ${criticas.length} ALERTA${criticas.length > 1 ? 'S' : ''} URGENTE${criticas.length > 1 ? 'S' : ''}: ${cfg.nombre}`;
          const cuerpo = `
ALERTAS CRÍTICAS DETECTADAS

${criticas.map((a, i) => `${i+1}. ${a.titulo}\n   ${a.mensaje}`).join('\n\n')}

Nivel: CRÍTICO
Tipo: ${cfg.nombre}
Fecha: ${ahora.toLocaleString('es-AR')}
          `.trim();

          if (cfg.email_destinatarios && cfg.email_destinatarios.length > 0) {
            try {
              await base44.integrations.Core.SendEmail({
                to: cfg.email_destinatarios.join(','),
                subject: asunto,
                body: cuerpo,
              });
              await sb.entities.AlertaConfig.update(cfg.id, { ultima_email: ahora.toISOString() });
              totalNotificaciones += criticas.length;
            } catch (err) {
              console.error(`Error enviando email para ${cfg.nombre}:`, err.message);
            }
          }
        }
      }

      if (alertasGeneradas.length > 0) {
        await sb.entities.AlertaConfig.update(cfg.id, { ultima_notificacion: ahora.toISOString() });
      }

      resumen.push({
        config: cfg.nombre,
        tipo: cfg.tipo,
        alertas: alertasGeneradas.length,
        notificadas: alertasParaNotificar.length,
        nivel_minimo: cfg.nivel_minimo_notificar || 'critical'
      });
    }

    return Response.json({
      success: true,
      totalAlertas,
      totalNotificaciones,
      mensaje: `${totalAlertas} alertas detectadas, ${totalNotificaciones} notificaciones enviadas (solo urgentes)`,
      resumen
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});