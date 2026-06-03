import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, MessageSquare, AtSign, Megaphone, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

const ICON_TIPO = { mencion: AtSign, respuesta: MessageSquare, anuncio: Megaphone };

export default function ForoNotificacionesBell({ userId, onClickNotif }) {
  const qc = useQueryClient();

  const { data: notifs = [] } = useQuery({
    queryKey: ["foro-notificaciones", userId],
    queryFn: () => base44.entities.ForoNotificacion.filter({ usuario_id: userId }, "-created_date", 30),
    enabled: !!userId,
    refetchInterval: 30000,
  });

  const marcarLeidaMut = useMutation({
    mutationFn: (id) => base44.entities.ForoNotificacion.update(id, { leida: true }),
    onSuccess: () => qc.invalidateQueries(["foro-notificaciones", userId]),
  });

  const marcarTodasMut = useMutation({
    mutationFn: async () => {
      const noLeidas = notifs.filter(n => !n.leida);
      await Promise.all(noLeidas.map(n => base44.entities.ForoNotificacion.update(n.id, { leida: true })));
    },
    onSuccess: () => qc.invalidateQueries(["foro-notificaciones", userId]),
  });

  const noLeidas = notifs.filter(n => !n.leida).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4 w-4" />
          {noLeidas > 0 && (
            <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-destructive text-[10px] font-bold text-white flex items-center justify-center leading-none">
              {noLeidas > 9 ? "9+" : noLeidas}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-semibold">Notificaciones del foro</span>
          {noLeidas > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => marcarTodasMut.mutate()}>
              <Check className="h-3 w-3" /> Marcar todas
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto divide-y divide-border">
          {notifs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Sin notificaciones</p>
          ) : (
            notifs.map(notif => {
              const Icon = ICON_TIPO[notif.tipo] || Bell;
              return (
                <button
                  key={notif.id}
                  onClick={() => { marcarLeidaMut.mutate(notif.id); onClickNotif?.(notif); }}
                  className={cn("w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors", !notif.leida && "bg-primary/5")}
                >
                  <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", notif.leida ? "text-muted-foreground" : "text-primary")} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground leading-snug">
                      <span className="font-semibold">{notif.actor_nombre}</span>
                      {notif.tipo === 'mencion' && " te mencionó en"}
                      {notif.tipo === 'respuesta' && " respondió en"}
                      {notif.tipo === 'anuncio' && " publicó un anuncio:"}
                      {" "}
                      <span className="text-primary">{notif.hilo_titulo}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {notif.created_date ? formatDistanceToNow(new Date(notif.created_date), { addSuffix: true, locale: es }) : ""}
                    </p>
                  </div>
                  {!notif.leida && <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}