import { createPortal } from 'react-dom';

/**
 * Porta el contenido a document.body, escapando de cualquier ancestro con
 * `transform` (ej. el motion.div de framer-motion en AppLayout). Sin esto, un
 * `position: fixed` dentro de un ancestro transformado se posiciona relativo a
 * ese ancestro (no al viewport) y el modal puede quedar fuera de pantalla —
 * síntoma "se sale todo y ya" al abrir un diálogo sobre una página scrolleable.
 */
export default function BodyPortal({ children }) {
  if (typeof document === 'undefined') return children;
  return createPortal(children, document.body);
}