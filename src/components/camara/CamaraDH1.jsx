import React from 'react';
import { createPortal } from 'react-dom';
import { X, SwitchCamera, Loader2, AlertCircle } from 'lucide-react';
import useCamaraStream from './useCamaraStream';
import { LADO_MAXIMO_FOTO } from '@/lib/camaraDH1';

// Cámara a pantalla completa dentro de la página (misma técnica que el escáner QR).
// Devuelve un File image/jpeg de hasta 1920 px del lado mayor.
export default function CamaraDH1({ open, onClose, onCapture, onFallback }) {
  const { videoRef, listo, error, hayVarias, cambiarCamara, detener } = useCamaraStream(open);
  if (!open) return null;

  const cerrar = () => { detener(); onClose(); };
  const sacar = () => {
    const v = videoRef.current;
    if (!v?.videoWidth) return;
    const escala = Math.min(1, LADO_MAXIMO_FOTO / Math.max(v.videoWidth, v.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(v.videoWidth * escala);
    canvas.height = Math.round(v.videoHeight * escala);
    canvas.getContext('2d').drawImage(v, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      detener();
      onCapture(new File([blob], `foto_${Date.now()}.jpg`, { type: 'image/jpeg', lastModified: Date.now() }));
    }, 'image/jpeg', 0.92);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col bg-black" onClick={(e) => e.stopPropagation()}>
      <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 h-full w-full object-cover" />
      <button type="button" onClick={cerrar} aria-label="Cerrar cámara"
        className="absolute right-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white"
        style={{ top: 'calc(env(safe-area-inset-top) + 16px)' }}>
        <X className="h-6 w-6" />
      </button>
      {!listo && !error && <div className="flex flex-1 items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-white" /></div>}
      {error && (
        <div className="relative z-10 m-auto max-w-xs space-y-4 p-6 text-center text-white">
          <AlertCircle className="mx-auto h-10 w-10 text-amber-400" />
          <p className="text-sm">{error}</p>
          <button type="button" onClick={onFallback} className="h-12 w-full rounded-xl bg-white text-sm font-bold text-black">Usar la cámara del sistema</button>
        </div>
      )}
      {listo && (
        <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-center pt-6"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 28px)' }}>
          <button type="button" onClick={sacar} aria-label="Sacar foto"
            className="h-20 w-20 rounded-full border-4 border-white bg-white/80 active:scale-90 transition-transform" />
          {hayVarias && (
            <button type="button" onClick={cambiarCamara} aria-label="Cambiar cámara"
              className="absolute right-8 flex h-14 w-14 items-center justify-center rounded-full bg-black/60 text-white">
              <SwitchCamera className="h-6 w-6" />
            </button>
          )}
        </div>
      )}
    </div>,
    document.body,
  );
}