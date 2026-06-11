import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Camera, Image, X, Loader2, ZoomIn } from 'lucide-react';

export default function WorkOrderPhotos({ photos = [], onChange }) {
  const fileRef = useRef();
  const cameraRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(null); // url

  const handleFiles = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    const uploaded = [];
    for (const file of Array.from(files)) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      uploaded.push(file_url);
    }
    onChange([...photos, ...uploaded]);
    setUploading(false);
  };

  const removePhoto = (idx) => {
    onChange(photos.filter((_, i) => i !== idx));
  };

  return (
    <>
      <div className="space-y-3">
        {/* Grid of photos */}
        {photos.length > 0 && (
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

          </div>
        )}

        {/* Botones cámara / galería */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => cameraRef.current?.click()}
            disabled={uploading}
            className="flex flex-col items-center justify-center gap-1.5 h-14 rounded-xl border-2 border-dashed border-indigo-500/40 text-indigo-400 bg-indigo-500/5 hover:bg-indigo-500/10 active:bg-indigo-500/20 transition-all disabled:opacity-40 font-medium"
          >
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
            <span className="text-xs">Cámara</span>
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex flex-col items-center justify-center gap-1.5 h-14 rounded-xl border-2 border-dashed border-slate-600/60 text-slate-400 hover:border-slate-500 hover:text-slate-300 active:bg-slate-800/40 transition-all disabled:opacity-40"
          >
            <Image className="h-5 w-5" />
            <span className="text-xs">Galería</span>
          </button>
        </div>

        {uploading && (
          <p className="text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" /> Subiendo fotos...
          </p>
        )}

        {photos.length > 0 && !uploading && (
          <p className="text-center text-[10px] text-slate-600">{photos.length} foto{photos.length !== 1 ? 's' : ''}</p>
        )}

        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
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