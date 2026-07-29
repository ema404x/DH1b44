import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const isScheduled = req.headers.get('x-automation-trigger') === 'scheduled';
    let sectorFilter: string | null = null;
    if (!isScheduled) {
      const user = await base44.auth.me();
      if (!user || user.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      // Aislar datos por sector del admin (multi-tenant)
      sectorFilter = (user as any).data?.sector_id || null;
    }

    const sb = base44.asServiceRole;
    const ahora = new Date();
    const hace7dias = new Date(ahora); hace7dias.setDate(ahora.getDate() - 7);

    // Traer datos (filtrados por sector en triggers manuales)
    const sectorMatch = (e: any) => !sectorFilter || !e.sector_id || e.sector_id === sectorFilter;
    const [allPendientes, allOts, allEmergencias, users, allUsageLogs] = await Promise.all([
      sb.entities.Pendiente.list('-created_date', 500),
      sb.entities.WorkOrder.list('-created_date', 500),
      sb.entities.Emergencia.list('-created_date', 50),
      sb.entities.User.list(),
      sb.entities.AppUsageLog.list('-created_date', 500),
    ]);
    const pendientes = allPendientes.filter(sectorMatch);
    const ots = allOts.filter(sectorMatch);
    const emergencias = allEmergencias.filter(sectorMatch);
    const usageLogs = allUsageLogs.filter(sectorMatch);

    // ── Tiempo de uso de la app por usuario (últimos 7 días) ────────────────
    const usoMap = {};
    usageLogs.forEach(u => {
      if (!u.date || new Date(u.date) < hace7dias) return;
      const nombre = u.user_name || u.user_email || 'Sin nombre';
      if (!usoMap[nombre]) usoMap[nombre] = 0;
      usoMap[nombre] += u.active_seconds || 0;
    });

    const usoPorUsuario = Object.entries(usoMap)
      .map(([nombre, seconds]) => ({ nombre, horas: +(seconds / 3600).toFixed(1) }))
      .sort((a, b) => b.horas - a.horas);

    // Agrupar pendientes por jefe de sitio
    const jefesMap = {};
    pendientes.forEach(p => {
      const jefe = p.jefe_sitio_email || p.jefe_sitio;
      if (!jefe) return;
      if (!jefesMap[jefe]) jefesMap[jefe] = { nombre: p.jefe_sitio, email: p.jefe_sitio_email, pends: [] };
      jefesMap[jefe].pends.push(p);
    });

    const resumenGlobal = {
      totalPendientes: pendientes.filter(p => p.estado !== 'resuelto' && p.estado !== 'cancelado').length,
      vencidos: pendientes.filter(p => p.fecha_limite && new Date(p.fecha_limite) < ahora && p.estado !== 'resuelto' && p.estado !== 'cancelado').length,
      resueltosSemana: pendientes.filter(p => p.fecha_resolucion && new Date(p.fecha_resolucion) >= hace7dias).length,
      otsCompletadasSemana: ots.filter(o => o.status === 'completada' && o.completed_date && new Date(o.completed_date) >= hace7dias).length,
      otsNuevasSemana: ots.filter(o => new Date(o.created_date) >= hace7dias).length,
      emergenciasActivas: emergencias.filter(e => e.estado === 'activa' || e.estado === 'en_atencion').length,
    };

    // Enviar email a admins con RESEND_API_KEY (filtrados por sector en triggers manuales)
    const adminEmails = users
      .filter(u => u.role === 'admin' && u.email)
      .filter(u => !sectorFilter || !(u as any).data?.sector_id || (u as any).data.sector_id === sectorFilter)
      .map(u => u.email);
    
    let emailsEnviados = 0;
    const apiKey = Deno.env.get('RESEND_API_KEY');

    if (apiKey && adminEmails.length > 0) {
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f1e34; color: #e2e8f0; padding: 24px; border-radius: 12px;">
          <h1 style="color: #3b82f6; margin-bottom: 8px;">📊 Resumen Semanal DH1</h1>
          <p style="color: #94a3b8; margin-top: 0;">${ahora.toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 24px 0;">
            <div style="background: #1e3a5f; border-radius: 8px; padding: 16px; text-align: center;">
              <div style="font-size: 28px; font-weight: bold; color: #fbbf24;">${resumenGlobal.vencidos}</div>
              <div style="font-size: 12px; color: #94a3b8;">Pendientes Vencidos</div>
            </div>
            <div style="background: #1e3a5f; border-radius: 8px; padding: 16px; text-align: center;">
              <div style="font-size: 28px; font-weight: bold; color: #10b981;">${resumenGlobal.resueltosSemana}</div>
              <div style="font-size: 12px; color: #94a3b8;">Resueltos Esta Semana</div>
            </div>
            <div style="background: #1e3a5f; border-radius: 8px; padding: 16px; text-align: center;">
              <div style="font-size: 28px; font-weight: bold; color: #a78bfa;">${resumenGlobal.otsCompletadasSemana}</div>
              <div style="font-size: 12px; color: #94a3b8;">OTs Completadas</div>
            </div>
            <div style="background: ${resumenGlobal.emergenciasActivas > 0 ? '#7f1d1d' : '#1e3a5f'}; border-radius: 8px; padding: 16px; text-align: center;">
              <div style="font-size: 28px; font-weight: bold; color: ${resumenGlobal.emergenciasActivas > 0 ? '#f87171' : '#e2e8f0'};">${resumenGlobal.emergenciasActivas}</div>
              <div style="font-size: 12px; color: #94a3b8;">Emergencias Activas</div>
            </div>
          </div>

          <div style="background: #1e3a5f; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
            <h3 style="color: #e2e8f0; margin-top: 0;">📋 Estado General</h3>
            <p style="margin: 4px 0; color: #94a3b8;">• Pendientes sin resolver: <strong style="color: #fbbf24;">${resumenGlobal.totalPendientes}</strong></p>
            <p style="margin: 4px 0; color: #94a3b8;">• OTs nuevas esta semana: <strong style="color: #a78bfa;">${resumenGlobal.otsNuevasSemana}</strong></p>
          </div>

          ${usoPorUsuario.length > 0 ? `
          <div style="background: #1e3a5f; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
            <h3 style="color: #e2e8f0; margin-top: 0; margin-bottom: 12px;">⏱️ Tiempo de Uso de la App por Usuario (7 días)</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <thead>
                <tr style="border-bottom: 1px solid #3b5170;">
                  <th style="text-align: left; padding: 6px 8px; color: #94a3b8;">Usuario</th>
                  <th style="text-align: right; padding: 6px 8px; color: #94a3b8;">Horas de Uso</th>
                </tr>
              </thead>
              <tbody>
                ${usoPorUsuario.map(u => `
                  <tr style="border-bottom: 1px solid #1e3a5f;">
                    <td style="padding: 6px 8px; color: #e2e8f0;">${u.nombre}</td>
                    <td style="padding: 6px 8px; text-align: right; color: #06b6d4; font-weight: 600;">${u.horas}h</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}

          <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 24px;">
            Generado automáticamente por DH1 ERP · ${ahora.toLocaleString('es-AR')}
          </p>
        </div>
      `;

      for (const email of adminEmails) {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'DH1 ERP <noreply@dh1.com.ar>',
            to: [email],
            subject: `📊 Resumen Semanal DH1 — ${ahora.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}`,
            html: htmlContent,
          }),
        });
        if (res.ok) emailsEnviados++;
      }
    }

    return Response.json({ success: true, resumenGlobal, usoPorUsuario, emailsEnviados, jefesSinEmail: Object.keys(jefesMap).length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});