import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { queryClientInstance } from '@/lib/query-client';
import { saveCacheEntry } from '@/lib/persistCache';

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

      // Pre-fetch silencioso en idle — no compite con el primer render
      const schedulePrefetch = (key, fetcher) => {
        const run = async () => {
          try {
            if (queryClientInstance.getQueryData([key])) return;
            const data = await fetcher();
            if (data?.length > 0) {
              queryClientInstance.setQueryData([key], data);
              saveCacheEntry(key, data);
            }
          } catch (_) { /* silencioso */ }
        };
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(run, { timeout: 8000 });
        } else {
          setTimeout(run, 2500);
        }
      };
      schedulePrefetch('workorders', () => base44.entities.WorkOrder.list('-updated_date', 300));
      schedulePrefetch('employees',  () => base44.entities.Employee.list('-updated_date', 200));
      schedulePrefetch('pendientes', () => base44.entities.Pendiente.list('-updated_date', 300));

      // Vincular ficha de empleado y cargar permisos reales según su rol
      // Esto corre en CADA carga (no solo al login) para garantizar permisos actualizados
      try {
        const vinculacionPromise = base44.functions.invoke('vincularEmpleado', {});
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('vincularEmpleado_timeout')), 8000));
        
        const vinculacion = await Promise.race([vinculacionPromise, timeoutPromise]);
        
        if (vinculacion?.data?.linked) {
          const perms = vinculacion.data.employee_permissions || {};
          setUserPermissions({
            ...perms,
            _employeeRole: vinculacion.data.employee_role || null,
            _employeeName: vinculacion.data.employee_name || null,
          });
        } else if (vinculacion?.data?.linked === false) {
          if (currentUser?.role !== 'admin') {
            setUserPermissions({});
          }
        }
      } catch (error) {
        // Si falla la vinculación por timeout o error, no bloquear el login
        // pero loguear para diagnóstico
        if (error?.message !== 'vincularEmpleado_timeout') {
          console.warn('[AuthContext] vincularEmpleado error:', error?.message);
        }
        // Usuarios admin aún obtienen acceso completo, otros ven permisos vacíos
        if (currentUser?.role !== 'admin') {
          setUserPermissions({});
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