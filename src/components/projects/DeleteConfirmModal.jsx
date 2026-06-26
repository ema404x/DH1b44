import React from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DeleteSelectedModal({ count, deleting, progress, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={() => !deleting && onCancel()} />
      <div className="relative bg-slate-900 border border-red-500/30 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-full bg-red-500/20 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <h3 className="font-bold text-white">Eliminar {count} obras</h3>
            <p className="text-xs text-slate-400">Esta acción no se puede deshacer</p>
          </div>
        </div>
        {deleting && <ProgressBar progress={progress} label="Eliminando..." />}
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={deleting}>Cancelar</Button>
          <Button variant="destructive" size="sm" onClick={onConfirm} disabled={deleting} className="gap-1.5">
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            {deleting ? `Eliminando... ${progress}%` : `Eliminar ${count}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DeleteAllModal({ total, deleting, progress, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80" onClick={() => !deleting && onCancel()} />
      <div className="relative bg-slate-900 border border-red-500/50 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-full bg-red-500/20 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <h3 className="font-bold text-white">Eliminar TODAS las obras</h3>
            <p className="text-xs text-slate-400">Se borrarán <span className="text-red-400 font-semibold">{total.toLocaleString()} obras</span> — sin excepción</p>
          </div>
        </div>
        <p className="text-xs text-slate-500 mb-4 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          ⚠️ Esta acción es irreversible. Todos los registros serán eliminados permanentemente.
        </p>
        {deleting && <ProgressBar progress={progress} label="Eliminando en lotes..." note="No cierres esta ventana" />}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={deleting}>Cancelar</Button>
          <Button variant="destructive" size="sm" onClick={onConfirm} disabled={deleting} className="gap-1.5">
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            {deleting ? `${progress}% completado` : `Sí, eliminar todo (${total})`}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ progress, label, note }) {
  return (
    <div className="mb-4">
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span>{label}</span><span>{progress}%</span>
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className="h-full bg-red-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>
      {note && <p className="text-xs text-slate-500 mt-1 text-center">{note}</p>}
    </div>
  );
}