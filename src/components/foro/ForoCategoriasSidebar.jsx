import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Hash, Megaphone, Plus } from "lucide-react";

export default function ForoCategoriasSidebar({ categorias, categoriaActiva, onSeleccionar, onNueva, conteosPorCategoria, user }) {
  return (
    <aside className="flex flex-col gap-1 min-w-0">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Categorías</span>
        {user?.role === 'admin' && (
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onNueva} title="Nueva categoría">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <button
        onClick={() => onSeleccionar(null)}
        className={cn(
          "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left w-full",
          !categoriaActiva ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <Megaphone className="h-4 w-4 shrink-0" />
        <span>Todos los hilos</span>
      </button>

      {categorias.map(cat => (
        <button
          key={cat.id}
          onClick={() => onSeleccionar(cat.id)}
          className={cn(
            "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left w-full group",
            categoriaActiva === cat.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <span className="text-base shrink-0">{cat.icono || "💬"}</span>
          <span className="truncate flex-1">{cat.nombre}</span>
          {conteosPorCategoria?.[cat.id] > 0 && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 shrink-0">
              {conteosPorCategoria[cat.id]}
            </Badge>
          )}
        </button>
      ))}
    </aside>
  );
}