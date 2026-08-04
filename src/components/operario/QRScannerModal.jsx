import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, ScanLine, Camera, AlertCircle, CheckCircle2 } from 'lucide-react';

/**
 * Modal de escaneo QR para OTs.
 * Escanea un código QR que contiene una URL tipo:
 *   https://app.base44.com/portal-operario?loc=<location_qr_id>
 *   https://app.base44.com/ejecutar-ot-simple?ot=<work_order_id>
 * También soporta IDs crudos o URLs relativas.
 * Llama onResult(parsedData) al escanear.
 */
export default function QRScannerModal({ open, onClose, onResult }) {
  const containerId = 'qr-reader-container';
  const scannerRef = useRef(null);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanFlash, setScanFlash] = useState(false);
  const stopRef = useRef(false);

  // Refs para siempre tener los callbacks más recientes (evita stale closure)
  const onResultRef = useRef(onResult);
  const onCloseRef = useRef(onClose);
  onResultRef.current = onResult;
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    stopRef.current = false;
    setError(null);
    setScanning(false);
    setScanFlash(false);

    let cancelled = false;

    const startScanner = async () => {
      if (cancelled) return;
      try {
        const html5QrCode = new Html5Qrcode(containerId);
        scannerRef.current = html5QrCode;

        const config = {
          fps: 15,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            return { width: Math.floor(minEdge * 0.7), height: Math.floor(minEdge * 0.7) };
          },
          aspectRatio: 1.0,
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        };

        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            if (stopRef.current || cancelled) return;
            stopRef.current = true;
            // Feedback visual de éxito
            setScanFlash(true);
            // Vibración si está disponible
            if (navigator.vibrate) navigator.vibrate(100);
            // Procesar y notificar
            const parsed = parseQRContent(decodedText);
            try {
              onResultRef.current(parsed);
            } catch (e) {
              console.error('[QR] Error en onResult:', e);
            }
            // Cerrar scanner tras un breve delay para que el flash sea visible
            setTimeout(() => {
              cleanupScanner();
              onCloseRef.current();
            }, 350);
          },
          () => {
            // Callback por cada frame sin QR — normal, ignorar.
          }
        );
        if (!cancelled) setScanning(true);
      } catch (err) {
        console.error('QR scanner start error:', err);
        if (!cancelled) setError('No se pudo acceder a la cámara. Verificá los permisos del navegador.');
      }
    };

    // Pequeño delay para que el DOM del modal esté presente
    const timer = setTimeout(startScanner, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      stopRef.current = true;
      cleanupScanner();
    };
  }, [open]);

  const cleanupScanner = () => {
    try {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
    } catch {
      // ignore
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-bold text-white">Escanear QR</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scanner area */}
        <div className="relative">
          <div id={containerId} className="w-full aspect-square bg-black" />
          {!scanning && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
              <Camera className="h-10 w-10 text-slate-600 animate-pulse" />
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900 p-6 text-center">
              <AlertCircle className="h-10 w-10 text-red-400" />
              <p className="text-sm text-slate-300">{error}</p>
            </div>
          )}
          {/* Overlay scan frame */}
          {scanning && !error && !scanFlash && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-56 h-56 border-2 border-primary/70 rounded-2xl shadow-[0_0_20px_rgba(99,102,241,0.3)]" />
            </div>
          )}
          {/* Flash de éxito */}
          {scanFlash && (
            <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/20 backdrop-blur-sm">
              <CheckCircle2 className="h-16 w-16 text-emerald-400 drop-shadow-lg" />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 text-center">
          <p className="text-xs text-slate-400">
            {scanFlash ? '¡Código detectado!' : 'Apuntá la cámara al código QR de la orden de trabajo'}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Parser robusto del contenido del QR.
 * Soporta URLs completas, URLs relativas, y IDs crudos.
 * Extrae parámetros `loc` y `ot` con regex fallback.
 */
function parseQRContent(decodedText) {
  const text = (decodedText || '').trim();

  // Intentar parsear como URL (completa o relativa)
  try {
    const url = new URL(text);
    const loc = url.searchParams.get('loc');
    const ot = url.searchParams.get('ot');
    if (loc) return { type: 'loc', value: loc, raw: text };
    if (ot) return { type: 'ot', value: ot, raw: text };
  } catch {
    // No es una URL válida absoluta — intentar como URL relativa
    try {
      const url = new URL(text, window.location.origin);
      const loc = url.searchParams.get('loc');
      const ot = url.searchParams.get('ot');
      if (loc) return { type: 'loc', value: loc, raw: text };
      if (ot) return { type: 'ot', value: ot, raw: text };
    } catch {
      // Continuar con regex
    }
  }

  // Regex fallback: buscar ?loc=XXX o ?ot=XXX o &loc=XXX o &ot=XXX en el texto
  const locMatch = text.match(/[?&]loc=([^&\s]+)/);
  if (locMatch) return { type: 'loc', value: locMatch[1], raw: text };

  const otMatch = text.match(/[?&]ot=([^&\s]+)/);
  if (otMatch) return { type: 'ot', value: otMatch[1], raw: text };

  // Último recurso: texto crudo
  return { type: 'raw', value: text, raw: text };
}