import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, ScanLine, Camera, AlertCircle } from 'lucide-react';

/**
 * Modal de escaneo QR para OTs.
 * Escanea un código QR que contiene una URL tipo:
 *   /portal-operario?loc=<location_qr_id>
 *   /ejecutar-ot-simple?ot=<work_order_id>
 * Llama onResult(parsedData) al escanear.
 */
export default function QRScannerModal({ open, onClose, onResult }) {
  const containerId = 'qr-reader-container';
  const scannerRef = useRef(null);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const stopRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    stopRef.current = false;
    setError(null);
    setScanning(false);

    const startScanner = async () => {
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
            if (stopRef.current) return;
            stopRef.current = true;
            handleScan(decodedText);
          },
          (err) => {
            // Callback por cada frame sin QR — normal, no hacemos nada.
            // Pero si es un error real de decode, logueamos para debug.
            if (err && typeof err !== 'string') console.warn('QR decode err:', err);
          }
        );
        setScanning(true);
      } catch (err) {
        console.error('QR scanner start error:', err);
        setError('No se pudo acceder a la cámara. Verificá los permisos del navegador.');
      }
    };

    // Pequeño delay para que el DOM del modal esté presente
    const timer = setTimeout(startScanner, 300);

    return () => {
      clearTimeout(timer);
      stopRef.current = true;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [open]);

  const handleScan = (decodedText) => {
    try {
      const url = new URL(decodedText);
      const params = url.searchParams;
      const loc = params.get('loc');
      const ot = params.get('ot');

      if (loc) {
        onResult({ type: 'loc', value: loc });
      } else if (ot) {
        onResult({ type: 'ot', value: ot });
      } else {
        // QR sin parámetros conocidos — pasar el texto crudo
        onResult({ type: 'raw', value: decodedText });
      }
    } catch {
      // No es una URL — intentar como ID crudo
      onResult({ type: 'raw', value: decodedText });
    }
    cleanup();
  };

  const cleanup = () => {
    try {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current.clear().catch(() => {});
      }
    } catch {
      // ignore — solo nos importa cerrar
    } finally {
      scannerRef.current = null;
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={cleanup} />
      <div className="relative w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-bold text-white">Escanear QR</h3>
          </div>
          <button onClick={cleanup} className="text-slate-400 hover:text-white">
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
          {scanning && !error && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-56 h-56 border-2 border-primary/70 rounded-2xl shadow-[0_0_20px_rgba(99,102,241,0.3)]" />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 text-center">
          <p className="text-xs text-slate-400">
            Apuntá la cámara al código QR de la orden de trabajo
          </p>
        </div>
      </div>
    </div>
  );
}