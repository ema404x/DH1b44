// App Android (WebView de la APK): el user agent incluye "; wv)".
export const ES_WEBVIEW_ANDROID = typeof navigator !== 'undefined' && /; wv\)/.test(navigator.userAgent || '');

// Cámara dentro de la página (getUserMedia) solo en la app o en celulares/tablets.
// En la computadora queda el selector de archivos de siempre.
export function usarCamaraEnPagina() {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return false;
  if (ES_WEBVIEW_ANDROID) return true;
  return typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;
}

export const LADO_MAXIMO_FOTO = 1920;