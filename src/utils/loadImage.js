// Carga robusta de imágenes como base64 para jsPDF y canvas.
//
// PROBLEMA: las URLs devueltas por UploadPublicFile tienen formato
// https://base44.app/api/apps/.../files/... que REDIRIGE al CDN
// media.base44.com. El fetch directo puede fallar silenciosamente en el
// browser por CORS en la redirección, dejando firmas/fotos fuera del PDF
// sin ningún error visible.
//
// SOLUCIÓN: doble estrategia — fetch → Image+canvas. Si fetch falla (CORS,
// redirect, timeout), cae a <img crossOrigin="anonymous"> + canvas que el
// navegador maneja nativamente con redirecciones y CORS del response final.

export async function loadImageAsBase64(url) {
  if (!url) return null;

  // Estrategia 1: fetch → blob → FileReader (rápido, funciona con CORS ok)
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (res.ok) {
      const blob = await res.blob();
      if (blob.size > 0 && blob.type.startsWith('image/')) {
        const dataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
        if (dataUrl) return dataUrl;
      }
    }
  } catch (_) { /* fallar al siguiente approach */ }

  // Estrategia 2: <img crossOrigin="anonymous"> → canvas → toDataURL
  // El browser maneja redirects y CORS del response final nativamente.
  try {
    return await new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 400;
          canvas.height = img.naturalHeight || 160;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/png'));
        } catch (_) {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now();
    });
  } catch (_) {
    return null;
  }
}