import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Camera, Upload, X, Loader2 } from 'lucide-react';

export default function WorkOrderPhotos({ photos = [], onChange }) {
  const fileRef = useRef();
  const [uploading, setUploading] = useState(false);

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
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Camera className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Fotos ({photos.length})</span>
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((url, idx) => (
            <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-border">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => removePhoto(idx)}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
      <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => fileRef.current?.click()} disabled={uploading}>
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {uploading ? 'Subiendo...' : 'Subir Fotos'}
      </Button>
    </div>
  );
}