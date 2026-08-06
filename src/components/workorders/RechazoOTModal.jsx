import React, { useState, useEffect } from 'react';
import { Loader2, MessageSquareWarning } from 'lucide-react';

// Modal limpio para rechazar una OT y devolverla al operario.
// Reemplaza al prompt() del navegador: exige un motivo visible para el operario.
export default function RechazoOTModal({ open, onClose, onConfirm, loading }) {
  const [comentario, setComentario] = useState('');

  useEffect(() => {
    if (open) setComentario('');
  }, [open]);

  if (!open) return null;

  const handleConfirm = () => {
    if (!comentario.trim()) return;
    onConfirm(comentario);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-slate-900 border border-red-500/30 rounded-2xl shadow-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-9 w-9 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
            <MessageSquareWarning className="h-4 w-4 text-red-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Rechazar OT y devolver al operario</h3>
            <p className="text-[11px] text-slate-400">El operario verá este motivo al reabrir la OT</p>
          </div>
        </div>
        <textarea
          className="w-full bg-slate-950/60 border border-slate-700/60 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 resize-none focus:outline-none focus:ring-1 focus:ring-red-500/50 min-h-[110px]"
          placeholder="Explicá qué falta o qué hay que corregir…"
          value={comentario}
          autoFocus
          onChange={e => setComentario(e.target.value)}
        />
        <div className="flex gap-2 mt-4">
          <button onClick={onClose}
            className="flex-1 h-10 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-700 transition-colors">
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={!comentario.trim() || loading}
            className="flex-1 h-10 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Rechazar y devolver
          </button>
        </div>
      </div>
    </div>
  );
}