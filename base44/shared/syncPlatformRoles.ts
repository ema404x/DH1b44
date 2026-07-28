import { shouldSyncToGerente } from "./roles.ts";

/**
 * Sincroniza los roles de plataforma de TODOS los usuarios basándose en su
 * rol de empleado (Employee.role).
 *
 * Esta es la función puente entre el Control de Acceso (RolePermission) y el
 * RLS de las entidades: cuando un admin guarda permisos, se llama esta función
 * para que los usuarios con roles admin-level reciban platform role 'gerente'
 * (que el RLS reconoce y da visibilidad total), y los demás reciban 'user'.
 *
 * Reglas (definidas en shared/roles.ts — única fuente de verdad):
 * - Employee con rol admin-level (gerente, administrativo, gerencia) → 'gerente'
 * - Employee con cualquier otro rol → 'user'
 * - Platform 'admin' → nunca se toca
 * - Usuario sin ficha con rol 'gerente' colgado → se resetea a 'user'
 *
 * @param sb - base44 client con asServiceRole
 * @param existingEmployees? - empleados pre-cargados (evita re-fetch)
 * @param existingUsers? - usuarios pre-cargados (evita re-fetch)
 */
/**
 * Verifica si un rol tiene el permiso admin_view activo en cualquier módulo.
 * Match case-insensitive + sin acentos para tolerar diferencias de formato.
 */
function roleHasAdminViewAnywhere(rolePermsMap, roleName) {
  if (!rolePermsMap || !roleName) return false;
  const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const targetNorm = norm(roleName);
  let perms = rolePermsMap[roleName];
  if (!perms) {
    const key = Object.keys(rolePermsMap).find(k => norm(k) === targetNorm);
    perms = key ? rolePermsMap[key] : null;
  }
  if (!perms) return false;
  return Object.values(perms).some(modulePerms => modulePerms?.admin_view === true);
}

export async function syncAllPlatformRoles(sb, existingEmployees?, existingUsers?, rolePermsMap?) {
  const employees = existingEmployees || await sb.entities.Employee.list('-created_date', 2000);
  const users = existingUsers || await sb.entities.User.list('-created_date', 2000);

  const usersById = {};
  users.forEach(u => { usersById[u.id] = u; });

  const synced_to_gerente = [];
  const synced_to_user = [];
  let already_correct = 0;

  // 1. Sincronizar empleados vinculados a usuarios de plataforma
  for (const emp of employees) {
    if (!emp.user_id) continue;
    const platformUser = usersById[emp.user_id];
    if (!platformUser) continue;

    // Platform admins nunca se tocan
    if (platformUser.role === 'admin') { already_correct++; continue; }

    const shouldBe = (shouldSyncToGerente(emp.role) || roleHasAdminViewAnywhere(rolePermsMap, emp.role)) ? 'gerente' : 'user';

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

  // 2. Resetear usuarios sin ficha que tienen 'gerente' colgado → 'user'
  //    Evita que usuarios desvinculados conserven acceso admin-level
  const employeeUserIds = new Set(employees.filter(e => e.user_id).map(e => e.user_id));
  for (const user of users) {
    if (user.role === 'admin' || user.role === 'user') continue;
    if (employeeUserIds.has(user.id)) continue;
    try {
      await sb.entities.User.update(user.id, { role: 'user' });
      synced_to_user.push({ employee: '(sin ficha)', email: user.email, old: user.role, new: 'user' });
    } catch (err) {
      console.warn(`[syncPlatformRoles] Orphan ${user.email}: ${err.message}`);
    }
  }

  return {
    total_synced: synced_to_gerente.length + synced_to_user.length,
    synced_to_gerente,
    synced_to_user,
    already_correct,
  };
}