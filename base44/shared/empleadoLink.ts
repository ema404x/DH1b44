/**
 * Lógica compartida de vinculación de empleados — usada por
 * `revincularEmpleado` y `cambiarEmailEmpleado`.
 *
 * Centraliza dos cosas que ambas funciones necesitan:
 *  1. Resolver el sector canónico del caller (admin) de forma fail-closed.
 *  2. Re-vincular (o auto-invitar) el usuario de plataforma por email +
 *     sincronizar nombre/sector/rol.
 *
 * Importar desde backend:
 *   import { resolveCallerSector, linkOrInvitePlatformUser, isValidEmail }
 *     from "../../shared/empleadoLink.ts";
 */
import { shouldSyncToGerente } from "./roles.ts";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(e?: string | null): boolean {
  return !!e && EMAIL_RE.test(e.trim());
}

/**
 * Resuelve el sector canónico del caller desde su ficha Employee (por email
 * o user_id) o, como backstop, desde user.data.sector_id. Fail-closed: si no
 * hay sector en ningún lado, devuelve null (la función caller debe rechazar).
 */
export async function resolveCallerSector(base44, user): Promise<string | null> {
  const userEmail = (user?.email || '').toLowerCase().trim();
  let callerEmp = null;
  const sb = base44.asServiceRole;
  if (userEmail) {
    const r = await sb.entities.Employee.filter({ email: userEmail }).catch(() => []);
    callerEmp = r?.[0] || null;
  }
  if (!callerEmp && user?.id) {
    const r2 = await sb.entities.Employee.filter({ user_id: user.id }).catch(() => []);
    callerEmp = r2?.[0] || null;
  }
  return callerEmp?.sector_id || user?.data?.sector_id || user?.sector_id || null;
}

/**
 * Re-vincula el usuario de plataforma por email:
 *  - si existe un User con ese email → linkea (emp.user_id) + sincroniza
 *    full_name / sector_id / rol (gerente|user vía shouldSyncToGerente).
 *    Los admins de plataforma no se tocan (mantienen super-rol).
 *  - si no existe → auto-invita el email con el rol mapeado.
 *
 * Los updates se appendan a `tasks` (fire-and-forget) para que la caller
 * los resuelva con Promise.allSettled cuando le convenga.
 */
export async function linkOrInvitePlatformUser(
  sb, base44, emp, newEmail, tasks
): Promise<Record<string, unknown>> {
  const matches = await sb.entities.User.filter({ email: newEmail }).catch(() => []);
  const platformUser = (matches || []).find(
    u => (u.email || '').toLowerCase().trim() === newEmail.toLowerCase().trim()
  ) || null;

  if (platformUser) {
    if (emp.user_id !== platformUser.id) {
      tasks.push(sb.entities.Employee.update(emp.id, { user_id: platformUser.id }).catch(() => {}));
    }
    if (platformUser.role !== 'admin') {
      const u: Record<string, unknown> = {};
      const platName = (platformUser.full_name || '').trim();
      const platformNameIsEmail = EMAIL_RE.test(platName);
      const platformNameDiffers = platName !== (emp.full_name || '').trim();
      if (emp.full_name && (platformNameIsEmail || platformNameDiffers)) {
        u.full_name = emp.full_name;
      }
      const currentSector = platformUser.data?.sector_id ?? null;
      if (emp.sector_id && emp.sector_id !== currentSector) {
        u.sector_id = emp.sector_id;
      }
      const shouldBe = shouldSyncToGerente(emp.role) ? 'gerente' : 'user';
      if ((shouldBe === 'gerente' || shouldBe === 'user') && platformUser.role !== shouldBe) {
        u.role = shouldBe;
      }
      if (Object.keys(u).length > 0) {
        tasks.push(sb.entities.User.update(platformUser.id, u).catch(() => {}));
      }
    }
    return { action: 'linked', user_id: platformUser.id, user_email: platformUser.email };
  }

  // ── No hay usuario de plataforma → auto-invitar ──
  const platformRole = shouldSyncToGerente(emp.role) ? 'gerente' : 'user';
  let invited = false;
  let inviteError: string | null = null;
  try {
    const usersApi = sb?.users?.inviteUser ? sb.users : base44.users;
    if (usersApi?.inviteUser) {
      await usersApi.inviteUser(newEmail, platformRole);
      invited = true;
    } else {
      inviteError = 'inviteUser no disponible en el runtime backend';
    }
  } catch (e) {
    inviteError = e.message || 'Error desconocido al invitar';
  }
  // Limpiar user_id stale solo si la invitación salió (no huérfano sin camino).
  if (invited && emp.user_id) {
    try {
      const old = await sb.entities.User.get(emp.user_id);
      if (!old || (old.email || '').toLowerCase().trim() !== newEmail.toLowerCase().trim()) {
        tasks.push(sb.entities.Employee.update(emp.id, { user_id: null }).catch(() => {}));
      }
    } catch (_) {
      tasks.push(sb.entities.Employee.update(emp.id, { user_id: null }).catch(() => {}));
    }
  }
  return invited
    ? { action: 'invited', email: newEmail, role: platformRole }
    : { action: 'invite_failed', error: inviteError };
}