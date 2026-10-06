import React from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';

// Diálogo propio de confirmación para cancelar una OT.
// Reemplaza al window.confirm del navegador — mantiene el look&feel de DH1.
// Usado tanto desde el panel de detalle como desde el arrastre del Kanban.
export default function CancelarOTModal({ open, onClose, onConfirm, loading, otTitle }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-slate-900 border border-red-500/30 rounded-2xl shadow-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Cancelar orden de trabajo</h3>
            <p className="text-[11px] text-slate-400">Esta acción no se puede deshacer</p>
          </div>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed mb-1">
          ¿Estás seguro de que querés cancelar esta OT?
        </p>
        {otTitle && (
          <p className="text-xs text-slate-500 leading-snug line-clamp-2 mb-4">
            «{otTitle}»
          </p>
        )}
        <div className="flex gap-2 mt-4">
          <button onClick={onClose}
            className="flex-1 h-10 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-700 transition-colors">
            No, volver
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 h-10 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Sí, cancelar OT
          </button>
        </div>
      </div>
    </div>
  );
}