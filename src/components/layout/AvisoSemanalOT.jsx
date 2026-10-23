import React, { useEffect, useRef, useState } from 'react';
import { ClipboardList, Loader2, Send } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// Registra este dispositivo en silencio (pide permiso una sola vez)
async function registrarDispositivo() {
  if (!pushSupported()) return;
  let perm = Notification.permission;
  if (perm === 'default') perm = await Notification.requestPermission();
  if (perm !== 'granted') return;

  const { data } = await base44.functions.invoke('gestionarPushSemanal', { action: 'get_vapid_key' });
  if (!data?.publicKey) return;

  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.publicKey),
    });
  }
  await base44.functions.invoke('gestionarPushSemanal', {
    action: 'subscribe',
    subscription: sub.toJSON(),
    user_agent: navigator.userAgent || '',
    device_type: /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '') ? 'movil' : 'pc',
  });
}

export default function AvisoSemanalOT() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    if (!user?.id || done.current) return;
    done.current = true;
    registrarDispositivo().catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    const handler = () => {
      setOpen(true);
      registrarDispositivo().catch(() => {});
    };
    window.addEventListener('dh1:open-push-config', handler);
    return () => window.removeEventListener('dh1:open-push-config', handler);
  }, []);

  const enviarATodos = async () => {
    setSending(true);
    try {
      const { data } = await base44.functions.invoke('gestionarPushSemanal', {
        action: 'send_weekly_ot_push',
        force: true,
        only_self: false,
      });
      toast.success(`Aviso enviado a ${data?.webPush?.sent ?? 0} dispositivo(s).`);
    } catch (err) {
      toast.error(err?.message || 'No se pudo enviar el aviso.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm w-[calc(100%-2rem)] rounded-2xl bg-card p-6 space-y-4">
        <div className="flex items-center gap-3 text-primary">
          <div className="rounded-xl bg-primary/10 p-3"><ClipboardList className="h-6 w-6" /></div>
          <span className="text-sm font-semibold">Aviso de OTs</span>
        </div>
        <DialogHeader className="text-left">
          <DialogTitle>Notificaciones automáticas</DialogTitle>
          <DialogDescription className="text-xs">
            Todos los usuarios reciben el aviso de avance de órdenes de trabajo los miércoles y viernes.
          </DialogDescription>
        </DialogHeader>
        {user?.role === 'admin' && (
          <Button className="w-full gap-2" onClick={enviarATodos} disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar aviso a todos ahora
          </Button>
        )}
        <Button variant="secondary" className="w-full" onClick={() => setOpen(false)}>Cerrar</Button>
      </DialogContent>
    </Dialog>
  );
}