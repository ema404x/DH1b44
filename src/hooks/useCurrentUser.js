import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Hook que retorna el usuario actual y si es admin.
 * isAdmin: true -> puede ver todo
 * isAdmin: false -> solo ve lo que le compete (filtrar por nombre/email)
 */
export function useCurrentUser() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me()
      .then(u => setCurrentUser(u))
      .catch(() => setCurrentUser(null))
      .finally(() => setLoading(false));
  }, []);

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

  return { currentUser, isAdmin, loading, filterByUser };
}