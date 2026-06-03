import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import ForoEditorMensaje from "./ForoEditorMensaje";
import { Plus, Trash2, BarChart3 } from "lucide-react";
const genId = () => Math.random().toString(36).slice(2, 10);

export default function ForoNuevoHiloDialog({ open, onClose, onCrear, categorias, usuarios, user, loading }) {
  const [titulo, setTitulo] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [tipo, setTipo] = useState("hilo");
  const [contenido, setContenido] = useState({ texto: "", adjuntos: [], menciones: [] });
  const [conEncuesta, setConEncuesta] = useState(false);
  const [encuestaPregunta, setEncuestaPregunta] = useState("");
  const [opciones, setOpciones] = useState([{ id: genId(), texto: "" }, { id: genId(), texto: "" }]);

  const handleSubmit = () => {
    if (!titulo.trim() || !contenido.texto.trim()) return;
    const encuesta = conEncuesta && encuestaPregunta.trim() ? {
      pregunta: encuestaPregunta,
      opciones: opciones.filter(o => o.texto.trim()).map(o => ({ ...o, votos: [] })),
      activa: true,
    } : undefined;
    const cat = categorias.find(c => c.id === categoriaId);
    onCrear({
      titulo,
      cuerpo: contenido.texto,
      adjuntos: contenido.adjuntos,
      menciones: contenido.menciones,
      categoria_id: categoriaId || undefined,
      categoria_nombre: cat?.nombre || "",
      tipo,
      encuesta,
      autor_nombre: user?.full_name || user?.email || "Usuario",
      autor_id: user?.id,
      reacciones: {},
      fijado: false,
      cerrado: false,
      total_respuestas: 0,
      vistas: 0,
    });
    setTitulo(""); setCategoriaId(""); setTipo("hilo"); setContenido({ texto: "", adjuntos: [], menciones: [] });
    setConEncuesta(false); setEncuestaPregunta(""); setOpciones([{ id: genId(), texto: "" }, { id: genId(), texto: "" }]);
  };

  const addOpcion = () => setOpciones(prev => [...prev, { id: genId(), texto: "" }]);
  const removeOpcion = (id) => setOpciones(prev => prev.filter(o => o.id !== id));
  const updateOpcion = (id, texto) => setOpciones(prev => prev.map(o => o.id === id ? { ...o, texto } : o));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo hilo</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-2">
          <div className="flex gap-3">
            <Input
              placeholder="Título del hilo..."
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              className="flex-1"
            />
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hilo">💬 Hilo</SelectItem>
                {user?.role === 'admin' && <SelectItem value="anuncio">📢 Anuncio</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          <Select value={categoriaId} onValueChange={setCategoriaId}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar categoría (opcional)" />
            </SelectTrigger>
            <SelectContent>
              {categorias.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.icono || "💬"} {cat.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <ForoEditorMensaje
            placeholder="Escribí el contenido del hilo..."
            onSubmit={setContenido}
            usuarios={usuarios}
            loading={false}
            minHeight="h-32"
          />
          {contenido.texto && (
            <div className="text-xs text-muted-foreground -mt-2 px-1">
              Vista previa guardada ✓
            </div>
          )}

          {/* Encuesta */}
          <div className="border border-border rounded-xl p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <Label className="text-sm font-medium">Agregar encuesta</Label>
              </div>
              <Switch checked={conEncuesta} onCheckedChange={setConEncuesta} />
            </div>

            {conEncuesta && (
              <div className="flex flex-col gap-2">
                <Input
                  placeholder="Pregunta de la encuesta..."
                  value={encuestaPregunta}
                  onChange={e => setEncuestaPregunta(e.target.value)}
                />
                {opciones.map((op, i) => (
                  <div key={op.id} className="flex gap-2">
                    <Input
                      placeholder={`Opción ${i + 1}`}
                      value={op.texto}
                      onChange={e => updateOpcion(op.id, e.target.value)}
                    />
                    {opciones.length > 2 && (
                      <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => removeOpcion(op.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addOpcion} className="gap-2 self-start">
                  <Plus className="h-3.5 w-3.5" /> Agregar opción
                </Button>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={loading || !titulo.trim() || !contenido.texto.trim()}>
              Publicar hilo
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}