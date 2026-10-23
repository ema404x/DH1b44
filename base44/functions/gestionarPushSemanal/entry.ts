import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import webpush from 'npm:web-push@3.6.7';
import { resolveCallerSectorCanonical } from '../../shared/callerIdentity.ts';

function getBuenosAiresDateParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Buenos_Aires',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const dateStr = `${values.year}-${values.month}-${values.day}`;
  const weekday = values.weekday;
  const diaLabel = weekday === 'Fri' ? 'viernes' : weekday === 'Wed' ? 'miércoles' : 'hoy';
  const isWedOrFri = weekday === 'Wed' || weekday === 'Fri';
  return { dateStr, weekday, diaLabel, isWedOrFri };
}

async function getOrCreateVapidKeys(sb) {
  const listRes = await sb.entities.SecurityConfig.list('-created_date', 1);
  const configs = Array.isArray(listRes) ? listRes : (listRes?.items || []);
  const existing = configs[0] || null;

  if (existing?.vapid_public_key && existing?.vapid_private_key) {
    return {
      publicKey: existing.vapid_public_key,
      privateKey: existing.vapid_private_key,
      configId: existing.id,
    };
  }

  const generated = webpush.generateVAPIDKeys();
  if (existing?.id) {
    await sb.entities.SecurityConfig.update(existing.id, {
      vapid_public_key: generated.publicKey,
      vapid_private_key: generated.privateKey,
    });
    return {
      publicKey: generated.publicKey,
      privateKey: generated.privateKey,
      configId: existing.id,
    };
  }

  const created = await sb.entities.SecurityConfig.create({
    vapid_public_key: generated.publicKey,
    vapid_private_key: generated.privateKey,
  });
  return {
    publicKey: generated.publicKey,
    privateKey: generated.privateKey,
    configId: created.id,
  };
}

async function fetchAllActiveSubscriptions(sb) {
  const all = [];
  let cursor = undefined;
  for (let pageIdx = 0; pageIdx < 20; pageIdx++) {
    const opts = { sort: '-created_date', limit: 200 };
    if (cursor) opts.cursor = cursor;
    const res = await sb.entities.PushSubscription.filter({ activo: true }, opts);
    if (Array.isArray(res)) {
      all.push(...res);
      break;
    }
    const items = res?.items || [];
    all.push(...items);
    if (!res?.has_more || !res?.next_cursor) break;
    cursor = res.next_cursor;
  }
  return all;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body?.action || 'status';
    const sb = base44.asServiceRole;

    if (action === 'get_vapid_key') {
      const { publicKey } = await getOrCreateVapidKeys(sb);
      return Response.json({ ok: true, publicKey });
    }

    if (action === 'subscribe') {
      const sub = body?.subscription;
      const endpoint = sub?.endpoint;
      const p256dh = sub?.keys?.p256dh;
      const auth = sub?.keys?.auth;

      if (!endpoint || !p256dh || !auth) {
        return Response.json(
          { error: 'Datos de suscripción Web Push incompletos (endpoint, p256dh, auth requeridos)' },
          { status: 400 }
        );
      }

      const { sector } = await resolveCallerSectorCanonical(sb, user).catch(() => ({
        sector: user?.data?.sector_id || user?.sector_id || null,
      }));

      const ua = String(body?.user_agent || req.headers.get('user-agent') || '').slice(0, 500);
      const isMobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
      const deviceType = body?.device_type === 'movil' || isMobileUa ? 'movil' : 'pc';

      const existingRes = await sb.entities.PushSubscription.filter({ endpoint }, { limit: 10 });
      const existingItems = Array.isArray(existingRes) ? existingRes : (existingRes?.items || []);
      const match = existingItems[0] || null;

      let saved;
      if (match?.id) {
        saved = await sb.entities.PushSubscription.update(match.id, {
          user_id: user.id,
          user_email: user.email || '',
          sector_id: sector || match.sector_id || '',
          endpoint,
          p256dh,
          auth,
          device_type: deviceType,
          user_agent: ua,
          activo: true,
        });
      } else {
        saved = await sb.entities.PushSubscription.create({
          user_id: user.id,
          user_email: user.email || '',
          sector_id: sector || '',
          endpoint,
          p256dh,
          auth,
          device_type: deviceType,
          user_agent: ua,
          activo: true,
        });
      }

      return Response.json({
        ok: true,
        subscription_id: saved.id,
        device_type: deviceType,
      });
    }

    if (action === 'unsubscribe') {
      const endpoint = body?.endpoint;
      if (!endpoint) {
        return Response.json({ error: 'Endpoint requerido' }, { status: 400 });
      }
      const existingRes = await sb.entities.PushSubscription.filter(
        { endpoint, user_id: user.id },
        { limit: 10 }
      );
      const existingItems = Array.isArray(existingRes) ? existingRes : (existingRes?.items || []);
      for (const item of existingItems) {
        await sb.entities.PushSubscription.update(item.id, { activo: false });
      }
      return Response.json({ ok: true, disabled: existingItems.length });
    }

    if (action === 'status') {
      const [{ publicKey }, userSubsRes] = await Promise.all([
        getOrCreateVapidKeys(sb),
        sb.entities.PushSubscription.filter({ user_id: user.id, activo: true }, { limit: 50 }),
      ]);
      const userSubs = Array.isArray(userSubsRes) ? userSubsRes : (userSubsRes?.items || []);
      const { dateStr, weekday, diaLabel, isWedOrFri } = getBuenosAiresDateParts();

      let totalActiveGlobal = undefined;
      let allDevices = undefined;
      if (user.role === 'admin') {
        const allActive = await fetchAllActiveSubscriptions(sb);
        totalActiveGlobal = allActive.length;
        allDevices = allActive.map((s) => ({
          id: s.id,
          user_email: s.user_email || 'Sin email',
          sector_id: s.sector_id || '',
          device_type: s.device_type || 'pc',
          user_agent: s.user_agent || '',
          ultimo_envio_fecha: s.ultimo_envio_fecha || null,
          ultimo_envio_timestamp: s.ultimo_envio_timestamp || null,
          created_date: s.created_date || null,
        }));
      }

      return Response.json({
        ok: true,
        publicKey,
        subscribed: userSubs.length > 0,
        deviceCount: userSubs.length,
        devices: userSubs.map((s) => ({
          id: s.id,
          user_email: s.user_email || user.email || '',
          device_type: s.device_type || 'pc',
          user_agent: s.user_agent || '',
          ultimo_envio_fecha: s.ultimo_envio_fecha || null,
          ultimo_envio_timestamp: s.ultimo_envio_timestamp || null,
          created_date: s.created_date || null,
        })),
        allDevices,
        todayAr: dateStr,
        weekday,
        diaLabel,
        isWedOrFri,
        ultimo_push_ot_fecha: user.ultimo_push_ot_fecha || user.data?.ultimo_push_ot_fecha || null,
        ultimo_aviso_ot_miercoles: user.ultimo_aviso_ot_miercoles || user.data?.ultimo_aviso_ot_miercoles || null,
        totalActiveGlobal,
      });
    }

    if (action === 'send_weekly_ot_push') {
      const now = new Date();
      const { dateStr: todayAr, weekday, diaLabel, isWedOrFri } = getBuenosAiresDateParts(now);
      const force = body?.force === true;
      const onlySelf = body?.only_self === true;

      if (user.role !== 'admin' && !onlySelf) {
        return Response.json(
          { error: 'Forbidden: solo administradores o el workflow programado pueden ejecutar el envío masivo' },
          { status: 403 }
        );
      }

      // Configuración editable desde "Configuración de Alertas"
      const cfgRes = await sb.entities.AlertaConfig.filter({ tipo: 'aviso_push_ot' });
      const cfgList = Array.isArray(cfgRes) ? cfgRes : (cfgRes?.items || []);
      const cfg = cfgList.find((c) => c.activo !== false) || null;

      if (!force) {
        if (!cfg) {
          return Response.json({ ok: true, skipped: true, reason: 'Aviso push desactivado o sin configurar.' });
        }
        const dayIdx = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
        const hourAr = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Buenos_Aires', hour: 'numeric', hourCycle: 'h23' }).format(now));
        const dias = Array.isArray(cfg.dias_semana) ? cfg.dias_semana : [3, 5];
        const hora = typeof cfg.hora_envio === 'number' ? cfg.hora_envio : 9;
        if (!dias.includes(dayIdx) || hourAr < hora || cfg.ultimo_envio_push === todayAr) {
          return Response.json({ ok: true, skipped: true, reason: 'Fuera del día/horario configurado o ya enviado hoy.' });
        }
      }

      const title = cfg?.titulo_push || '📋 DH1 · ¿Cómo vienen con las órdenes de trabajo?';
      const messageBody = cfg?.mensaje_push || 'Revisá el avance de las órdenes de trabajo y mantené sus estados actualizados.';
      const actionUrl = '/ordenes-trabajo';

      const { publicKey, privateKey } = await getOrCreateVapidKeys(sb);
      webpush.setVapidDetails('mailto:notificaciones@dh1m.com', publicKey, privateKey);

      const allSubs = await fetchAllActiveSubscriptions(sb);
      const allUsersRes = await sb.entities.User.list();
      const userList = Array.isArray(allUsersRes) ? allUsersRes : (allUsersRes?.items || []);
      const targetUsers = onlySelf ? userList.filter((u) => u.id === user.id) : userList;

      // Agrupar dispositivos por usuario (deduplicados por endpoint)
      const subsByUser = new Map();
      const seenEndpoints = new Set();
      for (const sub of allSubs) {
        if (!sub.user_id || !sub.endpoint || !sub.p256dh || !sub.auth) continue;
        if (seenEndpoints.has(sub.endpoint)) continue;
        seenEndpoints.add(sub.endpoint);
        if (!subsByUser.has(sub.user_id)) subsByUser.set(sub.user_id, []);
        subsByUser.get(sub.user_id).push(sub);
      }

      const payloadStr = JSON.stringify({
        title,
        body: messageBody,
        url: actionUrl,
        tag: `dh1-aviso-ot-${todayAr}`,
        date: todayAr,
      });

      const stats = { sentWeb: 0, sentMobile: 0, alreadyNotified: 0, expiredRemoved: 0, failedRetryable: 0, noChannel: 0 };

      // Intenta Web Push en todos los dispositivos del usuario. Devuelve: 'sent' | 'failed' | 'none'
      const sendWebToUser = async (subs) => {
        let anySent = false;
        let anyFailed = false;
        for (const sub of subs) {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payloadStr,
              { TTL: 86400, urgency: 'high' }
            );
            anySent = true;
            await sb.entities.PushSubscription.update(sub.id, {
              ultimo_envio_fecha: todayAr,
              ultimo_envio_timestamp: now.toISOString(),
            }).catch(() => {});
          } catch (err) {
            const statusCode = err?.statusCode || err?.status;
            if (statusCode === 404 || statusCode === 410) {
              stats.expiredRemoved++;
              await sb.entities.PushSubscription.update(sub.id, { activo: false }).catch(() => {});
            } else {
              anyFailed = true;
            }
          }
        }
        return anySent ? 'sent' : anyFailed ? 'failed' : 'none';
      };

      const processUser = async (u) => {
        const lastSent = u.ultimo_push_ot_fecha || u.data?.ultimo_push_ot_fecha || null;
        if (!force && lastSent === todayAr) {
          stats.alreadyNotified++;
          return;
        }

        // 1) Web Push primero; si llega a algún dispositivo, no se envía push nativo (evita duplicados entre canales)
        const webResult = await sendWebToUser(subsByUser.get(u.id) || []);
        let delivered = webResult === 'sent';
        if (delivered) stats.sentWeb++;

        // 2) Push móvil nativo solo si Web Push no llegó
        if (!delivered) {
          try {
            await sb.integrations.Core.SendPushNotification({
              user_id: u.id,
              title,
              content: messageBody,
              action_label: 'Ver Órdenes de Trabajo',
              action_url: actionUrl,
            });
            delivered = true;
            stats.sentMobile++;
          } catch (_) {
            // Sin app nativa: no es reintentable salvo que el Web Push haya fallado transitoriamente
          }
        }

        if (delivered) {
          // Marca por usuario SOLO tras un envío exitoso: los reintentos no le vuelven a enviar
          await sb.entities.User.update(u.id, {
            ultimo_push_ot_fecha: todayAr,
            ultimo_aviso_ot_miercoles: todayAr,
          }).catch(() => {});
        } else if (webResult === 'failed') {
          stats.failedRetryable++;
        } else {
          stats.noChannel++;
        }
      };

      for (let i = 0; i < targetUsers.length; i += 6) {
        await Promise.allSettled(targetUsers.slice(i, i + 6).filter((u) => u?.id).map(processUser));
      }

      // El día se marca como completado solo si no quedaron fallos reintentables;
      // si quedaron, la próxima ejecución horaria reintenta únicamente a esos usuarios.
      const completed = stats.failedRetryable === 0;
      if (cfg?.id && !onlySelf) {
        const upd = { ultima_notificacion: now.toISOString() };
        if (completed) upd.ultimo_envio_push = todayAr;
        await sb.entities.AlertaConfig.update(cfg.id, upd).catch(() => {});
      }

      return Response.json({
        ok: true,
        date: todayAr,
        dia: diaLabel,
        completed,
        evaluatedUsers: targetUsers.length,
        webPush: { sent: stats.sentWeb, sentWeb: stats.sentWeb, expiredRemoved: stats.expiredRemoved, failedRetryable: stats.failedRetryable },
        mobilePush: { sent: stats.sentMobile },
        alreadyNotifiedToday: stats.alreadyNotified,
        sinCanalDisponible: stats.noChannel,
      });
    }

    return Response.json({ error: `Acción desconocida: ${action}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}