import { base44 } from '@/api/base44Client';

// Clave de operario compartida (secreto OPERARIO_PASSWORD).
// Se guarda en sessionStorage tras validarse, para reenviarla en cada
// acción mutadora del endpoint público (transicionEstadoOT modo portal).
const CLAVE_KEY = 'operario_clave';
const NOMBRE_KEY = 'operario_nombre';

export function getClave() {
  try { return sessionStorage.getItem(CLAVE_KEY) || ''; } catch { return ''; }
}

export function setClave(pw) {
  try { sessionStorage.setItem(CLAVE_KEY, pw || ''); } catch {}
}

// Nombre manuscrito del operario (ingresado al desbloquear con la clave en el
// portal público). Se estampa en cada OT al "Iniciar" como operario_sesion,
// permitiendo control de propiedad sin login individual.
export function getNombre() {
  try { return sessionStorage.getItem(NOMBRE_KEY) || ''; } catch { return ''; }
}

export function setNombre(nombre) {
  try { sessionStorage.setItem(NOMBRE_KEY, nombre || ''); } catch {}
}

export function clearClave() {
  try { sessionStorage.removeItem(CLAVE_KEY); sessionStorage.removeItem(NOMBRE_KEY); } catch {}
}

// Valida la clave contra el backend (action=verifyOperarioPassword).
export async function validateClave(pw) {
  if (!pw) return false;
  try {
    const res = await base44.functions.invoke('publicFichar', { action: 'verifyOperarioPassword', password: pw });
    return !!res?.data?.valid;
  } catch {
    return false;
  }
}