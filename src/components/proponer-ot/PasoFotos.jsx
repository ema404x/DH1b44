import React, { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { prepareOfflinePhoto } from '@/lib/offlinePhotos';

const MAX = 6;

// Paso 3: fotos (cámara o galería). Se comprimen y quedan en el dispositivo
// hasta enviar; sin conexión viajan con la propuesta en la cola.
export default function PasoFotos({ fotos, onChange }) {
  const camRef = useRef(null);
  const galRef = useRef(null);
  const [procesando, setProcesando] = useState(false);

  const agregar = async (files) => {
    const list = Array.from(files || []).slice(0, MAX - fotos.length);
    if (!list.length) return;
    setProcesando(true);
    const nuevas = [];
    try {
      for (const file of list) {
        const p = await prepareOfflinePhoto(file);
        if (!p) break;
        nuevas.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, ...p, url: URL.createObjectURL(p.blob) });
      }
    } catch (err) {
      toast.error(err?.message || 'No se pudo agregar la foto');
    } finally {
      onChange([...fotos, ...nuevas]);
      setProcesando(false);
      if (camRef.current) camRef.current.value = '';
      if (galRef.current) galRef.current.value = '';
    }
  };

  const quitar = (id) => onChange(fotos.filter((f) => f.id !== id));
  const lleno = fotos.length >= MAX;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <button disabled={lleno || procesando} onClick={() => camRef.current?.click()} className="flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-2xl bg-primary text-base font-bold text-primary-foreground active:scale-[0.97] disabled:opacity-50">
          <Camera className="h-7 w-7" /> Cámara
        </button>
        <button disabled={lleno || procesando} onClick={() => galRef.current?.click()} className="flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card text-base font-bold text-card-foreground active:scale-[0.97] disabled:opacity-50">
          <ImageIcon className="h-7 w-7" /> Galería
        </button>
      </div>
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => agregar(e.target.files)} />
      <input ref={galRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => agregar(e.target.files)} />
      {procesando && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Preparando foto…</p>}
      {fotos.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">Las fotos ayudan a tu jefe a entender el problema. Son opcionales.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {fotos.map((f) => (
            <div key={f.id} className="relative aspect-square overflow-hidden rounded-xl border border-border">
              <img src={f.url} alt="Foto de la propuesta" className="h-full w-full object-cover" />
              <button onClick={() => quitar(f.id)} aria-label="Quitar foto" className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground text-center">{fotos.length} de {MAX} fotos</p>
    </div>
  );
}