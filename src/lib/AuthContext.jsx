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
  const [vinculationFailed, setVinculationFailed] = useState(false);
  const [hasEmployeeRecord, setHasEmployeeRecord] = useState(null);

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
      await linkEmployee(currentUser);
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

  // Vincula al usuario con su ficha de empleado y carga permisos.
  // ESTRATEGIA: cargar permisos directamente desde el SDK (primario) + invocar
  // vincularEmpleado en background para sincronizar metadatos (fire-and-forget).
  // Esto elimina la dependencia de la función backend para desbloquear el acceso.
  const linkEmployee = async (currentUser) => {
    if (currentUser?.role === 'admin') return; // Los admins siempre tienen acceso

    // 1) Cargar permisos directamente desde el SDK — flujo primario
    try {
      await loadPermissionsDirectly(currentUser);
      setVinculationFailed(false);
    } catch (e) {
      console.warn('[AuthContext] Direct permission load failed:', e?.message);
      setVinculationFailed(true);
    }

    // 2) Invocar vincularEmpleado en background para sincronizar metadatos
    //    (rol de plataforma, sector_id, nombre). No bloquea el acceso.
    base44.functions.invoke('vincularEmpleado', {}).catch(() => {});
  };

  // Carga permisos directamente desde Employee + RolePermission (sin backend function)
  const loadPermissionsDirectly = async (currentUser) => {
    if (!currentUser?.email) return false;

    // Buscar ficha de empleado — primero por user_id, luego por email
    let emp = null;
    try {
      const byUserId = await base44.entities.Employee.filter({ user_id: currentUser.id });
      emp = byUserId[0];
    } catch (_) { /* RLS puede bloquear — intentar por email */ }

    if (!emp) {
      const byEmail = await base44.entities.Employee.filter({ email: currentUser.email });
      emp = byEmail.find(
        e => e.email?.toLowerCase().trim() === currentUser.email.toLowerCase().trim()
      );
    }

    if (!emp) {
      setHasEmployeeRecord(false);
      return false;
    }

    // Buscar permisos del rol
    let perms = {};
    if (emp.role) {
      const roleNorm = emp.role.toLowerCase().trim();
      const allPerms = await base44.entities.RolePermission.list('-created_date', 500);
      const match = allPerms.find(rp => rp.role_name?.toLowerCase().trim() === roleNorm);
      if (match) perms = match.permissions || {};
    }

    setHasEmployeeRecord(true);
    setUserPermissions({
      ...perms,
      _employeeRole: emp.role || null,
      _employeeName: emp.full_name || null,
      _employeeSector: emp.sector_id || 'escuela',
    });
    return true;
  };

  const retryVinculation = async () => {
    if (!user) return;
    setIsLoadingAuth(true);
    await linkEmployee(user);
    setIsLoadingAuth(false);
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    base44.auth.logout(window.location.href);
  };

  const navigateToLogin = () => {
    base44.auth.redirectToLogin(window.location.href);
  };

  // Cambio de sector persistente e inmediato:
  // 1) persiste en el usuario (base44.auth.updateMe)
  // 2) actualiza el estado en memoria
  // 3) invalida todas las queries para que refetch con el nuevo sector
  const switchSector = async (sectorId) => {
    await base44.auth.updateMe({ sector_id: sectorId });
    setUser(prev => ({ ...prev, sector_id: sectorId, data: { ...(prev?.data || {}), sector_id: sectorId } }));
    setUserPermissions(prev => ({ ...prev, _employeeSector: sectorId }));
    queryClientInstance.invalidateQueries();
    queryClientInstance.removeQueries();
  };

  return (
    <AuthContext.Provider value={{
      user,
      userPermissions,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      vinculationFailed,
      hasEmployeeRecord,
      appPublicSettings: null,
      logout,
      navigateToLogin,
      retryVinculation,
      checkAppState,
      switchSector
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