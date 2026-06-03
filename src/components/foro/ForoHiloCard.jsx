import { Badge } from "@/components/ui/badge";
import { MessageSquare, Eye, Pin, Lock, Megaphone, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const tiempoRelativo = (fecha) => {
  if (!fecha) return "";
  return formatDistanceToNow(new Date(fecha), { addSuffix: true, locale: es });
};

export default function ForoHiloCard({ hilo, onClick }) {
  const totalVotos = hilo.encuesta?.opciones?.reduce((a, o) => a + (o.votos?.length || 0), 0);

  return (
    <div
      onClick={onClick}
      className="flex gap-3 p-4 rounded-xl border border-border bg-card hover:bg-muted/30 hover:border-primary/30 transition-all cursor-pointer group"
    >
      {/* Avatar */}
      <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary shrink-0 mt-0.5">
        {(hilo.autor_nombre || "?")[0].toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {hilo.tipo === 'anuncio' && (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] gap-1 py-0">
                <Megaphone className="h-2.5 w-2.5" /> Anuncio
              </Badge>
            )}
            {hilo.fijado && <Pin className="h-3.5 w-3.5 text-primary shrink-0" />}
            {hilo.cerrado && <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
            <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">
              {hilo.titulo}
            </h3>
          </div>
        </div>

        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{hilo.cuerpo}</p>

        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
          <span className="font-medium text-foreground/70">{hilo.autor_nombre}</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> {tiempoRelativo(hilo.created_date)}
          </span>
          {hilo.categoria_nombre && (
            <Badge variant="outline" className="text-[10px] h-4 px-1.5">{hilo.categoria_nombre}</Badge>
          )}
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" /> {hilo.total_respuestas || 0}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" /> {hilo.vistas || 0}
          </span>
          {hilo.encuesta?.pregunta && (
            <span className="text-primary">📊 Encuesta ({totalVotos} votos)</span>
          )}
          {hilo.adjuntos?.length > 0 && (
            <span>📎 {hilo.adjuntos.length}</span>
          )}
        </div>
      </div>
    </div>
  );
}