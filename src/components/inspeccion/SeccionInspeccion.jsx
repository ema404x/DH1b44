import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Trash2, ChevronDown, ChevronUp, CheckCircle2, Camera, AlertCircle, Loader2, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';

const getSpeechRecognition = () => window.SpeechRecognition || window.webkitSpeechRecognition || null;

export default function SeccionInspeccion({ seccion, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const [recording, setRecording] = useState(false);
  const [noSupport, setNoSupport] = useState(false);
  const [subiendoFotos, setSubiendoFotos] = useState(false);
  const recognitionRef = useRef(null);
  const isRecordingRef = useRef(false);
  const fileInputRef = useRef(null);
  const transcripcionAcumuladaRef = useRef(seccion.transcripcion || '');

  useEffect(() => {
    if (!isRecordingRef.current) {
      transcripcionAcumuladaRef.current = seccion.transcripcion || '';
    }
  }, [seccion.transcripcion]);

  useEffect(() => () => {
    isRecordingRef.current = false;
    recognitionRef.current?.stop();
  }, []);

  const createRecognition = () => {
    const SR = getSpeechRecognition();
    if (!SR) return null;
    const r = new SR();
    r.lang = 'es-AR';
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onresult = (e) => {
      let nuevas = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) nuevas += e.results[i][0].transcript + ' ';
      }
      if (nuevas.trim()) {
        const base = transcripcionAcumuladaRef.current;
        const updated = base ? base.trimEnd() + ' ' + nuevas.trim() : nuevas.trim();
        transcripcionAcumuladaRef.current = updated;
        onChange({ transcripcion: updated });
      }
    };

    r.onerror = (e) => {
      if (isRecordingRef.current && (e.error === 'no-speech' || e.error === 'audio-capture')) {
        setTimeout(() => { if (isRecordingRef.current) { try { r.start(); } catch (_) {} } }, 300);
      } else if (e.error !== 'aborted') {
        isRecordingRef.current = false;
        setRecording(false);
      }
    };

    r.onend = () => {
      if (isRecordingRef.current) {
        setTimeout(() => {
          if (isRecordingRef.current) {
            const newR = createRecognition();
            if (newR) { recognitionRef.current = newR; newR.start(); }
          }
        }, 200);
      } else {
        setRecording(false);
      }
    };

    return r;
  };

  const startRecording = () => {
    if (!getSpeechRecognition()) { setNoSupport(true); return; }
    isRecordingRef.current = true;
    setRecording(true);
    const r = createRecognition();
    if (r) { recognitionRef.current = r; r.start(); }
  };

  const stopRecording = () => {
    isRecordingRef.current = false;
    setRecording(false);
    recognitionRef.current?.stop();
  };

  const handlePhotos = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setSubiendoFotos(true);
    try {
      const urls = await Promise.all(files.map(f => base44.integrations.Core.UploadFile({ file: f }).then(r => r.file_url)));
      onChange({ fotos: [...(seccion.fotos || []), ...urls] });
    } finally {
      setSubiendoFotos(false);
      e.target.value = '';
    }
  };

  const removePhoto = (idx) => {
    const fotos = [...(seccion.fotos || [])];
    fotos.splice(idx, 1);
    onChange({ fotos });
  };

  const isComplete = seccion.completada;
  const hasContent = seccion.transcripcion || seccion.notas_libres;
  const fotoCount = seccion.fotos?.length || 0;

  return (
    <div className={cn(
      'rounded-lg border transition-all overflow-hidden',
      isComplete
        ? 'border-emerald-700/60 bg-emerald-900/10'
        : expanded
          ? 'border-primary/40 bg-card'
          : 'border-border bg-card hover:border-border/80'
    )}>
      {/* Header row */}
      <button
        className="w-full flex items-center justify-between px-3.5 py-2.5 text-left gap-3"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Status indicator */}
          <div className={cn(
            'h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
            isComplete ? 'border-emerald-500 bg-emerald-500' : 'border-muted-foreground/30'
          )}>
            {isComplete && <CheckCircle2 className="h-3 w-3 text-white" />}
          </div>
          <span className={cn('text-sm font-medium leading-tight', isComplete && 'text-muted-foreground line-through')}>
            {seccion.nombre}
          </span>
          {recording && (
            <span className="flex items-center gap-1 text-[10px] text-red-400 font-semibold bg-red-400/10 border border-red-400/30 px-1.5 py-0.5 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-ping" />
              REC
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasContent && !expanded && (
            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full max-w-[120px] truncate hidden sm:block">
              {(seccion.transcripcion || seccion.notas_libres || '').slice(0, 40)}...
            </span>
          )}
          {fotoCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-blue-400 bg-blue-400/10 border border-blue-400/20 px-2 py-0.5 rounded-full">
              <Image className="h-3 w-3" />{fotoCount}
            </span>
          )}
          {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </button>

      {/* Body */}
      {expanded && (
        <div className="border-t border-border/60 px-3.5 pb-3.5 pt-3 space-y-3">
          {/* Voice recording */}
          <div className="flex items-center gap-2 flex-wrap">
            {!recording ? (
              <Button size="sm" variant="outline" onClick={startRecording} className="gap-1.5 h-7 text-xs border-red-700/40 text-red-400 hover:bg-red-400/10 hover:border-red-400/60">
                <Mic className="h-3.5 w-3.5" /> Grabar voz
              </Button>
            ) : (
              <Button size="sm" onClick={stopRecording} className="gap-1.5 h-7 text-xs bg-red-600 hover:bg-red-700 text-white border-0">
                <Square className="h-3.5 w-3.5" /> Detener grabación
              </Button>
            )}
            {recording && (
              <span className="text-xs text-red-400 font-medium flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                Escuchando — hablá con normalidad, se reinicia automáticamente
              </span>
            )}
            {noSupport && (
              <span className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Usá Chrome para grabación de voz
              </span>
            )}
          </div>

          {/* Transcripción */}
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 block">Transcripción / Notas</label>
            <Textarea
              placeholder="La transcripción del audio aparecerá aquí, o escribí directamente..."
              value={seccion.transcripcion || ''}
              onChange={e => onChange({ transcripcion: e.target.value })}
              className="min-h-[72px] text-sm resize-none"
            />
          </div>

          {/* Notas adicionales */}
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 block">Observaciones adicionales</label>
            <Textarea
              placeholder="Materiales necesarios, urgencias, recomendaciones..."
              value={seccion.notas_libres || ''}
              onChange={e => onChange({ notas_libres: e.target.value })}
              className="min-h-[52px] text-sm resize-none"
            />
          </div>

          {/* Fotos */}
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Fotografías</label>
            <div className="flex flex-wrap gap-2">
              {(seccion.fotos || []).map((url, i) => (
                <div key={i} className="relative group h-16 w-16">
                  <img src={url} alt="" className="h-full w-full object-cover rounded-md border border-border" />
                  <button onClick={() => removePhoto(i)}
                    className="absolute -top-1.5 -right-1.5 h-4.5 w-4.5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow">
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => !subiendoFotos && fileInputRef.current?.click()}
                disabled={subiendoFotos}
                className="h-16 w-16 rounded-md border-2 border-dashed border-border flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:border-primary/50 hover:text-primary transition-all disabled:opacity-40"
              >
                {subiendoFotos
                  ? <><Loader2 className="h-4 w-4 animate-spin" /><span className="text-[9px] mt-0.5">Subiendo</span></>
                  : <><Camera className="h-4 w-4" /><span className="text-[9px] mt-0.5">Agregar</span></>}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotos} />
            </div>
          </div>

          {/* Acción completar */}
          <div className="flex justify-end pt-1">
            <Button
              size="sm"
              variant={isComplete ? 'outline' : 'default'}
              onClick={() => onChange({ completada: !isComplete })}
              className={cn('gap-1.5 h-7 text-xs', isComplete ? 'border-emerald-700 text-emerald-400 hover:bg-emerald-400/10' : '')}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {isComplete ? 'Desmarcar sección' : 'Marcar como revisada'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}