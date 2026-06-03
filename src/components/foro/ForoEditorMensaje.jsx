import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { base44 } from "@/api/base44Client";
import { Image, Paperclip, X, AtSign, Loader2 } from "lucide-react";

export default function ForoEditorMensaje({ placeholder = "Escribí tu mensaje...", onSubmit, usuarios = [], loading = false, minHeight = "h-24" }) {
  const [texto, setTexto] = useState("");
  const [adjuntos, setAdjuntos] = useState([]);
  const [subiendo, setSubiendo] = useState(false);
  const [showMenciones, setShowMenciones] = useState(false);
  const [busquedaMencion, setBusquedaMencion] = useState("");
  const fileRef = useRef();
  const imgRef = useRef();
  const textareaRef = useRef();

  const handleTexto = (e) => {
    const val = e.target.value;
    setTexto(val);
    const match = val.match(/@(\w*)$/);
    if (match) {
      setBusquedaMencion(match[1]);
      setShowMenciones(true);
    } else {
      setShowMenciones(false);
    }
  };

  const insertarMencion = (usuario) => {
    const nuevo = texto.replace(/@\w*$/, `@${usuario.full_name || usuario.nombre || 'usuario'} `);
    setTexto(nuevo);
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

  const quitarAdjunto = (idx) => setAdjuntos(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = () => {
    if (!texto.trim() && adjuntos.length === 0) return;
    const menciones = [...texto.matchAll(/@(\w[\w\s]*)/g)].map(m => m[1]);
    onSubmit({ texto, adjuntos, menciones });
    setTexto("");
    setAdjuntos([]);
  };

  const usuariosFiltrados = usuarios.filter(u =>
    (u.full_name || u.nombre || '').toLowerCase().includes(busquedaMencion.toLowerCase())
  ).slice(0, 6);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={texto}
          onChange={handleTexto}
          placeholder={placeholder}
          className={`${minHeight} resize-none text-sm`}
          onKeyDown={e => {
            if (e.key === 'Enter' && e.ctrlKey) handleSubmit();
          }}
        />
        {showMenciones && usuariosFiltrados.length > 0 && (
          <div className="absolute bottom-full mb-1 left-0 z-50 bg-popover border border-border rounded-lg shadow-xl w-64 overflow-hidden">
            {usuariosFiltrados.map(u => (
              <button
                key={u.id}
                onClick={() => insertarMencion(u)}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
              >
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {(u.full_name || u.nombre || '?')[0].toUpperCase()}
                </div>
                <span>{u.full_name || u.nombre}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {adjuntos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {adjuntos.map((adj, i) => (
            <div key={i} className="relative group">
              {adj.tipo === 'imagen' ? (
                <img src={adj.url} alt={adj.nombre} className="h-16 w-16 rounded-lg object-cover border border-border" />
              ) : (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-lg border border-border text-xs">
                  <Paperclip className="h-3 w-3" />
                  <span className="max-w-[100px] truncate">{adj.nombre}</span>
                </div>
              )}
              <button
                onClick={() => quitarAdjunto(i)}
                className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e, 'imagen')} />
        <input ref={fileRef} type="file" className="hidden" onChange={e => handleFile(e, 'archivo')} />
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => imgRef.current?.click()} title="Adjuntar imagen">
          {subiendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Image className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => fileRef.current?.click()} title="Adjuntar archivo">
          <Paperclip className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setTexto(t => t + '@')} title="Mencionar usuario">
          <AtSign className="h-4 w-4" />
        </Button>
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground hidden sm:block">Ctrl+Enter para enviar</span>
        <Button size="sm" onClick={handleSubmit} disabled={loading || (!texto.trim() && adjuntos.length === 0)} className="gap-2">
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Enviar
        </Button>
      </div>
    </div>
  );
}