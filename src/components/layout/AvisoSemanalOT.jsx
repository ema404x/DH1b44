import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Bell, CheckCircle2, ClipboardList, Laptop, Loader2, Send, Smartphone, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';
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

function formatShortBrowser(ua = '') {
  if (!ua) return 'Navegador';
  if (/Edg\//i.test(ua)) return 'Microsoft Edge';
  if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) return 'Google Chrome';
  if (/Firefox\//i.test(ua)) return 'Mozilla Firefox';
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return 'Safari';
  return 'Navegador Web';
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
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [lastTestResult, setLastTestResult] = useState(null);
  const [vapidPublicKey, setVapidPublicKey] = useState(null);
  const [deviceCount, setDeviceCount] = useState(0);
  const [totalActiveGlobal, setTotalActiveGlobal] = useState(null);
  const [registeredDevices, setRegisteredDevices] = useState([]);
  const [isIframe, setIsIframe] = useState(false);
  const checked = useRef(null);

  useEffect(() => {
    try {
      setIsIframe(window.self !== window.top);
    } catch (_) {
      setIsIframe(true);
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const statusRes = await base44.functions.invoke('gestionarPushSemanal', { action: 'status' });
      const statusData = statusRes?.data || {};
      if (statusData.publicKey) setVapidPublicKey(statusData.publicKey);
      setDeviceCount(statusData.deviceCount || 0);
      setIsSubscribed(Boolean(statusData.subscribed));
      if (typeof statusData.totalActiveGlobal === 'number') {
        setTotalActiveGlobal(statusData.totalActiveGlobal);
      }
      const list = Array.isArray(statusData.allDevices)
        ? statusData.allDevices
        : Array.isArray(statusData.devices)
        ? statusData.devices
        : [];
      setRegisteredDevices(list);
      return statusData;
    } catch (_) {
      return {};
    } finally {
      setLoadingStatus(false);
    }
  }, []);

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
      await fetchStatus();
      return true;
    }
    return false;
  }, [fetchStatus]);

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
      const statusData = await fetchStatus();
      const pubKey = statusData.publicKey || null;
      let deviceReady = Boolean(statusData.subscribed);

      // Si el usuario ya concedió permiso en este navegador, sincronizar su suscripción Web Push automáticamente
      if (supported && Notification.permission === 'granted' && pubKey) {
        const synced = await registerBrowserPushSubscription(pubKey).catch(() => false);
        if (synced) {
          deviceReady = true;
        }
      }

      setIsSubscribed(deviceReady);

      const alreadyNotifiedToday =
        statusData.ultimo_aviso_ot_miercoles === date ||
        statusData.ultimo_push_ot_fecha === date ||
        user.ultimo_aviso_ot_miercoles === date ||
        user.data?.ultimo_aviso_ot_miercoles === date;

      if (!deviceReady) {
        setOpen(true);
      } else if (wedOrFri && !alreadyNotifiedToday) {
        await base44.auth.updateMe({ ultimo_aviso_ot_miercoles: date }).catch(() => {});
        setOpen(true);
      }
    };

    initPushAndNotice();
  }, [user?.id, fetchStatus, registerBrowserPushSubscription]);

  useEffect(() => {
    const handleOpenPushConfig = () => {
      setOpen(true);
      fetchStatus();
    };
    window.addEventListener('dh1:open-push-config', handleOpenPushConfig);
    return () => window.removeEventListener('dh1:open-push-config', handleOpenPushConfig);
  }, [fetchStatus]);

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

    return await registerBrowserPushSubscription(pubKey);
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
        toast.success('Dispositivo registrado correctamente para notificaciones push.');
      } else {
        toast.error(
          isIframe
            ? 'El visor de vista previa bloquea permisos del navegador. Abrí la app en una pestaña nueva para registrar este equipo.'
            : 'Debés permitir las notificaciones en el navegador para registrar este dispositivo.'
        );
      }
    } catch (err) {
      toast.error(
        isIframe
          ? 'El visor embebido restringe el registro Web Push. Abrí https://dh1m.com en una pestaña nueva para suscribir tu navegador.'
          : err?.message || 'Error al activar las notificaciones push.'
      );
    } finally {
      setSubscribing(false);
    }
  };

  const handleSendPushNow = async (onlySelf = true) => {
    setSendingTest(true);
    setLastTestResult(null);
    try {
      let browserSubscribed = isSubscribed;
      if (onlySelf && pushSupported && (!isSubscribed || Notification.permission !== 'granted')) {
        browserSubscribed = await ensureCurrentDeviceSubscribed().catch(() => false);
      }

      const res = await base44.functions.invoke('gestionarPushSemanal', {
        action: 'send_weekly_ot_push',
        force: true,
        only_self: onlySelf,
      });
      const data = res?.data || {};
      const webSent = data.webPush?.sent ?? 0;
      const mobileSent = data.mobilePush?.sent ?? 0;

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

      await fetchStatus();

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
          'Aún no hay dispositivos Web Push registrados. Activá primero las notificaciones en este dispositivo.'
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
      <DialogContent className="max-w-lg w-[calc(100%-2rem)] rounded-2xl border-border bg-card text-card-foreground p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-3 text-primary">
          <div className="rounded-xl bg-primary/10 p-3">
            <ClipboardList className="h-6 w-6" />
          </div>
          <div>
            <span className="text-sm font-semibold tracking-wide block">DH1 · Aviso automático Miércoles y Viernes</span>
            <span className="text-xs text-muted-foreground">Notificaciones Push en PC y Móvil (sin correo)</span>
          </div>
        </div>

        <DialogHeader className="text-left space-y-1.5">
          <DialogTitle className="text-xl leading-tight">
            ¿Cómo vienen con las órdenes de trabajo?
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            {isWedOrFri
              ? `Es ${diaLabel}: revisá el avance de las órdenes de trabajo y mantené sus estados actualizados.`
              : 'Activá las notificaciones push en tu dispositivo para recibir automáticamente los miércoles y viernes el recordatorio de avance de OTs aunque tengas DH1 cerrada.'}
          </DialogDescription>
        </DialogHeader>

        {/* Estado y listado de dispositivos registrados */}
        <div className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-2.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-foreground">
              Dispositivos Web Push registrados ({registeredDevices.length})
            </span>
            <button
              type="button"
              onClick={fetchStatus}
              disabled={loadingStatus}
              className="inline-flex items-center gap-1 text-primary hover:underline text-[11px]"
            >
              <RefreshCw className={`h-3 w-3 ${loadingStatus ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>

          {registeredDevices.length === 0 ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-amber-300 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                Ningún navegador/PC registrado todavía (0 dispositivos)
              </div>
              <p className="text-[11px] text-amber-200/90 leading-relaxed">
                Para que tu PC o celular Android quede registrado en la base de datos, pulsá <strong>"1. Activar notificaciones push en este dispositivo"</strong> y aceptá el permiso del navegador.
                {isIframe && ' (Si estás dentro del panel de vista previa del editor, abrí primero la app en una pestaña nueva para que el navegador permita suscribir el Service Worker).'}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {registeredDevices.map((dev) => (
                <div
                  key={dev.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-background/60 px-2.5 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {dev.device_type === 'movil' ? (
                      <Smartphone className="h-4 w-4 text-primary shrink-0" />
                    ) : (
                      <Laptop className="h-4 w-4 text-primary shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="font-medium text-foreground truncate">
                        {dev.user_email || user?.email} · {dev.device_type === 'movil' ? 'Móvil' : 'PC'}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {formatShortBrowser(dev.user_agent)}
                        {dev.ultimo_envio_fecha ? ` · Último envío: ${dev.ultimo_envio_fecha}` : ' · Listo para recibir'}
                      </div>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold text-[11px] shrink-0">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Activo
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {isIframe && !isSubscribed && (
          <a
            href="https://dh1m.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full rounded-xl border border-primary/40 bg-primary/10 px-3 py-2.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir dh1m.com en pestaña nueva para registrar este navegador sin bloqueo de iframe
          </a>
        )}

        {lastTestResult && (
          <div className="rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2.5 text-xs space-y-1">
            <div className="font-semibold text-primary">Resultado del último envío de prueba:</div>
            <div className="text-foreground">
              • Web Push (PC / navegador móvil): <strong>{lastTestResult.webSent}</strong> enviado(s)
              {lastTestResult.localShown ? ' (notificación mostrada en este navegador)' : ''}
            </div>
            <div className="text-foreground">
              • Push móvil nativo (usuarios con app nativa): <strong>{lastTestResult.mobileSent}</strong> enviado(s)
            </div>
          </div>
        )}

        <div className="space-y-2 pt-1">
          {pushSupported && (!isSubscribed || permissionState !== 'granted') && (
            <Button
              className="min-h-11 w-full gap-2 font-semibold"
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
                Enviar a todos ({totalActiveGlobal ?? registeredDevices.length})
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