import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BarChart3 } from "lucide-react";

export default function ForoEncuesta({ encuesta, userId, onVotar }) {
  if (!encuesta?.pregunta) return null;

  const totalVotos = encuesta.opciones?.reduce((acc, op) => acc + (op.votos?.length || 0), 0) || 0;
  const yaVotó = encuesta.opciones?.some(op => op.votos?.includes(userId));

  return (
    <div className="mt-3 p-3 rounded-xl border border-border bg-muted/20">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">{encuesta.pregunta}</span>
      </div>

      <div className="flex flex-col gap-2">
        {encuesta.opciones?.map(opcion => {
          const pct = totalVotos > 0 ? Math.round((opcion.votos?.length || 0) / totalVotos * 100) : 0;
          const voté = opcion.votos?.includes(userId);

          return (
            <div key={opcion.id}>
              {yaVotó ? (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className={voté ? "text-primary font-semibold" : ""}>{opcion.texto} {voté && "✓"}</span>
                    <span>{pct}% ({opcion.votos?.length || 0})</span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-left text-sm h-8"
                  onClick={() => onVotar(opcion.id)}
                  disabled={!encuesta.activa}
                >
                  {opcion.texto}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground mt-2">{totalVotos} voto{totalVotos !== 1 ? "s" : ""}</p>
    </div>
  );
}