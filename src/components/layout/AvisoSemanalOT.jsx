import React, { useEffect, useRef, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function AvisoSemanalOT() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const checked = useRef(null);
  const activeUser = useRef(user?.id);
  activeUser.current = user?.id;

  useEffect(() => {
    if (!user?.id) return;
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Buenos_Aires', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    const date = `${values.year}-${values.month}-${values.day}`;
    const key = `${user.id}:${date}`;
    if (values.weekday !== 'Wed' || checked.current === key) return;
    checked.current = key;
    const showNotice = async () => {
      const current = await base44.auth.me();
      if (current.id !== user.id || current.ultimo_aviso_ot_miercoles === date || current.data?.ultimo_aviso_ot_miercoles === date) return;
      await base44.auth.updateMe({ ultimo_aviso_ot_miercoles: date });
      if (activeUser.current === user.id) setOpen(true);
    };
    showNotice();
  }, [user?.id]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md w-[calc(100%-2rem)] rounded-2xl border-border bg-card text-card-foreground p-6">
        <div className="flex items-center gap-3 text-primary">
          <div className="rounded-xl bg-primary/10 p-3"><ClipboardList className="h-6 w-6" /></div>
          <span className="text-sm font-semibold tracking-wide">DH1 · Recordatorio semanal</span>
        </div>
        <DialogHeader className="text-left space-y-3">
          <DialogTitle className="text-2xl leading-tight">¿Cómo vienen con las órdenes de trabajo?</DialogTitle>
          <DialogDescription>Es miércoles: revisá el avance de las órdenes de trabajo y mantené sus estados actualizados.</DialogDescription>
        </DialogHeader>
        <Button className="min-h-14 w-full mt-2" onClick={() => setOpen(false)}>Entendido, continuar</Button>
      </DialogContent>
    </Dialog>
  );
}