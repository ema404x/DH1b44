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
export async function compressImage(file, opts = {}) {
  const maxSize = opts.maxSize ?? 1600;
  const quality = opts.quality ?? 0.8;

  // Si no es imagen, devolver tal cual (fail-safe).
  if (!file.type || !file.type.startsWith('image/')) return file;

  try {
    let bitmap;
    let objectUrl = null;

    if (typeof createImageBitmap === 'function') {
      // from-image aplica la orientación EXIF explícitamente.
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } else {
      // Fallback: Image + objectURL (sin EXIF orientation — mejor que nada).
      objectUrl = URL.createObjectURL(file);
      const img = await loadImage(objectUrl);
      bitmap = img;
    }

    // Calcular escala preservando aspect ratio.
    const w = bitmap.width;
    const h = bitmap.height;
    const scale = Math.min(1, maxSize / Math.max(w, h));
    const targetW = Math.round(w * scale);
    const targetH = Math.round(h * scale);

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);

    // Liberar el bitmap full-res y objectURL apenas se dibuja al canvas.
    if (bitmap.close) bitmap.close();
    if (objectUrl) URL.revokeObjectURL(objectUrl);

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('toBlob falló'))),
        'image/jpeg',
        quality
      );
    });

    // Preservar el nombre del archivo original con extensión .jpg.
    const baseName = (file.name || 'foto').replace(/\.[^.]+$/, '');
    const compressed = new File([blob], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
    return compressed;
  } catch (err) {
    // Fail-safe: devolver el archivo original sin comprimir.
    // Ej: HEIC no decodificable en este navegador.
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