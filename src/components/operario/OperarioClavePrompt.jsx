import React, { useState } from 'react';
import { Loader2, Lock, AlertTriangle } from 'lucide-react';
import { validateClave } from '@/lib/operarioClave';

/**
 * Modal que pide y valida la clave de operario compartida antes de permitir
 * acciones mutadoras en el endpoint público. Al validarse, cachea la clave
 * en sessionStorage (vía el hook caller) y llama onSuccess(password).
 */
export default function OperarioClavePrompt({ onSuccess, onClose }) {
  const [clave, setClave] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!clave.trim()) return;
    setChecking(true);
    setError('');
    const ok = await validateClave(clave.trim());
    setChecking(false);
    if (ok) {
      onSuccess(clave.trim());
    } else {
      setError('Clave incorrecta. Consultá con tu supervisor.');
      setClave('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-5">
      <div className="bg-white rounded-3xl p-7 w-full max-w-sm shadow-2xl">
        <div className="text-center mb-6">
          <div className="h-14 w-14 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Lock className="h-7 w-7 text-white" />
          </div>
          <h2 className="font-bold text-xl text-slate-800">Clave de operario</h2>
          <p className="text-slate-500 text-sm mt-1">Ingresá la clave para registrar el trabajo.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={clave}
            onChange={e => setClave(e.target.value)}
            placeholder="••••••••"
            autoFocus
            className="w-full h-14 rounded-2xl border-2 border-slate-200 px-4 text-xl font-bold text-center tracking-widest focus:outline-none focus:border-slate-500 transition-colors"
          />
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-xl px-4 py-3">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}
          <div className="flex gap-2">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-12 rounded-2xl bg-slate-100 text-slate-600 font-bold text-base active:scale-[0.98] transition-all"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={checking || !clave.trim()}
              className="flex-1 h-12 rounded-2xl bg-slate-800 text-white font-bold text-base flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98] transition-all"
            >
              {checking ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}