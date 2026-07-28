/**
 * useResolveCreator
 *
 * Resuelve el nombre del usuario que creó un registro a partir de su created_by_id.
 * Estrategia de resolución (robusta, en cascada):
 *   1. Match directo: Employee.user_id === created_by_id → Employee.full_name
 *   2. Match por email: User.email → Employee.email → Employee.full_name
 *   3. Fall back al full_name del usuario de plataforma (User entity)
 *   4. Fall back al valor por defecto ('Sistema')
 *
 * Uso:
 *   const { resolveCreator } = useResolveCreator();
 *   resolveCreator(order.created_by_id)  // → 'Juan Pérez'
 */
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useResolveCreator() {
  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list('-updated_date', 200),
    staleTime: 120000,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list('-created_date', 500),
    staleTime: 120000,
  });

  // Mapa: platform user_id → employee full_name (link directo vía user_id)
  const userMap = {};
  // Mapa: email (lowercased) → employee full_name (fallback por email)
  const emailToName = {};
  employees.forEach(e => {
    if (e.user_id) userMap[e.user_id] = e.full_name;
    if (e.email) emailToName[e.email.toLowerCase().trim()] = e.full_name;
  });

  // Mapa: platform user_id → user email (para cross-reference)
  const userIdToEmail = {};
  // Mapa: platform user_id → user full_name (último recurso)
  const userIdToName = {};
  users.forEach(u => {
    if (u.id) {
      userIdToEmail[u.id] = u.email?.toLowerCase().trim();
      userIdToName[u.id] = u.full_name;
    }
  });

  const resolveCreator = (createdById, fallback = 'Sistema') => {
    if (!createdById) return fallback;
    // 1. Match directo vía Employee.user_id
    if (userMap[createdById]) return userMap[createdById];
    // 2. Match por email: buscar el email del usuario de plataforma, luego matchear con Employee
    const userEmail = userIdToEmail[createdById];
    if (userEmail && emailToName[userEmail]) return emailToName[userEmail];
    // 3. Fall back al full_name del usuario de plataforma
    if (userIdToName[createdById]) return userIdToName[createdById];
    return fallback;
  };

  /**
   * Resuelve el responsable visible de una OT.
   * Si el creador es un usuario real identificado → "Creada por {nombre}".
   * Si la OT fue creada por un proceso automático (sistema) → "Jefe de sitio: {nombre}".
   * Si no hay jefe de sitio → "Responsable: Sin asignar".
   *
   * El nombre del jefe_sitio se resuelve contra la lista de empleados para
   * mostrar el nombre canónico (tal cual figura en el módulo de Empleados).
   */
  const normalize = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  const resolveOTOwner = (order) => {
    const creator = order.created_by_id ? resolveCreator(order.created_by_id, null) : null;
    if (creator) return { name: creator, label: 'Creada por' };
    const jefe = order.jefe_sitio?.trim();
    if (jefe) {
      // Resolver al nombre canónico del empleado (case/accent-insensitive)
      const jefeNorm = normalize(jefe);
      const emp = employees.find(e => normalize(e.full_name) === jefeNorm);
      return { name: emp?.full_name || jefe, label: 'Jefe de sitio' };
    }
    return { name: 'Sin asignar', label: 'Responsable' };
  };

  return { resolveCreator, resolveOTOwner, employees };
}