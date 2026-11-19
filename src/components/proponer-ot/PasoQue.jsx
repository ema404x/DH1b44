import React from 'react';
import { Mic, MicOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useDictado } from '@/hooks/useDictado';

// Paso 2: título corto y descripción (con dictado si el navegador lo permite).
export default function PasoQue({ titulo, descripcion, onChange }) {
  const dictado = useDictado((t) => onChange({ descripcion: descripcion ? `${descripcion.trimEnd()} ${t}` : t }));
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-foreground">¿Qué hay que hacer?</label>
        <Input value={titulo} maxLength={80} onChange={(e) => onChange({ titulo: e.target.value })} placeholder="Ej: Pérdida de agua en el baño" className="h-12 text-base" />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-foreground">Contá un poco más <span className="font-normal text-muted-foreground">(opcional)</span></label>
        <Textarea rows={4} value={descripcion} onChange={(e) => onChange({ descripcion: e.target.value })} placeholder="Qué viste, desde cuándo, qué se necesita" className="text-base" />
      </div>
      {dictado.soportado && (
        <button
          onClick={dictado.grabando ? dictado.detener : dictado.iniciar}
          className={`flex h-14 w-full items-center justify-center gap-2 rounded-xl border text-base font-semibold transition-colors ${dictado.grabando ? 'border-red-400/40 bg-red-500/15 text-red-300 animate-pulse' : 'border-border bg-card text-card-foreground active:bg-accent'}`}
        >
          {dictado.grabando ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          {dictado.grabando ? 'Tocá para dejar de dictar' : 'Dictar con la voz'}
        </button>
      )}
    </div>
  );
}