import React from 'react';

export default function FirmaCard({ url, nombre, cargo, fecha }) {
  return (
    <div className="flex flex-col rounded-xl border border-border overflow-hidden bg-card shadow-sm">
      <div className="bg-muted/30 flex items-center justify-center px-4 py-3" style={{ minHeight: 88 }}>
        <img src={url} alt={`Firma ${nombre || ''}`} className="max-h-16 max-w-full object-contain" />
      </div>
      <div className="border-t border-border px-3 py-2.5 text-center bg-background">
        <p className="text-xs font-bold text-foreground leading-tight">{nombre || 'Firmante'}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{cargo}</p>
        {fecha && (
          <p className="text-[10px] text-blue-500 font-semibold mt-1">{new Date(fecha).toLocaleDateString('es-AR')}</p>
        )}
      </div>
    </div>
  );
}