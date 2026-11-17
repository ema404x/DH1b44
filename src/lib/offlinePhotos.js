import { toast } from 'sonner';
import { compressImage } from '@/lib/compressImage';
import { isStorageLow } from '@/lib/offlineStore';

/**
 * Prepara una foto tomada sin conexión: verifica espacio y la comprime
 * (máx 1600 px, JPEG 0.7). Devuelve { blob, name } o null si no hay espacio.
 */
export async function prepareOfflinePhoto(file) {
  if (await isStorageLow()) {
    toast.warning('Poco espacio: subí las fotos pendientes cuando tengas señal');
    return null;
  }
  const blob = await compressImage(file, { maxSize: 1600, quality: 0.7 });
  return { blob, name: blob.name || file.name || 'foto.jpg' };
}