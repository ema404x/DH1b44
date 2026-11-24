import React, { useRef, useState } from 'react';
import CamaraInput from '@/components/camara/CamaraInput';
import { ES_WEBVIEW_ANDROID } from '@/lib/camaraDH1';
import { base44 } from '@/api/base44Client';
import { compressImage } from '@/lib/compressImage';
import { toast } from 'sonner';
import { Camera, Image, X, Loader2, ZoomIn } from 'lucide-react';
import { useOfflineMode } from '@/hooks/useOfflineMode';
import { useOfflineEnabled, useOfflineOps } from '@/hooks/useOfflineOps';
import { enqueuePhoto } from '@/lib/offlineSyncEngine';
import { prepareOfflinePhoto } from '@/lib/offlinePhotos';
import PendingPhotoThumb from '@/components/pwa/PendingPhotoThumb';

export default function WorkOrderPhotos({ photos = [], onChange, otId, otTitle }) {
  const fileRef = useRef();
  const cameraRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(null); // url
  const offlineMode = useOfflineMode();
  const offlineEnabled = useOfflineEnabled();
  // Fotos de esta OT guardadas en el dispositivo que todavía no se subieron.
  const { ops } = useOfflineOps(offlineEnabled && !!otId);
  const pending = ops.filter((o) => o.kind === 'photo' && o.target === 'photos' && o.ot_id === otId);

  const resetInputs = () => {
    if (cameraRef.current) cameraRef.current.value = '';
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFiles = async (files) => {
    const selectedFiles = Array.from(files || []);
    if (!selectedFiles.length) return;
    // Modo sin conexión: comprimir, guardar en el dispositivo y subir al volver la señal.
    if (offlineMode) {
      if (!otId || String(otId).startsWith('offline')) {
        toast.info('Necesita conexión');
        resetInputs();
        return;
      }
      setUploading(true);
      try {
        for (const file of selectedFiles) {
          const prepared = await prepareOfflinePhoto(file);
          if (!prepared) break;
          await enqueuePhoto({ ot_id: otId, ot_title: otTitle, target: 'photos', base_photos: photos, ...prepared });
        }
      } catch (err) {
        toast.error(err?.message || 'No se pudo guardar la foto en el dispositivo');
      } finally {
        setUploading(false);
        resetInputs();
      }
      return;
    }
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of selectedFiles) {
        try {
          const compressed = await compressImage(file);
          const res = await base44.integrations.Core.UploadPublicFile({ file: compressed });
          const uploadedUrl = res?.file_url;
          if (!uploadedUrl) {
            throw new Error('No se recibió la URL de la imagen subida');
          }
          uploaded.push(uploadedUrl);
        } catch (err) {
          console.error('Error subiendo archivo:', file?.name, err);
          toast.error(err?.message || `Error subiendo ${file?.name || 'la imagen'}`);
        }
      }
      if (uploaded.length) {
        onChange([...photos, ...uploaded]);
      }
    } finally {
      setUploading(false);
      // Reset inputs para poder seleccionar la misma foto nuevamente
      if (cameraRef.current) cameraRef.current.value = '';
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removePhoto = (idx) => {
    if (offlineMode) { toast.info('Necesita conexión'); return; }
    onChange(photos.filter((_, i) => i !== idx));
  };

  return (
    <>
      <div className="space-y-3">
        {/* Grid of photos */}
        {(photos.length > 0 || pending.length > 0) && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {photos.map((url, idx) => (
              <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-slate-700/50 bg-slate-800/40">
                <img src={url} alt="" className="w-full h-full object-cover" />
                {/* Overlay buttons */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={() => setLightbox(url)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 backdrop-blur text-white hover:bg-white/30 transition-colors"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => removePhoto(idx)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-red-600/80 backdrop-blur text-white hover:bg-red-600 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {/* Mobile: always visible delete */}
                <button
                  onClick={() => removePhoto(idx)}
                  className="absolute top-1.5 right-1.5 sm:hidden w-6 h-6 flex items-center justify-center rounded-full bg-black/60 text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {pending.map((op) => (
              <PendingPhotoThumb key={op.id} blobId={op.blob_id} className="aspect-square rounded-xl border border-slate-700/50" />
            ))}
          </div>
        )}

        {/* Botones cámara / galería */}
        <div className={`grid ${ES_WEBVIEW_ANDROID ? 'grid-cols-1' : 'grid-cols-2'} gap-2`}>
          <button
            onClick={() => cameraRef.current?.click()}
            disabled={uploading}
            className="flex flex-col items-center justify-center gap-1.5 h-14 rounded-xl border-2 border-dashed border-indigo-500/40 text-indigo-400 bg-indigo-500/5 hover:bg-indigo-500/10 active:bg-indigo-500/20 transition-all disabled:opacity-40 font-medium"
          >
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
            <span className="text-xs">Cámara</span>
          </button>
          {!ES_WEBVIEW_ANDROID && <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex flex-col items-center justify-center gap-1.5 h-14 rounded-xl border-2 border-dashed border-slate-600/60 text-slate-400 hover:border-slate-500 hover:text-slate-300 active:bg-slate-800/40 transition-all disabled:opacity-40"
          >
            <Image className="h-5 w-5" />
            <span className="text-xs">Galería</span>
          </button>}
        </div>

        {uploading && (
          <p className="text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" /> Subiendo fotos...
          </p>
        )}

        {photos.length > 0 && !uploading && (
          <p className="text-center text-[10px] text-slate-600">{photos.length} foto{photos.length !== 1 ? 's' : ''}</p>
        )}

        <CamaraInput ref={cameraRef} accept="image/*" capture="environment" className="hidden"
          onChange={e => handleFiles(e.target.files)} />
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
          onChange={e => handleFiles(e.target.files)} />
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-xl object-contain shadow-2xl" />
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </>
  );
}