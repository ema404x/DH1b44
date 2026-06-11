import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, BarChart3, Image, Paperclip, X, Loader2 } from "lucide-react";
const genId = () => Math.random().toString(36).slice(2, 10);

// Editor simple con soporte de adjuntos, integrado directamente (texto visible en tiempo real)
function EditorConAdjuntos({ texto, setTexto, adjuntos, setAdjuntos, usuarios }) {
  const [subiendo, setSubiendo] = useState(false);
  const [showMenciones, setShowMenciones] = useState(false);
  const [busquedaMencion, setBusquedaMencion] = useState("");
  const fileRef = useRef(null);
  const imgRef = useRef(null);

  const handleTexto = (e) => {
    const val = e.target.value;
    setTexto(val);
    const match = val.match(/@(\w*)$/);
    if (match) { setBusquedaMencion(match[1]); setShowMenciones(true); }
    else setShowMenciones(false);
  };

  const insertarMencion = (u) => {
    setTexto(prev => prev.replace(/@\w*$/, `@${u.full_name || u.nombre || 'usuario'} `));
    setShowMenciones(false);
  };

  const handleFile = async (e, tipo) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendo(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setAdjuntos(prev => [...prev, { nombre: file.name, url: file_url, tipo }]);
    setSubiendo(false);
    e.target.value = '';
  };

  const usuariosFiltrados = usuarios
    .filter(u => (u.full_name || '').toLowerCase().includes(busquedaMencion.toLowerCase()))
    .slice(0, 6);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Textarea
          value={texto}
          onChange={handleTexto}
          placeholder="Escribí el contenido del hilo..."
          className="h-32 resize-none text-sm"
        />
        {showMenciones && usuariosFiltrados.length > 0 && (
          <div className="absolute bottom-full mb-1 left-0 z-50 bg-popover border border-border rounded-lg shadow-xl w-64 overflow-hidden">
            {usuariosFiltrados.map(u => (
              <button key={u.id} onClick={() => insertarMencion(u)}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-colors text-left">
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {(u.full_name || '?')[0].toUpperCase()}
                </div>
                <span>{u.full_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {adjuntos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {adjuntos.map((adj, i) => (
            <div key={i} className="relative group">
              {adj.tipo === 'imagen'
                ? <img src={adj.url} alt={adj.nombre} className="h-14 w-14 rounded-lg object-cover border border-border" />
                : <div className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-lg border border-border text-xs"><Paperclip className="h-3 w-3" /><span className="max-w-[100px] truncate">{adj.nombre}</span></div>
              }
              <button onClick={() => setAdjuntos(prev => prev.filter((_, j) => j !== i))}
                className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1">
        <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e, 'imagen')} />
        <input ref={fileRef} type="file" className="hidden" onChange={e => handleFile(e, 'archivo')} />
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => imgRef.current?.click()}>
          {subiendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Image className="h-3.5 w-3.5" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => fileRef.current?.click()}>
          <Paperclip className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

const RESET = () => ({
  titulo: "",
  categoriaId: "",
  tipo: "hilo",
  texto: "",
  adjuntos: [],
  menciones: [],
  conEncuesta: false,
  encuestaPregunta: "",
  opciones: [{ id: genId(), texto: "" }, { id: genId(), texto: "" }],
});

export default function ForoNuevoHiloDialog({ open, onClose, onCrear, categorias, usuarios, user, loading }) {
  const [titulo, setTitulo] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [tipo, setTipo] = useState("hilo");
  // Texto y adjuntos se manejan directamente (no dependen del onSubmit del editor)
  const [texto, setTexto] = useState("");
  const [adjuntos, setAdjuntos] = useState([]);
  const [conEncuesta, setConEncuesta] = useState(false);
  const [encuestaPregunta, setEncuestaPregunta] = useState("");
  const [opciones, setOpciones] = useState([{ id: genId(), texto: "" }, { id: genId(), texto: "" }]);

  // Limpiar estado cuando se abre/cierra el dialog
  const prevOpen = useState(open)[0];
  useEffect(() => {
    if (!open) {
      const s = RESET();
      setTitulo(s.titulo); setCategoriaId(s.categoriaId); setTipo(s.tipo);
      setTexto(s.texto); setAdjuntos(s.adjuntos);
      setConEncuesta(s.conEncuesta); setEncuestaPregunta(s.encuestaPregunta);
      setOpciones(s.opciones);
    }
  }, [open]);

  const handleSubmit = () => {
    if (!titulo.trim() || !texto.trim()) return;
    const encuesta = conEncuesta && encuestaPregunta.trim() ? {
      pregunta: encuestaPregunta,
      opciones: opciones.filter(o => o.texto.trim()).map(o => ({ ...o, votos: [] })),
      activa: true,
    } : undefined;
    const menciones = [...texto.matchAll(/@([\w\s]+)/g)].map(m => m[1].trim());
    const cat = categorias.find(c => c.id === categoriaId);
    onCrear({
      titulo,
      cuerpo: texto,
      adjuntos,
      menciones,
      categoria_id: categoriaId || undefined,
      categoria_nombre: cat?.nombre || "",
      tipo,
      encuesta,
      // displayName viene del hook useCurrentUser del padre — prioriza nombre de ficha de empleado
      autor_nombre: user?.displayName || user?.full_name || user?.email || "Usuario",
      autor_id: user?.id,
      reacciones: {},
      fijado: false,
      cerrado: false,
      total_respuestas: 0,
      vistas: 0,
    });
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

          <EditorConAdjuntos
            texto={texto}
            setTexto={setTexto}
            adjuntos={adjuntos}
            setAdjuntos={setAdjuntos}
            usuarios={usuarios}
          />

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
            <Button onClick={handleSubmit} disabled={loading || !titulo.trim() || !texto.trim()}>
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Publicar hilo
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}