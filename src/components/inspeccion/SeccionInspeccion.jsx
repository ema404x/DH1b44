import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, ChevronDown, ChevronUp, CheckCircle2, Camera, AlertCircle, Loader2, Image, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';

const URGENCIA_OPTIONS = [
  { value: 'urgente',    label: 'Urgente',      color: 'bg-red-900/50 text-red-300 border-red-700/60',     dot: 'bg-red-400',     emoji: '🔴' },
  { value: 'importante', label: 'Importante',   color: 'bg-amber-900/50 text-amber-300 border-amber-700/60', dot: 'bg-amber-400',  emoji: '🟡' },
  { value: 'leve',       label: 'Leve',         color: 'bg-green-900/50 text-green-300 border-green-700/60', dot: 'bg-green-400',  emoji: '🟢' },
  { value: 'sin_issues', label: 'Sin problemas', color: 'bg-slate-800 text-slate-400 border-slate-600',     dot: 'bg-slate-500',   emoji: '⚪' },
];

const getSpeechRecognition = () => window.SpeechRecognition || window.webkitSpeechRecognition || null;

export default function SeccionInspeccion({ seccion, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const [recording, setRecording] = useState(false);
  const [noSupport, setNoSupport] = useState(false);
  const [subiendoFotos, setSubiendoFotos] = useState(false);
  const [lightbox, setLightbox] = useState(null); // URL de foto en pantalla completa
  const recognitionRef = useRef(null);
  const isRecordingRef = useRef(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
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

  // ── Web Speech API ──────────────────────────────────────────────────────────
  const createRecognition = () => {
    const SR = getSpeechRecognition();
    if (!SR) return null;
    const r = new SR();
    r.lang = 'es-AR';
    r.continuous = false;
    r.interimResults = false;
    r.maxAlternatives = 1;

    r.onresult = (e) => {
      const transcript = Array.from(e.results).map(res => res[0].transcript).join(' ').trim();
      if (transcript) {
        const base = transcripcionAcumuladaRef.current.trimEnd();
        const updated = base ? base + ' ' + transcript : transcript;
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
    transcripcionAcumuladaRef.current = seccion.transcripcion || '';
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

  // ── Fotos ───────────────────────────────────────────────────────────────────
  const handlePhotos = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setSubiendoFotos(true);
    try {
      const urls = await Promise.all(
        files.map(f => base44.integrations.Core.UploadFile({ file: f }).then(r => r.file_url))
      );
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
  const urgencia = URGENCIA_OPTIONS.find(u => u.value === seccion.urgencia);

  return (
    <>
      <div className={cn(
        'rounded-xl border transition-all overflow-hidden',
        isComplete
          ? 'border-emerald-700/60 bg-emerald-900/10'
          : expanded
            ? 'border-primary/40 bg-card'
            : 'border-border bg-card'
      )}>
        {/* Header — touch target grande */}
        <button
          className="w-full flex items-center justify-between px-4 py-3.5 text-left gap-3 active:bg-accent/50 transition-colors"
          onClick={() => setExpanded(v => !v)}
        >
          <div className="flex items-center gap-3 min-w-0">
            {/* Status circle */}
            <div className={cn(
              'h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
              isComplete ? 'border-emerald-500 bg-emerald-500' : 'border-muted-foreground/30'
            )}>
              {isComplete && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
            </div>
            <div className="min-w-0">
              <span className={cn(
                'text-sm font-medium leading-tight block',
                isComplete && 'text-muted-foreground line-through'
              )}>
                {seccion.nombre}
              </span>
              {/* Badges inline */}
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {recording && (
                  <span className="flex items-center gap-1 text-[10px] text-red-400 font-semibold">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-ping" />REC
                  </span>
                )}
                {urgencia && (
                  <span className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${urgencia.color}`}>
                    {urgencia.emoji} {urgencia.label}
                  </span>
                )}
                {fotoCount > 0 && (
                  <span className="flex items-center gap-1 text-[11px] text-blue-400">
                    <Image className="h-3 w-3" />{fotoCount} foto{fotoCount !== 1 ? 's' : ''}
                  </span>
                )}
                {hasContent && !expanded && (
                  <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">
                    {(seccion.transcripcion || seccion.notas_libres || '').slice(0, 50)}…
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </button>

        {/* Body */}
        {expanded && (
          <div className="border-t border-border/60 px-4 pb-4 pt-3 space-y-4">

            {/* ── Nivel de urgencia ── */}
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Nivel de urgencia</label>
              <div className="grid grid-cols-2 gap-1.5">
                {URGENCIA_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => onChange({ urgencia: seccion.urgencia === opt.value ? null : opt.value })}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all',
                      seccion.urgencia === opt.value
                        ? opt.color + ' ring-1 ring-current'
                        : 'border-border text-muted-foreground hover:border-muted-foreground/40'
                    )}
                  >
                    <span>{opt.emoji}</span> {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Grabación de voz ── */}
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Notas de voz</label>
              {!recording ? (
                <button
                  onClick={startRecording}
                  className="flex items-center gap-2.5 w-full justify-center h-12 rounded-xl border-2 border-dashed border-red-700/40 text-red-400 hover:border-red-500/60 hover:bg-red-400/5 active:bg-red-400/10 transition-all font-semibold text-sm"
                >
                  <Mic className="h-5 w-5" /> Grabar voz
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="flex items-center gap-2.5 w-full justify-center h-12 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-semibold text-sm transition-colors"
                >
                  <Square className="h-4 w-4" /> Detener grabación
                  <span className="h-2 w-2 rounded-full bg-white animate-ping ml-1" />
                </button>
              )}
              {recording && (
                <p className="text-xs text-red-400 font-medium flex items-center gap-1.5 justify-center mt-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Escuchando — hablá con normalidad
                </p>
              )}
              {noSupport && (
                <p className="text-xs text-destructive flex items-center gap-1 justify-center mt-2">
                  <AlertCircle className="h-3 w-3" /> Usá Chrome para grabación de voz
                </p>
              )}
            </div>

            {/* ── Transcripción ── */}
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Transcripción / Notas</label>
              <Textarea
                placeholder="La transcripción aparece aquí, o escribí directamente..."
                value={seccion.transcripcion || ''}
                onChange={e => onChange({ transcripcion: e.target.value })}
                className="min-h-[80px] text-sm resize-none"
              />
            </div>

            {/* ── Observaciones ── */}
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Observaciones adicionales</label>
              <Textarea
                placeholder="Materiales necesarios, urgencias, recomendaciones..."
                value={seccion.notas_libres || ''}
                onChange={e => onChange({ notas_libres: e.target.value })}
                className="min-h-[60px] text-sm resize-none"
              />
            </div>

            {/* ── Fotos ── */}
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">
                Fotografías {fotoCount > 0 && `(${fotoCount})`}
              </label>

              {/* Grid de fotos */}
              {fotoCount > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {(seccion.fotos || []).map((url, i) => (
                    <div key={i} className="relative group aspect-[4/3]">
                      <img
                        src={url}
                        alt={`Foto ${i + 1}`}
                        onClick={() => setLightbox(url)}
                        className="h-full w-full object-cover rounded-xl border border-border cursor-pointer active:opacity-80 transition-opacity"
                      />
                      <button
                        onClick={() => removePhoto(i)}
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Botones de captura */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => !subiendoFotos && cameraInputRef.current?.click()}
                  disabled={subiendoFotos}
                  className="flex flex-col items-center justify-center gap-1.5 h-14 rounded-xl border-2 border-dashed border-primary/50 text-primary bg-primary/5 hover:bg-primary/10 active:bg-primary/15 transition-all disabled:opacity-40 font-medium text-sm"
                >
                  {subiendoFotos ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                  <span className="text-xs">Cámara</span>
                </button>
                <button
                  onClick={() => !subiendoFotos && fileInputRef.current?.click()}
                  disabled={subiendoFotos}
                  className="flex flex-col items-center justify-center gap-1.5 h-14 rounded-xl border-2 border-dashed border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground active:bg-accent/50 transition-all disabled:opacity-40 text-sm"
                >
                  <Image className="h-5 w-5" />
                  <span className="text-xs">Galería</span>
                </button>
              </div>
              {subiendoFotos && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> Subiendo fotos...
                </p>
              )}

              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotos} />
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotos} />
            </div>

            {/* ── Marcar completada ── */}
            <button
              onClick={() => onChange({ completada: !isComplete })}
              className={cn(
                'w-full flex items-center justify-center gap-2 h-12 rounded-xl font-semibold text-sm transition-all active:scale-[0.98]',
                isComplete
                  ? 'border-2 border-emerald-700/60 bg-emerald-900/20 text-emerald-400 hover:bg-emerald-900/30'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md'
              )}
            >
              <CheckCircle2 className="h-4 w-4" />
              {isComplete ? 'Desmarcar sección' : 'Marcar como revisada'}
            </button>
          </div>
        )}
      </div>

      {/* Lightbox fullscreen */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 text-white flex items-center justify-center"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={lightbox}
            alt="Foto"
            className="max-w-full max-h-[90dvh] object-contain rounded-xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}