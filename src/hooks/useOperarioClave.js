import { useState, useCallback, useRef } from 'react';
import { getClave, setClave } from '@/lib/operarioClave';

/**
 * Garantiza que haya una clave de operario válida antes de ejecutar una
 * acción mutadora pública (updateWorkOrder). Si ya hay clave en sesión,
 * ejecuta la acción inmediatamente; si no, abre el prompt de clave y la
 * ejecuta recién al validarse.
 *
 * Uso:
 *   const { promptOpen, requireClave, onPromptSuccess, onPromptClose } = useOperarioClave();
 *   requireClave((clave) => { ...llamar updateWorkOrder con password: clave... });
 *   {promptOpen && <OperarioClavePrompt onSuccess={onPromptSuccess} onClose={onPromptClose} />}
 */
export function useOperarioClave() {
  const [promptOpen, setPromptOpen] = useState(false);
  const pending = useRef(null); // (clave) => void

  const requireClave = useCallback((action) => {
    const cached = getClave();
    if (cached) { action(cached); return; }
    pending.current = action;
    setPromptOpen(true);
  }, []);

  const onPromptSuccess = useCallback((pw) => {
    setClave(pw);
    setPromptOpen(false);
    const fn = pending.current;
    pending.current = null;
    if (fn) fn(pw);
  }, []);

  const onPromptClose = useCallback(() => {
    setPromptOpen(false);
    pending.current = null;
  }, []);

  return { promptOpen, requireClave, onPromptSuccess, onPromptClose };
}