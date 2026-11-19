/**
 * modoOperario — piezas compartidas del "Modo operario (beta)".
 * Todo es aditivo: con modo_operario apagado nada de esto se usa.
 */

export function isModoOperario(user) {
  return user?.modo_operario === true || user?.data?.modo_operario === true;
}

// Evento que abre el escáner QR del portal del operario (PortalOperarioApp lo escucha).
export const EVENTO_ESCANEAR_OPERARIO = 'dh1:operario-escanear';

export function abrirEscanerOperario() {
  window.dispatchEvent(new CustomEvent(EVENTO_ESCANEAR_OPERARIO));
}

// "Fichar" de la barra inferior: abre el escáner de la tarjeta de Fichaje.
export const EVENTO_FICHAR_OPERARIO = 'dh1:operario-fichar';
export function abrirFicharOperario() {
  window.dispatchEvent(new CustomEvent(EVENTO_FICHAR_OPERARIO));
}

// Abrir una OT del operario desde otra sección del Inicio (ej. una propuesta aprobada).
export const EVENTO_ABRIR_OT_OPERARIO = 'dh1:operario-abrir-ot';
export function abrirOTOperario(otId) {
  window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_OT_OPERARIO, { detail: { otId } }));
}

// QR de fichaje: lleva al fichaje actual (portal público en dh1m.com).
export function irAFichajePublico(locId) {
  window.location.href = `https://dh1m.com/fichar-ubicacion?loc=${encodeURIComponent(locId)}`;
}