import { useEffect, useRef, useState } from 'react';

/**
 * Dictado por voz (Web Speech API), mismo enfoque que CrearOT: una sesión por
 * vez y solo resultados finales. onTexto recibe cada frase reconocida.
 */
export function useDictado(onTexto) {
  const [grabando, setGrabando] = useState(false);
  const activo = useRef(false);
  const rec = useRef(null);
  const cb = useRef(onTexto);
  cb.current = onTexto;
  const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

  const crear = () => {
    const r = new SR();
    r.lang = 'es-AR';
    r.continuous = false;
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      const t = Array.from(e.results).map((x) => x[0].transcript).join(' ').trim();
      if (t) cb.current(t);
    };
    r.onerror = (e) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') { activo.current = false; setGrabando(false); }
    };
    r.onend = () => {
      if (activo.current) setTimeout(() => { if (activo.current) { rec.current = crear(); rec.current.start(); } }, 200);
      else setGrabando(false);
    };
    return r;
  };

  const iniciar = () => {
    if (!SR) return;
    activo.current = true;
    setGrabando(true);
    rec.current = crear();
    rec.current.start();
  };
  const detener = () => {
    activo.current = false;
    setGrabando(false);
    rec.current?.stop();
  };

  useEffect(() => () => { activo.current = false; rec.current?.stop(); }, []);

  return { soportado: !!SR, grabando, iniciar, detener };
}