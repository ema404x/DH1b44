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

  /**
   * Resuelve el responsable visible de una OT.
   * Si el creador es un usuario real identificado en Employee → "Creada por {nombre}".
   * Si la OT fue creada por un proceso automático (sistema) → "Jefe de sitio: {nombre}".
   * Si no hay jefe de sitio → "Responsable: Sin asignar".
   */
  const resolveOTOwner = (order) => {
    const creator = order.created_by_id ? (userMap[order.created_by_id] || null) : null;
    if (creator) return { name: creator, label: 'Creada por' };
    const jefe = order.jefe_sitio?.trim();
    if (jefe) return { name: jefe, label: 'Jefe de sitio' };
    return { name: 'Sin asignar', label: 'Responsable' };
  };

  return { resolveCreator, resolveOTOwner, employees };
}