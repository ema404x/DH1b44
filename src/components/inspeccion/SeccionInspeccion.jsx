import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Trash2, ChevronDown, ChevronUp, CheckCircle2, Camera, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';

const getSpeechRecognition = () => window.SpeechRecognition || window.webkitSpeechRecognition || null;

export default function SeccionInspeccion({ seccion, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const [recording, setRecording] = useState(false);
  const [noSupport, setNoSupport] = useState(false);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);
  const transcripcionAcumuladaRef = useRef(seccion.transcripcion || '');

  // Mantener ref sincronizada con la prop
  useEffect(() => {
    transcripcionAcumuladaRef.current = seccion.transcripcion || '';
  }, [seccion.transcripcion]);

  // Detener reconocimiento al desmontar
  useEffect(() => {
    return () => { recognitionRef.current?.stop(); };
  }, []);

  const startRecording = () => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setNoSupport(true);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-AR';
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (e) => {
      const nuevasPalabras = Array.from(e.results)
        .slice(e.resultIndex)
        .map(r => r[0].transcript)
        .join(' ');
      const base = transcripcionAcumuladaRef.current;
      const updated = base ? base + ' ' + nuevasPalabras : nuevasPalabras;
      transcripcionAcumuladaRef.current = updated;
      onChange({ transcripcion: updated });
    };

    recognition.onerror = () => setRecording(false);
    recognition.onend = () => setRecording(false);

    recognition.start();
    recognitionRef.current = recognition;
    setRecording(true);
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setRecording(false);
  };

  const handlePhotos = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const urls = await Promise.all(files.map(file => base44.integrations.Core.UploadFile({ file }).then(r => r.file_url)));
    onChange({ fotos: [...(seccion.fotos || []), ...urls] });
    e.target.value = '';
  };

  const removePhoto = (idx) => {
    const fotos = [...(seccion.fotos || [])];
    fotos.splice(idx, 1);
    onChange({ fotos });
  };

  const isComplete = seccion.completada;

  return (
    <div className={cn(
      'rounded-xl border transition-all',
      isComplete ? 'border-emerald-200 bg-emerald-50/50' : 'border-border bg-card'
    )}>
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          {isComplete
            ? <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
            : <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />
          }
          <span className="font-medium text-sm">{seccion.nombre}</span>
          {(seccion.transcripcion || seccion.notas_libres) && (
            <span className="text-xs text-muted-foreground">
              {[seccion.transcripcion, seccion.notas_libres].filter(Boolean).join(' ').slice(0, 50)}...
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {seccion.fotos?.length > 0 && (
            <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
              📷 {seccion.fotos.length}
            </span>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/50">
          {/* Audio */}
          <div className="pt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Grabación de voz</p>
            <div className="flex items-center gap-2">
              {!recording ? (
                <Button size="sm" variant="outline" onClick={startRecording} className="gap-2">
                  <Mic className="h-4 w-4 text-red-500" /> Grabar
                </Button>
              ) : (
                <Button size="sm" variant="destructive" onClick={stopRecording} className="gap-2 animate-pulse">
                  <Square className="h-4 w-4" /> Detener
                </Button>
              )}
              {noSupport && <span className="flex items-center gap-1.5 text-xs text-destructive"><AlertCircle className="h-3 w-3" /> Tu navegador no soporta reconocimiento de voz. Usá Chrome.</span>}
            </div>
          </div>

          {/* Transcripción */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Transcripción / Notas</p>
            <Textarea
              placeholder="La transcripción del audio aparecerá aquí, o escribí tus notas..."
              value={seccion.transcripcion || ''}
              onChange={e => onChange({ transcripcion: e.target.value })}
              className="min-h-[80px] text-sm"
            />
          </div>

          {/* Notas libres */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Notas adicionales</p>
            <Textarea
              placeholder="Observaciones adicionales, materiales necesarios, urgencias..."
              value={seccion.notas_libres || ''}
              onChange={e => onChange({ notas_libres: e.target.value })}
              className="min-h-[60px] text-sm"
            />
          </div>

          {/* Fotos */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Fotos</p>
            <div className="flex flex-wrap gap-2">
              {(seccion.fotos || []).map((url, i) => (
                <div key={i} className="relative group">
                  <img src={url} alt="" className="h-20 w-20 object-cover rounded-lg border" />
                  <button
                    onClick={() => removePhoto(i)}
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="h-20 w-20 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
              >
                <Camera className="h-5 w-5" />
                <span className="text-[10px]">Agregar</span>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotos} />
            </div>
          </div>

          {/* Marcar completada */}
          <div className="flex justify-end">
            <Button
              size="sm"
              variant={isComplete ? 'outline' : 'default'}
              onClick={() => onChange({ completada: !isComplete })}
              className="gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              {isComplete ? 'Desmarcar' : 'Marcar como revisada'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}