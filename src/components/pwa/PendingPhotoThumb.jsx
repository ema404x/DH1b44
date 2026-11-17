import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { getBlob } from '@/lib/offlineStore';

/** Miniatura de una foto guardada en el dispositivo que todavía no se subió. */
export default function PendingPhotoThumb({ blob, blobId, className = '', onRemove, label = true }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let alive = true;
    let objectUrl = null;
    (async () => {
      const source = blob || (blobId ? (await getBlob(blobId))?.blob : null);
      if (!alive || !source) return;
      objectUrl = URL.createObjectURL(source);
      setUrl(objectUrl);
    })();
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [blob, blobId]);

  return (
    <div className={`relative overflow-hidden bg-muted ${className}`}>
      {url && <img src={url} alt="Foto pendiente de subir" className="w-full h-full object-cover" />}
      {label && (
        <span className="absolute bottom-0 inset-x-0 bg-amber-500/95 text-white text-[9px] font-semibold text-center leading-tight py-0.5">
          Pendiente de subir
        </span>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}