import React from 'react';
import { X } from 'lucide-react';

// Fotos de la propuesta. Con onRemove se pueden quitar (solo mientras está enviada).
export default function PropuestaFotos({ fotos = [], onRemove }) {
  if (!fotos.length) return <p className="text-xs text-muted-foreground">Sin fotos</p>;
  return (
    <div className="grid grid-cols-3 gap-2">
      {fotos.map((url) => (
        <div key={url} className="relative aspect-square rounded-lg overflow-hidden border border-border bg-muted">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <img src={url} alt="Foto de la propuesta" className="h-full w-full object-cover" loading="lazy" />
          </a>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(url)}
              aria-label="Quitar foto"
              className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}