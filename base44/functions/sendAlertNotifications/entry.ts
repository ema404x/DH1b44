import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

async function sendEmailViaResend(to, subject, body) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'DH1 Software Alertas <onboarding@resend.dev>',
      to: [to],
      subject,
      text: body,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${err}`);
  }
  return await res.json();
}

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

    const relevantAlerts = alerts.filter(a =>
      !contact.alert_types?.length || contact.alert_types.includes(a.ruleId)
    );

    if (!relevantAlerts.length) continue;

    const alertLines = relevantAlerts.map(a => `• ${a.title}: ${a.message}`).join('\n');
    const subject = `🚨 Alertas del Sistema — ${relevantAlerts.length} notificacion${relevantAlerts.length > 1 ? 'es' : ''} urgente${relevantAlerts.length > 1 ? 's' : ''}`;
    const body = `Hola ${contact.name},\n\nSe han detectado las siguientes alertas en el sistema:\n\n${alertLines}\n\nIngresá al sistema para tomar acciones.\n\n— DH1 Software Platform`;

    if (contact.type === 'email') {
      try {
        await sendEmailViaResend(contact.value, subject, body);
        sent++;
      } catch (e) {
        errors.push(`Email a ${contact.value}: ${e.message}`);
      }
    } else if (contact.type === 'whatsapp') {
      errors.push(`WhatsApp a ${contact.value}: requiere integración externa (Twilio/Meta).`);
    }
  }

  return Response.json({ sent, errors, total: contacts.length });
});