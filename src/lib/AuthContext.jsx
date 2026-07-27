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
  // Reintenta hasta 2 veces antes de marcar como fallido (evita "acceso denegado" por blips de red).
  // Si la función falla, intenta cargar permisos directamente desde las entidades (fallback).
  const linkEmployee = async (currentUser) => {
    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const vinculacionPromise = base44.functions.invoke('vincularEmpleado', {});
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 20000)
        );
        const vinculacion = await Promise.race([vinculacionPromise, timeoutPromise]);

        // Guard: respuesta malformada (sin data o sin campo linked) → tratar como fallo
        if (!vinculacion?.data || typeof vinculacion.data.linked !== 'boolean') {
          throw new Error('malformed_response');
        }

        if (vinculacion.data.linked) {
          const perms = vinculacion.data.employee_permissions || {};
          setHasEmployeeRecord(!vinculacion.data.fallback);
          setUserPermissions({
            ...perms,
            _employeeRole: vinculacion.data.employee_role || null,
            _employeeName: vinculacion.data.employee_name || null,
            _employeeSector: vinculacion.data.employee_sector || 'escuela',
          });
        } else {
          setHasEmployeeRecord(false);
        }
        setVinculationFailed(false);
        return;
      } catch (error) {
        if (attempt < maxAttempts) {
          await new Promise(r => setTimeout(r, 1500));
          continue;
        }
        console.warn('[AuthContext] vincularEmpleado failed after retries:', error?.message);

        // ── FALLBACK: cargar permisos directamente desde las entidades ──
        // Si la función falla pero el usuario está autenticado, intentamos
        // resolver su ficha de empleado y permisos directamente con el SDK.
        // Esto evita bloquear al usuario por un fallo transitorio del backend.
        if (currentUser?.role === 'admin') {
          return; // Los admins siempre tienen acceso
        }
        try {
          const fallbackPerms = await loadPermissionsDirectly(currentUser);
          if (fallbackPerms) {
            setVinculationFailed(false);
            return;
          }
        } catch (e) {
          console.warn('[AuthContext] Fallback permission load failed:', e?.message);
        }
        setVinculationFailed(true);
      }
    }
  };

  // Carga permisos directamente desde Employee + RolePermission (sin backend function)
  const loadPermissionsDirectly = async (currentUser) => {
    if (!currentUser?.email) return null;
    // Buscar ficha de empleado por email
    const employees = await base44.entities.Employee.filter({ email: currentUser.email });
    const emp = employees.find(
      e => e.email?.toLowerCase().trim() === currentUser.email.toLowerCase().trim()
    );
    if (!emp) return null;

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