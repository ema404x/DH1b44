import { shouldSyncToGerente } from "./roles.ts";

/**
 * Sincroniza el rol de plataforma de los usuarios con ficha de empleado
 * vinculada, con la MISMA regla que vincularEmpleado (shared/roles.ts →
 * shouldSyncToGerente). Única regla en toda la app:
 *
 * - Employee.role en GERENTE_SYNC_ROLES (gerente, gerencia, administrativo,
 *   gerente_general) → 'gerente'
 * - Cualquier otro rol de empleado → 'user'
 * - El "ver todo" (admin_view) de la matriz NO cambia el rol de plataforma:
 *   solo afecta la pantalla de ese módulo.
 * - Platform 'admin' → nunca se toca
 * - Usuarios sin ficha vinculada → no se tocan
 * - Quien ya tiene el rol correcto → no se toca
 *
 * @param sb - base44 client con asServiceRole
 * @param existingEmployees? - empleados pre-cargados (evita re-fetch)
 * @param existingUsers? - usuarios pre-cargados (evita re-fetch)
 */
export async function syncAllPlatformRoles(sb, existingEmployees?, existingUsers?) {
  const employees = existingEmployees || await sb.entities.Employee.list('-created_date', 2000);
  const users = existingUsers || await sb.entities.User.list('-created_date', 2000);

  const usersById = {};
  users.forEach(u => { usersById[u.id] = u; });

  const synced_to_gerente = [];
  const synced_to_user = [];
  let already_correct = 0;

  for (const emp of employees) {
    if (!emp.user_id) continue;
    const platformUser = usersById[emp.user_id];
    if (!platformUser) continue;

    if (platformUser.role === 'admin') { already_correct++; continue; }

    const shouldBe = shouldSyncToGerente(emp.role) ? 'gerente' : 'user';

    if (platformUser.role === shouldBe) { already_correct++; continue; }

    try {
      await sb.entities.User.update(platformUser.id, { role: shouldBe });
      const record = { employee: emp.full_name, employee_role: emp.role, old: platformUser.role, new: shouldBe };
      if (shouldBe === 'gerente') synced_to_gerente.push(record);
      else synced_to_user.push(record);
    } catch (err) {
      console.warn(`[syncPlatformRoles] Error ${emp.full_name}: ${err.message}`);
    }
  }

  return {
    total_synced: synced_to_gerente.length + synced_to_user.length,
    synced_to_gerente,
    synced_to_user,
    already_correct,
  };
}