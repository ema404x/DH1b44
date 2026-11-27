// Entrega un archivo ya generado al usuario.
// Debe llamarse desde un toque/click directo: en el celular (sobre todo iOS y
// la app instalada como PWA) el navegador bloquea descargas o el menú de
// compartir si se disparan solos después de una espera larga.

/** true en pantallas táctiles chicas (celular / tablet). */
export function esDispositivoMovil() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(max-width: 1023px)').matches || window.matchMedia('(pointer: coarse)').matches;
}

export default async function guardarArchivo(blob, name) {
  // 1) Celular: menú nativo de compartir (Guardar en Archivos, WhatsApp, Drive...).
  if (esDispositivoMovil() && typeof File !== 'undefined' && navigator.canShare) {
    const file = new File([blob], name, { type: blob.type || 'application/octet-stream' });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: name });
        return 'compartido';
      } catch (e) {
        if (e?.name === 'AbortError') return 'cancelado';
        // Otro error (p. ej. permiso): seguir con la descarga clásica.
      }
    }
  }

  // 2) Descarga clásica.
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return 'descargado';
}
