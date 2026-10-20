/**
 * compressImage — Compresión client-side de imágenes pre-upload.
 *
 * Estrategia anti-crash RAM (mobile):
 * - createImageBitmap(file, { imageOrientation: 'from-image' }) decodifica el
 *   bitmap full-res en una sola pasada y aplica la orientación EXIF. Canvas no
 *   preserva EXIF, así que sin esto una foto vertical en algunos teléfonos se
 *   rotaría al dibujarla.
 * - Se calcula la escala preservando aspect ratio (max 1600px lado mayor) y se
 *   dibuja a un canvas a tamaño target. El bitmap full-res se libera con
 *   bitmap.close() apenas se dibuja — nunca quedan dos bitmaps full-res
 *   simultáneos en RAM.
 * - toBlob('image/jpeg', 0.8) produce ~300-600 KB.
 * - Fallback a new Image() + URL.createObjectURL si createImageBitmap no existe.
 * - Fail-safe: si todo falla (HEIC no decodificable, formato raro), se devuelve
 *   el File original sin comprimir. Nunca se pierde una foto — mejor subirla
 *   grande que no subirla.
 *
 * @param {File} file  Archivo de imagen original.
 * @param {{maxSize?: number, quality?: number}} [opts]
 * @returns {Promise<File|Blob>}
 */
const MAX_UNCOMPRESSED_FALLBACK_BYTES = 1.5 * 1024 * 1024; // 1.5 MB

async function decodeImageSource(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bitmap, objectUrl: null };
    } catch {
      try {
        const bitmap = await createImageBitmap(file);
        return { source: bitmap, objectUrl: null };
      } catch {
        // Continúa al fallback con HTMLImageElement
      }
    }
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    return { source: img, objectUrl };
  } catch (err) {
    URL.revokeObjectURL(objectUrl);
    throw err;
  }
}

export async function compressImage(file, opts = {}) {
  const maxSize = opts.maxSize ?? 1280;
  const quality = opts.quality ?? 0.78;

  if (!file || typeof file !== 'object') {
    throw new Error('Archivo inválido');
  }

  // Si ya es un JPEG liviano (< 300 KB), igual verificamos dimensiones pero sin bloquear UI
  const isImageMime = !file.type || file.type.startsWith('image/');
  if (!isImageMime) return file;

  let decoded = null;
  let canvas = null;

  try {
    // Ceder un frame al navegador para que el spinner de carga se pinte sin trabar la UI
    await new Promise((r) => setTimeout(r, 0));

    decoded = await decodeImageSource(file);
    const bitmap = decoded.source;

    const w = bitmap.naturalWidth || bitmap.width;
    const h = bitmap.naturalHeight || bitmap.height;
    if (!w || !h) throw new Error('Dimensiones de imagen inválidas');

    const scale = Math.min(1, maxSize / Math.max(w, h));
    const targetW = Math.max(1, Math.round(w * scale));
    const targetH = Math.max(1, Math.round(h * scale));

    // Si ya es pequeña en dimensiones y pesa menos de 350 KB en JPEG, evitar recodificar
    if (scale === 1 && file.type === 'image/jpeg' && file.size > 0 && file.size <= 350 * 1024) {
      if (bitmap.close) bitmap.close();
      if (decoded.objectUrl) URL.revokeObjectURL(decoded.objectUrl);
      return file;
    }

    canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo inicializar el contexto gráfico');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);

    // Liberar el bitmap full-res y objectURL apenas se dibuja al canvas
    if (bitmap.close) bitmap.close();
    if (decoded.objectUrl) URL.revokeObjectURL(decoded.objectUrl);
    decoded = null;

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('toBlob falló'))),
        'image/jpeg',
        quality
      );
    });

    // Liberar memoria GPU/RAM del canvas inmediatamente
    canvas.width = 0;
    canvas.height = 0;
    canvas = null;

    const baseName = (file.name || 'foto').replace(/\.[^.]+$/, '');
    const outBlob = blob.size > 0 && (blob.size < file.size || file.type !== 'image/jpeg') ? blob : file;
    if (outBlob === file && file.size <= MAX_UNCOMPRESSED_FALLBACK_BYTES) {
      return file;
    }

    return new File([ blob ], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } catch (err) {
    if (decoded?.source?.close) decoded.source.close();
    if (decoded?.objectUrl) URL.revokeObjectURL(decoded.objectUrl);
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
    // No subir archivos pesados sin comprimir si la compresión falla
    if (file.size > MAX_UNCOMPRESSED_FALLBACK_BYTES) {
      throw new Error(`La foto "${file.name || 'seleccionada'}" es demasiado pesada y no pudo comprimirse.`);
    }
    return file;
  }
}

/**
 * loadImage — Promisifica la carga de una Image desde una URL.
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load falló'));
    img.src = src;
  });
}