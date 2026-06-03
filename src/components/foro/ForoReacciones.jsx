import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Smile } from "lucide-react";
import { cn } from "@/lib/utils";

const EMOJIS = ["👍", "❤️", "🔥", "👏", "😂", "😮", "🙌", "✅"];

export default function ForoReacciones({ reacciones = {}, userId, onToggle, compact = false }) {
  const totalReacciones = Object.entries(reacciones);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {totalReacciones.map(([emoji, usuarios]) => {
        if (!usuarios?.length) return null;
        const yoReaccioné = usuarios.includes(userId);
        return (
          <button
            key={emoji}
            onClick={() => onToggle(emoji)}
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all",
              yoReaccioné
                ? "bg-primary/20 border-primary/40 text-primary font-medium"
                : "bg-muted/30 border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <span>{emoji}</span>
            <span>{usuarios.length}</span>
          </button>
        );
      })}

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground">
            <Smile className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="grid grid-cols-4 gap-1">
            {EMOJIS.map(e => (
              <button
                key={e}
                onClick={() => onToggle(e)}
                className={cn(
                  "text-lg p-1.5 rounded hover:bg-muted transition-colors",
                  reacciones[e]?.includes(userId) && "bg-primary/20"
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}