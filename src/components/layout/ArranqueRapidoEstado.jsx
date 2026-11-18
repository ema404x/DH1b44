import React from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

// Indicador solo para administradores: resultado de comparar el Arranque
// rápido contra el arranque de siempre.
export default function ArranqueRapidoEstado({ verificacion, onVer }) {
  if (!verificacion) return null;

  if (verificacion.estado === 'ok') {
    return (
      <p className="flex items-center gap-1.5 px-3 pb-2 text-[11px] text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" /> Arranque rápido verificado ✓
      </p>
    );
  }

  const n = verificacion.diferencias.length;
  return (
    <button
      onClick={onVer}
      className="flex items-center gap-1.5 px-3 pb-2 text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition-colors"
    >
      <AlertTriangle className="h-3.5 w-3.5" /> Arranque rápido: {n} diferencia{n !== 1 ? 's' : ''}
    </button>
  );
}