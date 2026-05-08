import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userPermissions, setUserPermissions] = useState(null); // permisos del rol del usuario
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);

      // Cargar permisos del rol del usuario desde RolePermission
      if (currentUser?.role) {
        try {
          const rolePerms = await base44.entities.RolePermission.filter({ role_name: currentUser.role });
          if (rolePerms && rolePerms.length > 0) {
            setUserPermissions(rolePerms[0].permissions);
          }
        } catch (_) {
          setUserPermissions(null);
        }
      }

      // Vincular automáticamente la ficha de empleado si existe con el mismo email
      if (currentUser?.email) {
        try {
          const matches = await base44.entities.Employee.filter({ email: currentUser.email });
          if (matches && matches.length > 0) {
            const emp = matches[0];
            // Solo actualizar si aún no está vinculado o si cambió el user_id
            if (!emp.user_id || emp.user_id !== currentUser.id) {
              await base44.entities.Employee.update(emp.id, { user_id: currentUser.id });
            }
          }
        } catch (_) {
          // Si falla la vinculación, no bloquear el login
        }
      }
    } catch (error) {
      setIsAuthenticated(false);
      setUser(null);
      if (error?.status === 403 && error?.data?.extra_data?.reason === 'user_not_registered') {
        setAuthError({ type: 'user_not_registered', message: 'User not registered for this app' });
      } else if (error?.status === 401 || error?.status === 403) {
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
      } else {
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
      }
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    base44.auth.logout(window.location.href);
  };

  const navigateToLogin = () => {
    base44.auth.redirectToLogin(window.location.href);
  };

  return (
    <AuthContext.Provider value={{
      user,
      userPermissions,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings: null,
      logout,
      navigateToLogin,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};