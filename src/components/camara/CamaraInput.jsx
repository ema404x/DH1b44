import React, { useRef, useState } from 'react';
import CamaraDH1 from './CamaraDH1';
import { usarCamaraEnPagina } from '@/lib/camaraDH1';

/**
 * Reemplazo directo de <input type="file" capture>. Mismas props y mismo ref.
 * En celular/app abre la cámara dentro de la página y entrega la foto al MISMO
 * onChange de siempre ({ target: { files: [File] } }), así entra por el mismo
 * camino (compresión, límites, cola sin conexión). Si la cámara no está
 * disponible, usa el input de siempre.
 */
const CamaraInput = React.forwardRef(function CamaraInput({ onChange, onClick, ...props }, ref) {
  const inputRef = useRef(null);
  const saltarRef = useRef(false);
  const [abierta, setAbierta] = useState(false);

  const setRefs = (el) => {
    inputRef.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  };

  const handleClick = (e) => {
    onClick?.(e);
    if (saltarRef.current) { saltarRef.current = false; return; }
    if (e.defaultPrevented || !usarCamaraEnPagina()) return;
    e.preventDefault();
    setAbierta(true);
  };

  const handleCapture = (file) => {
    setAbierta(false);
    const target = { files: [file], value: '' };
    onChange?.({ target, currentTarget: target, preventDefault() {}, stopPropagation() {} });
  };

  const handleFallback = () => {
    setAbierta(false);
    saltarRef.current = true;
    inputRef.current?.click();
  };

  return (
    <>
      <input ref={setRefs} type="file" {...props} onClick={handleClick} onChange={onChange} />
      <CamaraDH1 open={abierta} onClose={() => setAbierta(false)} onCapture={handleCapture} onFallback={handleFallback} />
    </>
  );
});

export default CamaraInput;