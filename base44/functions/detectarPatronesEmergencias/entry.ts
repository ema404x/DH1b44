import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const isScheduled = req.headers.get('x-automation-trigger') === 'scheduled';
    if (!isScheduled) {
      const user = await base44.auth.me();
      if (!user || user.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const sb = base44.asServiceRole;
    const ahora = new Date();
    const hace30dias = new Date(ahora); hace30dias.setDate(ahora.getDate() - 30);

    const emergencias = await sb.entities.Emergencia.list('-created_date', 500);

    // Filtrar emergencias del último mes
    const recientes = emergencias.filter(e => new Date(e.created_date) >= hace30dias);

    // Agrupar por establecimiento
    const porEstab = {};
    recientes.forEach(e => {
      const key = e.establecimiento;
      if (!key) return;
      if (!porEstab[key]) porEstab[key] = [];
      porEstab[key].push(e);
    });

    const UMBRAL_PATRON = 3; // 3 o más emergencias en 30 días = patrón
    const patrones = [];

    for (const [estab, emgs] of Object.entries(porEstab)) {
      if (emgs.length >= UMBRAL_PATRON) {
        const tipos = emgs.map(e => e.tipo).filter(Boolean);
        const tipoMasFrecuente = tipos.sort((a, b) =>
          tipos.filter(t => t === b).length - tipos.filter(t => t === a).length
        )[0];

        patrones.push({ estab, cantidad: emgs.length, tipoMasFrecuente });

        // Crear alerta en AlertaLog
        const alertaExistente = await sb.entities.AlertaLog.filter({
          tipo: 'pendiente_vencido',
          entidad_nombre: estab,
          leida: false,
        });

        const tituloAlerta = `⚠️ Patrón detectado: ${emgs.length} emergencias en 30 días`;
        const yaAlertado = alertaExistente.some(a => a.titulo === tituloAlerta);

        if (!yaAlertado) {
          await sb.entities.AlertaLog.create({
            tipo: 'pendiente_vencido',
            nivel: 'critical',
            titulo: tituloAlerta,
            mensaje: `El establecimiento "${estab}" registró ${emgs.length} emergencias en los últimos 30 días. Tipo más frecuente: ${tipoMasFrecuente || 'variado'}. Se recomienda inspección preventiva.`,
            entidad_tipo: 'Emergencia',
            entidad_nombre: estab,
            email_enviado: false,
            leida: false,
            fecha_alerta: ahora.toISOString(),
          });
        }
      }
    }

    return Response.json({
      success: true,
      emergenciasAnalizadas: recientes.length,
      patronesDetectados: patrones.length,
      patrones,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});