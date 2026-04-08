import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { contacts, alerts } = await req.json();

  if (!contacts?.length || !alerts?.length) {
    return Response.json({ sent: 0, message: 'No hay contactos o alertas para enviar' });
  }

  let sent = 0;
  const errors = [];

  for (const contact of contacts) {
    if (!contact.active) continue;

    // Filtrar alertas relevantes para este contacto
    const relevantAlerts = alerts.filter(a =>
      !contact.alert_types?.length || contact.alert_types.includes(a.ruleId)
    );

    if (!relevantAlerts.length) continue;

    const alertLines = relevantAlerts.map(a => `• ${a.title}: ${a.message}`).join('\n');
    const subject = `🚨 Alertas del Sistema — ${relevantAlerts.length} notificacion${relevantAlerts.length > 1 ? 'es' : ''} urgente${relevantAlerts.length > 1 ? 's' : ''}`;
    const body = `Hola ${contact.name},\n\nSe han detectado las siguientes alertas en el sistema:\n\n${alertLines}\n\nIngresá al sistema para tomar acciones.\n\n— DH1 Software Platform`;

    if (contact.type === 'email') {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: contact.value,
          subject,
          body,
          from_name: 'DH1 Software Alertas',
        });
        sent++;
      } catch (e) {
        errors.push(`Email a ${contact.value}: ${e.message}`);
      }
    } else if (contact.type === 'whatsapp') {
      // WhatsApp: registramos que debería enviarse (requiere integración externa tipo Twilio/Meta)
      // Por ahora lo dejamos como pendiente y registramos el intento
      errors.push(`WhatsApp a ${contact.value}: requiere integración externa (Twilio/Meta). Pendiente de configurar.`);
    }
  }

  return Response.json({ sent, errors, total: contacts.length });
});