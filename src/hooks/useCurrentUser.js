import { useContext, useMemo } from 'react';
import { AuthContext } from '@/lib/AuthContext';

/**
 * Hook que retorna el usuario actual y si es admin.
 * Reutiliza el AuthContext — sin hacer llamadas API duplicadas.
 */
export function useCurrentUser() {
  const { user: currentUser, userPermissions, isLoadingAuth: loading } = useContext(AuthContext);

  const isAdmin = currentUser?.role === 'admin';

  /**
   * Filtra una lista de registros según el usuario actual.
   * Para no-admins, conserva solo los registros donde alguno de los campos
   * indicados contenga el nombre o email del usuario.
   */
  function filterByUser(list, fields = []) {
    if (isAdmin || !currentUser) return list;
    const name = currentUser.full_name?.toLowerCase() || '';
    const email = currentUser.email?.toLowerCase() || '';
    return list.filter(item =>
      fields.some(field => {
        const val = (item[field] || '').toLowerCase();
        return (name && val.includes(name)) || (email && val === email);
      })
    );
  }

  return { currentUser, user: currentUser, isAdmin, loading, filterByUser, userPermissions };
}