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
  // ESTRATEGIA DE DEGRADACIÓN GRACEFUL (3 capas):
  //   1) SDK directo (Employee + RolePermission) — más rápido
  //   2) Backend function vincularEmpleado (service role, bypassa RLS)
  //   3) Acceso mínimo al Dashboard — NUNCA bloquear a un usuario autenticado
  const linkEmployee = async (currentUser) => {
    if (currentUser?.role === 'admin') return;

    let loaded = false;
    let networkError = false;

    // Capa 1: SDK directo
    try {
      loaded = await loadPermissionsDirectly(currentUser);
    } catch (e) {
      networkError = true;
      console.warn('[AuthContext] SDK permission load failed:', e?.message);
    }

    // Capa 2: Backend function (bypassa RLS con service role)
    if (!loaded) {
      try {
        loaded = await loadPermissionsViaFunction();
      } catch (e) {
        networkError = true;
        console.warn('[AuthContext] Backend function permission load failed:', e?.message);
      }
    }

    // Capa 3: Acceso mínimo — el usuario está autenticado, no bloquear
    if (!loaded) {
      setUserPermissions({
        Dashboard: { read: true },
        _employeeSector: currentUser?.data?.sector_id || currentUser?.sector_id || 'escuela',
        _minimalAccess: true,
      });
      // vinculationFailed=true solo si hubo error de red → la UI ofrece reintentar.
      // Si no hubo error de red, el usuario simplemente no tiene ficha → "Acceso denegado".
      setVinculationFailed(networkError);
      setHasEmployeeRecord(false);
      // Reintento en background para recuperar permisos completos
      base44.functions.invoke('vincularEmpleado', {}).catch(() => {});
      return;
    }

    setVinculationFailed(false);
    // Sincronizar metadatos en background (nombre, sector, rol de plataforma)
    base44.functions.invoke('vincularEmpleado', {}).catch(() => {});
  };

  // Capa 1: Carga permisos desde Employee + RolePermission con el SDK
  const loadPermissionsDirectly = async (currentUser) => {
    if (!currentUser?.email) return false;

    let emp = null;

    try {
      const byUserId = await base44.entities.Employee.filter({ user_id: currentUser.id });
      emp = byUserId[0];
    } catch (_) {}

    if (!emp) {
      try {
        const byEmail = await base44.entities.Employee.filter({ email: currentUser.email });
        emp = byEmail.find(
          e => e.email?.toLowerCase().trim() === currentUser.email.toLowerCase().trim()
        );
      } catch (_) {}
    }

    if (!emp) {
      setHasEmployeeRecord(false);
      return false;
    }

    let perms = {};
    if (emp.role) {
      try {
        const roleNorm = emp.role.toLowerCase().trim();
        const allPerms = await base44.entities.RolePermission.list('-created_date', 500);
        const match = allPerms.find(rp => rp.role_name?.toLowerCase().trim() === roleNorm);
        if (match) perms = match.permissions || {};
      } catch (_) {}
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

  // Capa 2: Carga permisos vía backend function (service role, bypassa RLS)
  const loadPermissionsViaFunction = async () => {
    const result = await base44.functions.invoke('vincularEmpleado', {});
    const data = result?.data || result;
    if (!data || data.linked !== true) return false;
    // Fallback = el backend no encontró ficha de empleado → no hay error de red,
    // pero tampoco hay permisos reales. Retornar false para que Capa 3 asigne acceso mínimo.
    if (data.fallback === true) return false;

    setHasEmployeeRecord(true);
    setUserPermissions({
      ...(data.employee_permissions || {}),
      _employeeRole: data.employee_role || null,
      _employeeName: data.employee_name || null,
      _employeeSector: data.employee_sector || 'escuela',
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