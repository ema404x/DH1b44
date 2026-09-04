/**
 * operarioAuth.ts — Single source of truth para la validación de la clave
 * de operario compartida en el portal público.
 *
 * Usado por:
 *  - publicFichar (verifyOperarioPassword, updateWorkOrder)
 *  - transicionEstadoOT (modo portal, auth_mode='portal')
 *
 * Extraerlo acá evita duplicar la lógica de hash+salt+fallback entre las dos
 * funciones backend y garantiza que un cambio de criterio se aplique a ambos
 * caminos (módulo autenticado y portal público) simultáneamente.
 */

const OPERARIO_SALT = 'b44-operario-salt-v1';

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifica la clave de operario contra el hash en SecurityConfig (editable
 * desde el Centro de Seguridad). Si no hay hash en DB, cae al secreto de
 * plataforma OPERARIO_PASSWORD (migración no-ruptura).
 * Devuelve { valid, configured }.
 */
export async function verificarClaveOperario(
  base44: any,
  password: string,
): Promise<{ valid: boolean; configured: boolean }> {
  if (!password) return { valid: false, configured: false };
  const cfg = await base44.asServiceRole.entities.SecurityConfig.list().catch(() => []);
  const dbHash = cfg[0]?.operario_password_hash;
  const env = Deno.env.get('OPERARIO_PASSWORD');
  if (!dbHash && !env) return { valid: false, configured: false };
  const valid = dbHash ? (await sha256Hex(password + OPERARIO_SALT)) === dbHash : password === env;
  return { valid, configured: true };
}