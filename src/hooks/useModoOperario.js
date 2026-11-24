import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isModoOperario } from '@/lib/modoOperario';

const norm = (s) => String(s || '').toLowerCase().trim();

/**
 * Modo operario efectivo de la cuenta actual. Se activa si:
 *  (a) la cuenta tiene modo_operario === true (interruptor de siempre), o
 *  (b) no es admin y su ficha Employee está "Vinculada" (mismo criterio que
 *      la página Empleados: ficha con user_id = la cuenta, email igual al de
 *      la cuenta y rol con permisos en Control de Acceso) con cargo "Operario".
 * (b) se calcula al vuelo: no escribe nada en la cuenta. Mientras carga o si
 * falla, devuelve false (pantalla de siempre).
 */
export function useModoOperario() {
  const { user } = useAuth();
  const porFlag = isModoOperario(user);
  const consultar = !!user?.id && !!user?.email && user.role !== 'admin' && !porFlag;

  const { data: porCargo = false } = useQuery({
    queryKey: ['modo-operario-cargo', user?.id],
    enabled: consultar,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const fichas = await base44.entities.Employee.filter({ user_id: user.id });
      const emp = (fichas || []).find((e) => e.user_id === user.id
        && e.email?.trim() && norm(e.email) === norm(user.email));
      if (!emp || norm(emp.role) !== 'operario') return false;
      const roles = await base44.entities.RolePermission.list('-created_date', 500);
      return (roles || []).some((rp) => norm(rp.role_name) === 'operario');
    },
  });

  return porFlag || (consultar && porCargo === true);
}