import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Bell, CheckCircle2, ClipboardList, Laptop, Loader2, Send, Smartphone, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function isWebPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export default function AvisoSemanalOT() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [diaLabel, setDiaLabel] = useState('miércoles');
  const [isWedOrFri, setIsWedOrFri] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [permissionState, setPermissionState] = useState('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [lastTestResult, setLastTestResult] = useState(null);
  const [vapidPublicKey, setVapidPublicKey] = useState(null);
  const [deviceCount, setDeviceCount] = useState(0);
  const [totalActiveGlobal, setTotalActiveGlobal] = useState(null);
  const checked = useRef(null);

  const registerBrowserPushSubscription = useCallback(async (pubKey) => {
    if (!isWebPushSupported() || !pubKey) return false;
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(pubKey),
      });
    }

    const subJson = sub.toJSON();
    const isMobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
    const res = await base44.functions.invoke('gestionarPushSemanal', {
      action: 'subscribe',
      subscription: subJson,
      user_agent: navigator.userAgent || '',
      device_type: isMobileUa ? 'movil' : 'pc',
    });

    if (res?.data?.ok) {
      setIsSubscribed(true);
      setPermissionState(Notification.permission);
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const supported = isWebPushSupported();
    setPushSupported(supported);
    if (supported) {
      setPermissionState(Notification.permission);
    }

    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Buenos_Aires',
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const date = `${values.year}-${values.month}-${values.day}`;
    const key = `${user.id}:${date}`;
    const wedOrFri = values.weekday === 'Wed' || values.weekday === 'Fri';

    if (checked.current === key) return;
    checked.current = key;

    setIsWedOrFri(wedOrFri);
    setDiaLabel(values.weekday === 'Fri' ? 'viernes' : 'miércoles');

    const initPushAndNotice = async () => {
      const statusRes = await base44.functions.invoke('gestionarPushSemanal', { action: 'status' }).catch(() => null);
      const statusData = statusRes?.data || {};
      const pubKey = statusData.publicKey || null;
      setVapidPublicKey(pubKey);
      setDeviceCount(statusData.deviceCount || 0);
      if (typeof statusData.totalActiveGlobal === 'number') {
        setTotalActiveGlobal(statusData.totalActiveGlobal);
      }

      let deviceReady = Boolean(statusData.subscribed);

      // Si el usuario ya concedió permiso en este navegador, sincronizar su suscripción Web Push automáticamente
      if (supported && Notification.permission === 'granted' && pubKey) {
        const synced = await registerBrowserPushSubscription(pubKey).catch(() => false);
        if (synced) {
          deviceReady = true;
          setDeviceCount((c) => Math.max(c, 1));
        }
      }

      setIsSubscribed(deviceReady);

      const alreadyNotifiedToday =
        statusData.ultimo_aviso_ot_miercoles === date ||
        statusData.ultimo_push_ot_fecha === date ||
        user.ultimo_aviso_ot_miercoles === date ||
        user.data?.ultimo_aviso_ot_miercoles === date;

      // Si aún no tiene ningún dispositivo registrado en Web Push, mostrar el diálogo para activar y probar
      if (!deviceReady) {
        setOpen(true);
      } else if (wedOrFri && !alreadyNotifiedToday) {
        await base44.auth.updateMe({ ultimo_aviso_ot_miercoles: date }).catch(() => {});
        setOpen(true);
      }
    };

    initPushAndNotice();
  }, [user?.id, registerBrowserPushSubscription]);

  useEffect(() => {
    const handleOpenPushConfig = () => setOpen(true);
    window.addEventListener('dh1:open-push-config', handleOpenPushConfig);
    return () => window.removeEventListener('dh1:open-push-config', handleOpenPushConfig);
  }, []);

  const ensureCurrentDeviceSubscribed = async () => {
    if (!pushSupported) return false;

    let perm = Notification.permission;
    if (perm !== 'granted') {
      perm = await Notification.requestPermission();
      setPermissionState(perm);
    }
    if (perm !== 'granted') {
      return false;
    }

    let pubKey = vapidPublicKey;
    if (!pubKey) {
      const res = await base44.functions.invoke('gestionarPushSemanal', { action: 'get_vapid_key' });
      pubKey = res?.data?.publicKey;
      setVapidPublicKey(pubKey);
    }

    const ok = await registerBrowserPushSubscription(pubKey);
    if (ok) {
      setDeviceCount((c) => Math.max(c, 1));
    }
    return ok;
  };

  const handleEnablePush = async () => {
    if (!pushSupported) {
      toast.error('Este navegador no admite notificaciones Web Push.');
      return;
    }
    setSubscribing(true);
    try {
      const ok = await ensureCurrentDeviceSubscribed();
      if (ok) {
        toast.success('Notificaciones push activadas en este dispositivo (PC / móvil).');
      } else {
        toast.error('Debés permitir las notificaciones en el navegador para recibir avisos con DH1 cerrada.');
      }
    } catch (err) {
      toast.error(err?.message || 'Error al activar las notificaciones push.');
    } finally {
      setSubscribing(false);
    }
  };

  const handleSendPushNow = async (onlySelf = true) => {
    setSendingTest(true);
    setLastTestResult(null);
    try {
      // 1. Si es prueba en mi dispositivo y el navegador soporta Web Push, asegurar suscripción activa primero
      let browserSubscribed = isSubscribed;
      if (onlySelf && pushSupported && (!isSubscribed || Notification.permission !== 'granted')) {
        browserSubscribed = await ensureCurrentDeviceSubscribed().catch(() => false);
      }

      // 2. Disparar el envío push real desde el servidor (Web Push + Push Móvil Nativo)
      const res = await base44.functions.invoke('gestionarPushSemanal', {
        action: 'send_weekly_ot_push',
        force: true,
        only_self: onlySelf,
      });
      const data = res?.data || {};
      const webSent = data.webPush?.sent ?? 0;
      const mobileSent = data.mobilePush?.sent ?? 0;

      // 3. Si el navegador tiene permiso concedido pero está en un entorno (ej. visor embebido) donde Web Push aún no tenía suscripción, disparar también notificación local del sistema para verificar visualmente
      let localShown = false;
      if (onlySelf && webSent === 0 && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          const reg = await navigator.serviceWorker?.getRegistration('/');
          if (reg?.showNotification) {
            await reg.showNotification('📋 DH1 · ¿Cómo vienen con las órdenes de trabajo?', {
              body: `Es ${diaLabel}: revisá el avance de las órdenes de trabajo y mantené sus estados actualizados.`,
              tag: 'dh1-aviso-ot-test',
              renotify: true,
            });
            localShown = true;
          } else {
            new Notification('📋 DH1 · ¿Cómo vienen con las órdenes de trabajo?', {
              body: `Es ${diaLabel}: revisá el avance de las órdenes de trabajo y mantené sus estados actualizados.`,
            });
            localShown = true;
          }
        } catch (_) {}
      }

      setLastTestResult({
        webSent,
        mobileSent,
        localShown,
        browserSubscribed,
      });

      if (webSent > 0 || mobileSent > 0 || localShown) {
        toast.success(
          `Notificación enviada (${webSent} Web Push${mobileSent > 0 ? `, ${mobileSent} móvil nativo` : ''}${localShown ? ', alerta local del navegador' : ''}).`
        );
      } else {
        toast.warning(
          'Aún no hay dispositivos Web Push suscriptos. Hacé clic en "Activar notificaciones push" y aceptá el permiso del navegador.'
        );
      }
    } catch (err) {
      toast.error(err?.message || 'No se pudo enviar la notificación push.');
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md w-[calc(100%-2rem)] rounded-2xl border-border bg-card text-card-foreground p-6 space-y-4">
        <div className="flex items-center gap-3 text-primary">
          <div className="rounded-xl bg-primary/10 p-3">
            <ClipboardList className="h-6 w-6" />
          </div>
          <div>
            <span className="text-sm font-semibold tracking-wide block">DH1 · Aviso automático Miércoles y Viernes</span>
            <span className="text-xs text-muted-foreground">Notificaciones Push en PC y Móvil (sin correo)</span>
          </div>
        </div>

        <DialogHeader className="text-left space-y-2">
          <DialogTitle className="text-2xl leading-tight">
            ¿Cómo vienen con las órdenes de trabajo?
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            {isWedOrFri
              ? `Es ${diaLabel}: revisá el avance de las órdenes de trabajo y mantené sus estados actualizados.`
              : 'Activá las notificaciones push en tu dispositivo para recibir automáticamente los miércoles y viernes el recordatorio de avance de OTs aunque tengas DH1 cerrada.'}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-2.5 text-xs">
          <div className="flex items-start gap-2.5">
            <Laptop className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-foreground flex items-center justify-between gap-2">
                <span>PC y Navegador (Web Push)</span>
                {isSubscribed && permissionState === 'granted' ? (
                  <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Activo ({deviceCount})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-400 font-semibold">
                    <AlertCircle className="h-3.5 w-3.5" /> Requiere permiso
                  </span>
                )}
              </div>
              <p className="text-muted-foreground mt-0.5">
                Llega en segundo plano con DH1 cerrada si aceptás permisos y tu navegador/sistema admite Web Push.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 pt-2 border-t border-border/60">
            <Smartphone className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-foreground flex items-center justify-between gap-2">
                <span>Móvil (App nativa / PWA)</span>
                <span className="text-primary font-semibold">Mié y Vie · 09:00 hs</span>
              </div>
              <p className="text-muted-foreground mt-0.5">
                En Android podés suscribir el navegador aquí mismo; el push nativo iOS/Android llega a quienes tengan la app móvil instalada con credenciales push habilitadas.
              </p>
            </div>
          </div>
        </div>

        {lastTestResult && (
          <div className="rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2.5 text-xs space-y-1">
            <div className="font-semibold text-primary">Resultado de la prueba:</div>
            <div className="text-foreground">
              • Web Push (PC / navegador móvil): <strong>{lastTestResult.webSent}</strong> enviado(s)
              {lastTestResult.localShown ? ' (notificación mostrada en este navegador)' : ''}
            </div>
            <div className="text-foreground">
              • Push móvil nativo (app instalada): <strong>{lastTestResult.mobileSent}</strong> enviado(s)
            </div>
          </div>
        )}

        <div className="space-y-2 pt-1">
          {pushSupported && (!isSubscribed || permissionState !== 'granted') && (
            <Button
              className="min-h-12 w-full gap-2 font-semibold"
              onClick={handleEnablePush}
              disabled={subscribing || sendingTest}
            >
              {subscribing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Bell className="h-4 w-4" />
              )}
              1. Activar notificaciones push en este dispositivo
            </Button>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant={isSubscribed && permissionState === 'granted' ? 'default' : 'outline'}
              className="min-h-11 flex-1 text-xs gap-1.5 font-semibold"
              onClick={() => handleSendPushNow(true)}
              disabled={sendingTest || subscribing}
            >
              {sendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Probar push en mi dispositivo ahora
            </Button>
            {user?.role === 'admin' && (
              <Button
                variant="outline"
                className="min-h-11 flex-1 text-xs gap-1.5"
                onClick={() => handleSendPushNow(false)}
                disabled={sendingTest || subscribing}
              >
                {sendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                Enviar a todos ({totalActiveGlobal ?? deviceCount})
              </Button>
            )}
          </div>

          <Button
            variant="secondary"
            className="min-h-11 w-full"
            onClick={() => setOpen(false)}
          >
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}