import { useCallback, useEffect, useRef, useState } from 'react';

// Abre la cámara (trasera por defecto) mientras `open` es true y la libera
// siempre: al cerrar, al cambiar de cámara y al desmontar.
export default function useCamaraStream(open) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [deviceId, setDeviceId] = useState(null);
  const [camaras, setCamaras] = useState([]);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState(null);

  const detener = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    if (!open) { setDeviceId(null); return undefined; }
    let cancelado = false;
    setListo(false);
    setError(null);
    const video = deviceId
      ? { deviceId: { exact: deviceId } }
      : { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } };
    navigator.mediaDevices.getUserMedia({ video, audio: false })
      .then(async (stream) => {
        if (cancelado) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        if (cancelado) return;
        setListo(true);
        const devs = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        if (!cancelado) setCamaras(devs.filter((d) => d.kind === 'videoinput'));
      })
      .catch(() => { if (!cancelado) setError('No se pudo abrir la cámara. Revisá el permiso de cámara de la app.'); });
    return () => { cancelado = true; detener(); };
  }, [open, deviceId, detener]);

  const cambiarCamara = useCallback(() => {
    if (camaras.length < 2) return;
    const actual = streamRef.current?.getVideoTracks()[0]?.getSettings?.().deviceId;
    const i = camaras.findIndex((c) => c.deviceId === actual);
    setDeviceId(camaras[(i + 1) % camaras.length].deviceId);
  }, [camaras]);

  return { videoRef, listo, error, hayVarias: camaras.length > 1, cambiarCamara, detener };
}