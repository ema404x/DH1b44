import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Pin, Lock, Megaphone, MoreVertical, Reply, Paperclip, Clock, Trash2, Pencil } from "lucide-react";
import ForoReacciones from "./ForoReacciones";
import ForoEncuesta from "./ForoEncuesta";
import ForoEditorMensaje from "./ForoEditorMensaje";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const tiempoRelativo = (f) => f ? formatDistanceToNow(new Date(f), { addSuffix: true, locale: es }) : "";

function AdjuntosGaleria({ adjuntos }) {
  if (!adjuntos?.length) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {adjuntos.map((adj, i) =>
        adj.tipo === 'imagen' ? (
          <a key={i} href={adj.url} target="_blank" rel="noopener noreferrer">
            <img src={adj.url} alt={adj.nombre} className="h-24 w-24 rounded-lg object-cover border border-border hover:opacity-80 transition-opacity" />
          </a>
        ) : (
          <a key={i} href={adj.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-muted text-xs hover:bg-muted/80 transition-colors">
            <Paperclip className="h-3 w-3" /> {adj.nombre}
          </a>
        )
      )}
    </div>
  );
}

const DEV_EMAIL = 'emmmanuel0011@gmail.com';

function RespuestaItem({ respuesta, userId, user, onReaccion, onEliminar, onResponder }) {
  const esDev = user?.email === DEV_EMAIL;
  return (
    <div className="flex gap-3 group">
      <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold shrink-0 mt-1">
        {(respuesta.autor_nombre || "?")[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        {respuesta.responde_a_autor && (
          <div className="text-xs text-muted-foreground mb-1 pl-2 border-l-2 border-border">
            Respondiendo a <span className="text-primary font-medium">@{respuesta.responde_a_autor}</span>
          </div>
        )}
        <div className="bg-muted/30 rounded-xl px-3 py-2 border border-border/50">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-foreground">{respuesta.autor_nombre}</span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" /> {tiempoRelativo(respuesta.created_date)}
            </span>
          </div>
          <p className="text-sm text-foreground whitespace-pre-wrap">{respuesta.cuerpo}</p>
          <AdjuntosGaleria adjuntos={respuesta.adjuntos} />
        </div>
        <div className="flex items-center gap-2 mt-1 px-1">
          <ForoReacciones reacciones={respuesta.reacciones || {}} userId={userId} onToggle={(emoji) => onReaccion(respuesta.id, emoji)} />
          <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground gap-1" onClick={() => onResponder(respuesta)}>
            <Reply className="h-3 w-3" /> Responder
          </Button>
          {(esDev || respuesta.autor_id === userId) && (
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onEliminar(respuesta.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ForoHiloDetalle({ hilo, user, onVolver, onEliminarHilo, usuarios }) {
  const qc = useQueryClient();
  const [respondiendo, setRespondiendo] = useState(null);
  const [editandoHilo, setEditandoHilo] = useState(false);
  const [editTitulo, setEditTitulo] = useState(hilo.titulo);
  const [editCuerpo, setEditCuerpo] = useState(hilo.cuerpo);

  const esDev = user?.email === DEV_EMAIL;
  const esAutor = hilo.autor_id === user?.id;
  const esAutorOAdmin = esAutor || esDev;
  const puedeModerar = user?.role === 'admin' || esDev; // fijar/cerrar

  const editarHiloMut = useMutation({
    mutationFn: (data) => base44.entities.ForoHilo.update(hilo.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["foro-hilos"] }); setEditandoHilo(false); },
  });

  const { data: respuestas = [] } = useQuery({
    queryKey: ["foro-respuestas", hilo.id],
    queryFn: () => base44.entities.ForoRespuesta.filter({ hilo_id: hilo.id }, "created_date", 200),
    refetchInterval: 15000,
    staleTime: 10000,
  });

  // Incrementar vistas — una sola vez por apertura, usando ref para evitar doble ejecución
  const vistasIncrementadaRef = useRef(false);
  useEffect(() => {
    if (vistasIncrementadaRef.current) return;
    vistasIncrementadaRef.current = true;
    base44.entities.ForoHilo.update(hilo.id, { vistas: (hilo.vistas || 0) + 1 });
  }, [hilo.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const responderMut = useMutation({
    mutationFn: async (data) => {
      const resp = await base44.entities.ForoRespuesta.create(data);
      await base44.entities.ForoHilo.update(hilo.id, { total_respuestas: (hilo.total_respuestas || 0) + 1 });
      // Notificar al autor del hilo (solo si no es el mismo que responde)
      if (hilo.autor_id && hilo.autor_id !== data.autor_id) {
        await base44.entities.ForoNotificacion.create({
          usuario_id: hilo.autor_id,
          tipo: 'respuesta',
          hilo_id: hilo.id,
          hilo_titulo: hilo.titulo,
          actor_nombre: data.autor_nombre,
          leida: false,
        });
      }
      return resp;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["foro-respuestas", hilo.id] });
      qc.invalidateQueries({ queryKey: ["foro-hilos"] });
      setRespondiendo(null);
    }
  });

  const eliminarRespMut = useMutation({
    mutationFn: async (id) => {
      await base44.entities.ForoRespuesta.delete(id);
      const nuevoTotal = Math.max(0, (hilo.total_respuestas || 0) - 1);
      await base44.entities.ForoHilo.update(hilo.id, { total_respuestas: nuevoTotal });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["foro-respuestas", hilo.id] });
      qc.invalidateQueries({ queryKey: ["foro-hilos"] });
    }
  });

  const reaccionHiloMut = useMutation({
    mutationFn: ({ emoji }) => {
      const recs = { ...(hilo.reacciones || {}) };
      const lista = recs[emoji] ? [...recs[emoji]] : [];
      const idx = lista.indexOf(user.id);
      if (idx >= 0) lista.splice(idx, 1); else lista.push(user.id);
      recs[emoji] = lista;
      return base44.entities.ForoHilo.update(hilo.id, { reacciones: recs });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["foro-hilos"] }),
  });

  const reaccionRespMut = useMutation({
    mutationFn: ({ id, emoji, reacciones }) => {
      const recs = { ...(reacciones || {}) };
      const lista = recs[emoji] ? [...recs[emoji]] : [];
      const idx = lista.indexOf(user.id);
      if (idx >= 0) lista.splice(idx, 1); else lista.push(user.id);
      recs[emoji] = lista;
      return base44.entities.ForoRespuesta.update(id, { reacciones: recs });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["foro-respuestas", hilo.id] }),
  });

  const votarMut = useMutation({
    mutationFn: (opcionId) => {
      const enc = JSON.parse(JSON.stringify(hilo.encuesta));
      enc.opciones = enc.opciones.map(op => {
        const votos = op.votos ? [...op.votos] : [];
        if (op.id === opcionId) { if (!votos.includes(user.id)) votos.push(user.id); }
        else { const i = votos.indexOf(user.id); if (i >= 0) votos.splice(i, 1); }
        return { ...op, votos };
      });
      return base44.entities.ForoHilo.update(hilo.id, { encuesta: enc });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["foro-hilos"] }),
  });

  const handleResponder = ({ texto, adjuntos, menciones }) => {
    responderMut.mutate({
      hilo_id: hilo.id,
      cuerpo: texto,
      adjuntos,
      menciones,
      autor_nombre: user?.full_name || user?.email || "Usuario",
      autor_id: user?.id,
      reacciones: {},
      responde_a_id: respondiendo?.id || undefined,
      responde_a_autor: respondiendo?.autor_nombre || undefined,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" size="sm" onClick={onVolver} className="gap-2 self-start -ml-2">
        <ArrowLeft className="h-4 w-4" /> Volver al foro
      </Button>

      {/* Post principal */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            {hilo.tipo === 'anuncio' && (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 gap-1">
                <Megaphone className="h-3 w-3" /> Anuncio
              </Badge>
            )}
            {hilo.fijado && <Pin className="h-4 w-4 text-primary" />}
            {hilo.cerrado && <Lock className="h-4 w-4 text-muted-foreground" />}
          </div>
          {esAutorOAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => { setEditTitulo(hilo.titulo); setEditCuerpo(hilo.cuerpo); setEditandoHilo(true); }}>
                  <Pencil className="h-4 w-4 mr-2" /> Editar
                </DropdownMenuItem>
                {puedeModerar && (
                  <>
                    <DropdownMenuItem onClick={() => base44.entities.ForoHilo.update(hilo.id, { fijado: !hilo.fijado }).then(() => qc.invalidateQueries({ queryKey: ["foro-hilos"] }))}>
                      <Pin className="h-4 w-4 mr-2" /> {hilo.fijado ? "Desfijar" : "Fijar"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => base44.entities.ForoHilo.update(hilo.id, { cerrado: !hilo.cerrado }).then(() => qc.invalidateQueries({ queryKey: ["foro-hilos"] }))}>
                      <Lock className="h-4 w-4 mr-2" /> {hilo.cerrado ? "Abrir" : "Cerrar"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => { if (confirm("¿Eliminar este hilo y todas sus respuestas?")) onEliminarHilo(hilo.id); }}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Eliminar hilo
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <h1 className="text-xl font-bold text-foreground mt-2 mb-1">{hilo.titulo}</h1>

        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
              {(hilo.autor_nombre || "?")[0].toUpperCase()}
            </div>
            <span className="font-medium text-foreground/80">{hilo.autor_nombre}</span>
          </div>
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {tiempoRelativo(hilo.created_date)}</span>
          {hilo.categoria_nombre && <Badge variant="outline" className="text-[10px] h-4 px-1.5">{hilo.categoria_nombre}</Badge>}
        </div>

        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{hilo.cuerpo}</p>

        {/* Dialog edición */}
        <Dialog open={editandoHilo} onOpenChange={setEditandoHilo}>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>Editar hilo</DialogTitle></DialogHeader>
            <div className="flex flex-col gap-3 mt-2">
              <Input value={editTitulo} onChange={e => setEditTitulo(e.target.value)} placeholder="Título" />
              <Textarea value={editCuerpo} onChange={e => setEditCuerpo(e.target.value)} placeholder="Contenido" className="min-h-[120px]" />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditandoHilo(false)}>Cancelar</Button>
                <Button
                  onClick={() => editarHiloMut.mutate({ titulo: editTitulo, cuerpo: editCuerpo })}
                  disabled={editarHiloMut.isPending || !editTitulo.trim() || !editCuerpo.trim()}
                >
                  Guardar cambios
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <AdjuntosGaleria adjuntos={hilo.adjuntos} />
        <ForoEncuesta encuesta={hilo.encuesta} userId={user?.id} onVotar={(opId) => votarMut.mutate(opId)} />

        <div className="mt-4 pt-3 border-t border-border">
          <ForoReacciones reacciones={hilo.reacciones || {}} userId={user?.id} onToggle={(emoji) => reaccionHiloMut.mutate({ emoji })} />
        </div>
      </div>

      {/* Respuestas */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">{respuestas.length} respuesta{respuestas.length !== 1 ? "s" : ""}</h2>

        {respuestas.map(resp => (
          <RespuestaItem
            key={resp.id}
            respuesta={resp}
            userId={user?.id}
            user={user}
            onReaccion={(id, emoji) => reaccionRespMut.mutate({ id, emoji, reacciones: resp.reacciones })}
            onEliminar={(id) => eliminarRespMut.mutate(id)}
            onResponder={(r) => setRespondiendo(r)}
          />
        ))}
      </div>

      {/* Editor respuesta */}
      {!hilo.cerrado && (
        <div className="rounded-2xl border border-border bg-card p-4">
          {respondiendo && (
            <div className="flex items-center justify-between mb-2 px-2 py-1 bg-primary/10 rounded-lg text-xs text-primary">
              <span>Respondiendo a <strong>@{respondiendo.autor_nombre}</strong></span>
              <Button variant="ghost" size="sm" className="h-5 text-xs px-1" onClick={() => setRespondiendo(null)}>✕</Button>
            </div>
          )}
          <ForoEditorMensaje
            placeholder="Escribe tu respuesta..."
            onSubmit={handleResponder}
            usuarios={usuarios}
            loading={responderMut.isPending}
          />
        </div>
      )}
      {hilo.cerrado && (
        <div className="text-center text-sm text-muted-foreground py-4 border border-border rounded-xl">
          🔒 Este hilo está cerrado para nuevas respuestas
        </div>
      )}
    </div>
  );
}