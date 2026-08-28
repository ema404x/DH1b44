import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { X, ScanLine, Camera, AlertCircle, CheckCircle2, Keyboard, Loader2 } from 'lucide-react';

/**
 * Modal de escaneo QR para OTs / ubicaciones / activos.
 *
 * Escanea un código QR que contiene una URL tipo:
 *   https://<host>/portal-operario?loc=<location_qr_id>
 *   https://<host>/orden-trabajo?ot=<work_order_id>
 *   https://<host>/ejecutar-ot-simple?ot=<work_order_id>
 * También soporta IDs crudos o URLs relativas.
 * Llama onResult(parsedData) al escanear.
 *
 * Robustez (sin dejar vacíos):
 *  - Ciclo de vida de cámara sólido con refs: nunca arranca dos veces, siempre
 *    libera la cámara al cerrar/reintentar (evita "cámara en uso" en reaperturas).
 *  - Fallback de cámara: si no hay trasera (environment) prueba la frontal.
 *  - Si la cámara no está disponible (desktop sin webcam, permisos denegados),
 *    ofrece Reintentar e Ingreso manual del código → el lector nunca queda
 *    trabado: el operario siempre puede resolver la OT/ubicación.
 */
export default function QRScannerModal({ open, onClose, onResult }) {
  const containerId = 'qr-reader-container';
  const scannerRef = useRef(null);
  const startingRef = useRef(false);
  const stopRef = useRef(false);

  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [scanFlash, setScanFlash] = useState(false);
  const [unrecognized, setUnrecognized] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualValue, setManualValue] = useState('');
  const [manualError, setManualError] = useState(false);

  // Refs para siempre tener los callbacks más recientes (evita stale closure)
  const onResultRef = useRef(onResult);
  const onCloseRef = useRef(onClose);
  onResultRef.current = onResult;
  onCloseRef.current = onClose;

  const cleanupScanner = useCallback(() => {
    const inst = scannerRef.current;
    scannerRef.current = null;
    setScanning(false);
    if (!inst) return;
    // stop() y clear() son async y pueden rechazar si ya se detuvo; los
    // envolvemos para que nunca lancen al caller.
    Promise.allSettled([
      inst.stop().catch(() => {}),
      inst.clear().catch(() => {}),
    ]);
  }, []);

  const dispatchResult = useCallback((parsed) => {
    if (stopRef.current) return;
    if (parsed.type === 'unknown') {
      setUnrecognized(true);
      if (navigator.vibrate) navigator.vibrate(80);
      // Reanudar detección tras un breve delay para poder escanear otro código
      setTimeout(() => { stopRef.current = false; }, 600);
      return;
    }
    stopRef.current = true;
    setScanFlash(true);
    if (navigator.vibrate) navigator.vibrate(100);
    try {
      onResultRef.current(parsed);
    } catch (e) {
      console.error('[QR] Error en onResult:', e);
    }
    setTimeout(() => {
      cleanupScanner();
      onCloseRef.current();
    }, 350);
  }, [cleanupScanner]);

  const startScanner = useCallback(async () => {
    if (startingRef.current || scannerRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setError(null);
    setUnrecognized(false);
    try {
      // Guard: esperar a que el contenedor exista en el DOM (el modal acaba de
      // abrirse). Sin esto, en aperturas rápidas Html5Qrcode lanza "Element not
      // found" y el escáner nunca arranca.
      let waitCount = 0;
      while (!document.getElementById(containerId) && waitCount < 20) {
        await new Promise((r) => setTimeout(r, 50));
        waitCount++;
      }
      if (!document.getElementById(containerId)) {
        throw new Error('Contenedor de cámara no disponible');
      }
      const html5QrCode = new Html5Qrcode(containerId);
      scannerRef.current = html5QrCode;

      const config = {
        fps: 12,
        qrbox: (vw, vh) => {
          const minEdge = Math.min(vw, vh);
          return { width: Math.floor(minEdge * 0.7), height: Math.floor(minEdge * 0.7) };
        },
        aspectRatio: 1.0,
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
      };

      const onStart = (cam) => html5QrCode.start(cam, config, (decodedText) => {
        if (stopRef.current) return;
        dispatchResult(parseQRContent(decodedText));
      }, () => { /* frame sin QR — normal */ });

      // Selección de cámara robusta: facingMode falla en algunos Android donde
      // el label no expone "environment". Enumeramos los dispositivos y elegimos
      // la trasera por label; si no, la última cámara disponible (suele ser la
      // trasera en teléfonos). Finales: cualquier cámara es mejor que ninguna.
      const tryStart = async (cam) => { try { await onStart(cam); return true; } catch { return false; } };

      let started = false;
      // 1) facingMode environment (rápido, pide permiso)
      started = await tryStart({ facingMode: 'environment' });
      // 2) facingMode user (desktop / sólo frontal)
      if (!started) started = await tryStart({ facingMode: 'user' });
      // 3) Enumeración explícita de dispositivos (fallback robusto)
      if (!started) {
        try {
          const cams = await Html5Qrcode.getCameras();
          if (cams && cams.length) {
            const back = cams.find((c) => /back|rear|environment|trasera|posteri/i.test(c.label || ''));
            const pick = back?.id || cams[cams.length - 1].id || cams[0].id;
            started = await tryStart(pick);
            if (!started) {
              // probar cada cámara hasta una que arranque
              for (const c of cams) { if (await tryStart(c.id)) { started = true; break; } }
            }
          }
        } catch (_) {}
      }
      if (!started) throw new Error('No camera available');
      setScanning(true);
    } catch (err) {
      console.error('QR scanner start error:', err);
      cleanupScanner();
      setError('No se pudo acceder a la cámara. Verificá los permisos del navegador o ingresá el código manualmente.');
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }, [dispatchResult, cleanupScanner]);

  useEffect(() => {
    if (!open) return;
    stopRef.current = false;
    startingRef.current = false;
    setError(null);
    setScanning(false);
    setScanFlash(false);
    setUnrecognized(false);
    setManualMode(false);
    setManualValue('');
    setManualError(false);

    let cancelled = false;
    // Pequeño delay para que el DOM del modal esté presente
    const timer = setTimeout(() => { if (!cancelled) startScanner(); }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      stopRef.current = true;
      cleanupScanner();
    };
  }, [open, startScanner, cleanupScanner]);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    const v = manualValue.trim();
    if (!v) return;
    const parsed = parseQRContent(v);
    if (parsed.type === 'unknown') {
      setManualError(true);
      return;
    }
    stopRef.current = true;
    cleanupScanner();
    try {
      onResultRef.current(parsed);
    } catch (err) {
      console.error('[QR] Error en onResult (manual):', err);
    }
    onCloseRef.current();
  };

  const switchToManual = () => {
    cleanupScanner();
    setManualMode(true);
    setUnrecognized(false);
    setError(null);
    setManualError(false);
  };

  if (!open) return null;

  // Portal a document.body: escapa el stacking context de layouts con z-index
  // (AppLayout/MobileBottomNav z-40) que dejaban la barra inferior por encima
  // del modal e interceptaban los taps / tapaban la cámara.
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm max-h-[90vh] flex flex-col bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            {manualMode ? <Keyboard className="h-5 w-5 text-primary" /> : <ScanLine className="h-5 w-5 text-primary" />}
            <h3 className="text-sm font-bold text-white">{manualMode ? 'Ingresar código' : 'Escanear QR'}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Cuerpo: escáner o ingreso manual */}
        {manualMode ? (
          <div className="p-5 space-y-4">
            <p className="text-xs text-slate-400">
              Escribí el código tal como aparece en el QR (URL completa o ID). Se reconoce igual que al escanear.
            </p>
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <input
                autoFocus
                value={manualValue}
                onChange={(e) => { setManualValue(e.target.value); setManualError(false); }}
                placeholder="https://.../orden-trabajo?ot=...  o  ID"
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {manualError && (
                <p className="text-xs text-amber-400 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" /> Ese código no corresponde a una OT, ubicación ni activo.
                </p>
              )}
              <div className="flex gap-2">
                <button type="submit" disabled={!manualValue.trim()}
                  className="flex-1 h-11 rounded-lg bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50">
                  Buscar
                </button>
                <button type="button" onClick={() => { setManualMode(false); setManualValue(''); setManualError(false); setTimeout(startScanner, 100); }}
                  className="h-11 px-4 rounded-lg border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-800 transition-colors">
                  Volver a escanear
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="relative">
            <div id={containerId} className="w-full aspect-square max-h-[55vh] bg-black shrink-0" />

            {/* Cargando inicio */}
            {starting && !scanning && !error && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                <Loader2 className="h-8 w-8 text-slate-400 animate-pulse" />
              </div>
            )}
            {/* Placeholder de cámara */}
            {!scanning && !starting && !error && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                <Camera className="h-10 w-10 text-slate-600 animate-pulse" />
              </div>
            )}

            {/* Error de cámara */}
            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900 p-6 text-center">
                <AlertCircle className="h-10 w-10 text-red-400" />
                <p className="text-sm text-slate-300">{error}</p>
                <div className="flex flex-col gap-2 w-full mt-1">
                  <button onClick={startScanner}
                    className="w-full h-11 rounded-lg bg-primary text-primary-foreground text-sm font-bold">
                    Reintentar cámara
                  </button>
                  <button onClick={switchToManual}
                    className="w-full h-11 rounded-lg border border-slate-700 text-slate-300 text-sm font-semibold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
                    <Keyboard className="h-4 w-4" /> Ingresar código manualmente
                  </button>
                </div>
              </div>
            )}

            {/* QR no reconocido */}
            {unrecognized && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-900/95 p-6 text-center">
                <AlertCircle className="h-10 w-10 text-amber-400" />
                <p className="text-sm font-medium text-slate-200">Este código QR no corresponde a una OT ni a una ubicación</p>
                <p className="text-xs text-slate-500">Apuntá a otro código o usá el ingreso manual</p>
                <div className="flex gap-2 mt-1">
                  <button onClick={() => { setUnrecognized(false); stopRef.current = false; }}
                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold">
                    Reintentar
                  </button>
                  <button onClick={switchToManual}
                    className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 text-xs font-semibold">
                    Manual
                  </button>
                  <button onClick={() => onCloseRef.current()}
                    className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 text-xs font-semibold">
                    Cerrar
                  </button>
                </div>
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
        )}

        {/* Footer */}
        <div className="px-4 py-3 text-center shrink-0">
          {manualMode ? (
            <button onClick={() => { setManualMode(false); setManualValue(''); setManualError(false); setTimeout(startScanner, 100); }}
              className="text-xs text-primary hover:underline">
              Usar cámara
            </button>
          ) : (
            <div className="flex items-center justify-center gap-3">
              <p className="text-xs text-slate-400">
                {scanFlash ? '¡Código detectado!' : 'Apuntá la cámara al código QR'}
              </p>
              {!error && (
                <button onClick={switchToManual} className="text-xs text-primary hover:underline flex items-center gap-1">
                  <Keyboard className="h-3 w-3" /> Manual
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  , document.body);
}

/**
 * Parser robusto del contenido del QR.
 * Soporta URLs completas, URLs relativas, y IDs crudos.
 * Extrae parámetros `loc`, `ubicacion`, `asset` y `ot` con regex fallback.
 */
function parseQRContent(decodedText) {
  const text = (decodedText || '').trim();

  // Probar URL absoluta y, si falla, relativa. ubicacion == alias de loc.
  const tryUrl = (urlStr, base) => {
    try {
      const url = base ? new URL(urlStr, base) : new URL(urlStr);
      const loc = url.searchParams.get('loc') || url.searchParams.get('ubicacion');
      const asset = url.searchParams.get('asset');
      const ot  = url.searchParams.get('ot');
      if (loc) return { type: 'loc', value: loc, raw: text };
      if (asset) return { type: 'asset', value: asset, raw: text };
      if (ot)  return { type: 'ot',  value: ot,  raw: text };
      // Tiene params pero no son loc/ot/ubicacion/asset → QR no reconocido (ej. ?id=)
      if ([...url.searchParams.keys()].length > 0) return { type: 'unknown', raw: text };
      return null; // URL sin params → seguir
    } catch { return null; }
  };
  const abs = tryUrl(text);            if (abs) return abs;
  const rel = tryUrl(text, window.location.origin); if (rel) return rel;

  // Regex fallback: ?loc= / ?ubicacion= / ?ot= / ?asset=
  const locMatch = text.match(/[?&](?:loc|ubicacion)=([^&\s]+)/);
  if (locMatch) return { type: 'loc', value: locMatch[1], raw: text };

  const assetMatch = text.match(/[?&]asset=([^&\s]+)/);
  if (assetMatch) return { type: 'asset', value: assetMatch[1], raw: text };

  const otMatch = text.match(/[?&]ot=([^&\s]+)/);
  if (otMatch) return { type: 'ot', value: otMatch[1], raw: text };

  // Query con otros params (?id=, etc.) → no reconocido
  if (/[?&][a-z_]+=/i.test(text)) return { type: 'unknown', raw: text };

  // Último recurso: texto crudo (puede ser un ID de OT)
  return { type: 'raw', value: text, raw: text };
}