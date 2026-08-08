import { base44 } from '@/api/base44Client';

// Clave de operario compartida (secreto OPERARIO_PASSWORD).
// Se guarda en sessionStorage tras validarse, para reenviarla en cada
// acción mutadora del endpoint público (updateWorkOrder).
const CLAVE_KEY = 'operario_clave';

export function getClave() {
  try { return sessionStorage.getItem(CLAVE_KEY) || ''; } catch { return ''; }
}

export function setClave(pw) {
  try { sessionStorage.setItem(CLAVE_KEY, pw || ''); } catch {}
}

export function clearClave() {
  try { sessionStorage.removeItem(CLAVE_KEY); } catch {}
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