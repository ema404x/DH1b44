import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

async function sendEmail(to, subject, html) {
  if (!RESEND_API_KEY || !to || to.length === 0) return false;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Mejores ERP <notificaciones@mejores.com.ar>',
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    }),
  });
  return res.ok;
}

function emailTemplate(titulo, items, color = '#F59E0B') {
  const rows = items.map(i => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0">
        <strong style="color:#1e293b">${i.nombre}</strong><br>
        <span style="color:#64748b;font-size:13px">${i.detalle}</span>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;white-space:nowrap">
        <span style="background:${color}22;color:${color};padding:2px 8px;border-radius:99px;font-size:12px;font-weight:600">${i.estado}</span>
      </td>
    </tr>`).join('');

  return `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"></head>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,sans-serif">
    <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
      <div style="background:${color};padding:24px 28px">
        <h2 style="margin:0;color:#fff;font-size:20px">⚠️ ${titulo}</h2>
        <p style="margin:6px 0 0;color:#ffffffcc;font-size:14px">Sistema de alertas proactivas — Mejores ERP</p>
      </div>
      <div style="padding:24px 28px">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:#f8fafc">
              <th style="padding:8px 12px;text-align:left;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.05em">Elemento</th>
              <th style="padding:8px 12px;text-align:right;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.05em">Estado</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div style="padding:16px 28px;background:#f8fafc;text-align:center">
        <p style="margin:0;color:#94a3b8;font-size:12px">Este es un mensaje automático de Mejores ERP. No respondas este correo.</p>
      </div>
    </div>
  </body>
  </html>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Verificar autenticación (puede ser llamado por automatización o admin)
    const isScheduled = req.headers.get('x-automation-trigger') === 'scheduled';
    if (!isScheduled) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sb = base44.asServiceRole;

    // Cargar configuraciones activas
    const configs = await sb.entities.AlertaConfig.filter({ activo: true });
    if (!configs || configs.length === 0) {
      return Response.json({ message: 'Sin configuraciones activas', alertas: 0 });
    }

    const ahora = new Date();
    const hoy = ahora.toISOString().split('T')[0];
    let totalAlertas = 0;
    const resumen = [];

    for (const cfg of configs) {
      // Evitar re-notificar en el mismo día
      if (cfg.ultima_notificacion) {
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

            // Crear log de alerta
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

            alertasGeneradas.push({
              nombre: asset.name,
              detalle: `Ubicación: ${asset.location || 'N/D'} · Modelo: ${asset.model || 'N/D'}`,
              estado: diasRestantes < 0 ? `Vencida hace ${Math.abs(diasRestantes)}d` : `Vence en ${diasRestantes}d`,
            });
            totalAlertas++;
          }
        }

        if (alertasGeneradas.length > 0 && cfg.notificar_email && cfg.email_destinatarios?.length > 0) {
          const html = emailTemplate(
            `${alertasGeneradas.length} activo(s) con garantía próxima a vencer`,
            alertasGeneradas,
            '#8B5CF6'
          );
          const sent = await sendEmail(cfg.email_destinatarios, `⚠️ Alerta de Garantías — ${alertasGeneradas.length} activo(s)`, html);
          if (sent) {
            await sb.entities.AlertaConfig.update(cfg.id, { ultima_notificacion: ahora.toISOString() });
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

            alertasGeneradas.push({
              nombre: mat.name,
              detalle: `Stock actual: ${mat.stock} ${mat.unit || ''} · Mínimo: ${mat.min_stock} ${mat.unit || ''}`,
              estado: mat.stock === 0 ? '🚨 Sin stock' : `⚠️ Stock bajo`,
            });
            totalAlertas++;
          }
        }

        if (alertasGeneradas.length > 0 && cfg.notificar_email && cfg.email_destinatarios?.length > 0) {
          const html = emailTemplate(
            `${alertasGeneradas.length} material(es) con stock crítico`,
            alertasGeneradas,
            '#EF4444'
          );
          await sendEmail(cfg.email_destinatarios, `🚨 Alerta de Stock Crítico — ${alertasGeneradas.length} material(es)`, html);
          await sb.entities.AlertaConfig.update(cfg.id, { ultima_notificacion: ahora.toISOString() });
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

            alertasGeneradas.push({
              nombre: p.establecimiento || p.descripcion?.substring(0, 40) || 'Sin nombre',
              detalle: `Inspector: ${p.inspector || 'N/D'} · SAP: ${p.numero_sap || 'N/D'}`,
              estado: `Vencido ${diasVencidos}d`,
            });
            totalAlertas++;
          }
        }

        if (alertasGeneradas.length > 0 && cfg.notificar_email && cfg.email_destinatarios?.length > 0) {
          const html = emailTemplate(
            `${alertasGeneradas.length} pendiente(s) altamente vencido(s)`,
            alertasGeneradas,
            '#F59E0B'
          );
          await sendEmail(cfg.email_destinatarios, `⏰ Alerta de Pendientes Vencidos — ${alertasGeneradas.length}`, html);
          await sb.entities.AlertaConfig.update(cfg.id, { ultima_notificacion: ahora.toISOString() });
        }
      }

      resumen.push({ config: cfg.nombre, tipo: cfg.tipo, alertas: alertasGeneradas.length });
    }

    return Response.json({ success: true, totalAlertas, resumen });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});