// base44/shared/webPushUsuario.ts
//
// Envío de un aviso Web Push a UN usuario, reutilizando la infraestructura de
// gestionarPushSemanal: mismas claves VAPID (SecurityConfig) y mismas
// suscripciones (PushSubscription). Solo lee las claves: si todavía no existen
// o el usuario no tiene dispositivos activos, no hace nada.
import webpush from 'npm:web-push@3.6.7';

const toArr = (r) => (Array.isArray(r) ? r : r?.items || []);

export async function enviarPushAUsuario(raw, { userId, email }, payload) {
  const cfg = toArr(await raw.entities.SecurityConfig.list('-created_date', 1))[0];
  if (!cfg?.vapid_public_key || !cfg?.vapid_private_key) return { sent: 0 };
  webpush.setVapidDetails('mailto:notificaciones@dh1m.com', cfg.vapid_public_key, cfg.vapid_private_key);

  const subs = [];
  if (userId) subs.push(...toArr(await raw.entities.PushSubscription.filter({ user_id: userId, activo: true })));
  if (!subs.length && email) subs.push(...toArr(await raw.entities.PushSubscription.filter({ user_email: email, activo: true })));

  let sent = 0;
  const seen = new Set();
  for (const sub of subs) {
    if (!sub.endpoint || !sub.p256dh || !sub.auth || seen.has(sub.endpoint)) continue;
    seen.add(sub.endpoint);
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        { TTL: 86400, urgency: 'high' },
      );
      sent++;
    } catch (err) {
      const code = err?.statusCode || err?.status;
      if (code === 404 || code === 410) {
        await raw.entities.PushSubscription.update(sub.id, { activo: false }).catch(() => {});
      }
    }
  }
  return { sent };
}