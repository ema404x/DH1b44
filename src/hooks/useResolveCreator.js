/**
 * useResolveCreator
 *
 * Resuelve el nombre del usuario que creó un registro a partir de su created_by_id.
 * Usa el cache de Employee (que tiene user_id → full_name) para evitar queries extra.
 *
 * Uso:
 *   const { resolveCreator } = useResolveCreator();
 *   resolveCreator(order.created_by_id)  // → 'Juan Pérez'
 */
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

// Cache compartido a nivel módulo — se reutiliza entre componentes sin duplicar queries
let _creatorMap = null;

export function useResolveCreator() {
  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list('-updated_date', 200),
    staleTime: 120000,
  });

  // Construir mapa user_id → full_name
  const userMap = {};
  employees.forEach(e => {
    if (e.user_id) userMap[e.user_id] = e.full_name;
  });
  _creatorMap = userMap;

  const resolveCreator = (createdById, fallback = 'Sistema') => {
    if (!createdById) return fallback;
    return userMap[createdById] || fallback;
  };

  return { resolveCreator, employees };
}