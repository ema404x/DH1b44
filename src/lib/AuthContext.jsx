import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { queryClientInstance } from '@/lib/query-client';
import { saveCacheEntry } from '@/lib/persistCache';
import {
  loadOfflineProfile,
  saveOfflineProfile,
  clearOfflineProfile,
  clearOfflineSession,
  hasOfflineProfileFor,
} from '@/lib/offlineProfile';
import { warmOfflineShell } from '@/lib/offlineShell';

export const AuthContext = createContext();

// ── Modo sin conexión (beta, por usuario, apagado por defecto) ──────────────
const RECONNECT_ATTEMPT_TIMEOUT_MS = 15000;          // abandona UN reintento colgado; nunca activa el modo offline
const RECONNECT_DELAYS_MS = [20000, 40000, 60000];  // espera creciente entre reintentos en segundo plano
const isSessionInvalid = (error) => error?.status === 401 || error?.status === 403;
// Error de red REAL: la petición no obtuvo respuesta del servidor (fetch failed /
// Network Error). Una respuesta con status (5xx, etc.) o una demora NO cuentan.
const isNetworkError = (error) => {
  if (!error) return false;
  const original = error.originalError || error;
  if (error.status || error.response?.status || original.response?.status) return false;
  const code = original.code || error.code;
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') return false; // lentitud, no caída
  const message = `${error.message || ''} ${original.message || ''}`;
  return code === 'ERR_NETWORK' || error.name === 'TypeError' || original.name === 'TypeError' ||
    /network error|failed to fetch|fetch failed|load failed/i.test(message);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userPermissions, setUserPermissions] = useState(null); // permisos del rol del usuario
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [vinculationFailed, setVinculationFailed] = useState(false);
  const [hasEmployeeRecord, setHasEmployeeRecord] = useState(null);
  // Modo sin conexión — todo queda inerte si el usuario no tiene el interruptor.
  const [offlineMode, setOfflineMode] = useState(false);
  const [offlineSavedAt, setOfflineSavedAt] = useState(null);
  const [reconnected, setReconnected] = useState(false);
  const [offlineEnabled, setOfflineEnabled] = useState(null); // null = todavía no se sabe
  const [bootOk, setBootOk] = useState(false);
  const reconnectingRef = useRef(false);

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);
      const currentUser = await resolveCurrentUser();
      if (!currentUser) return; // arrancó en modo sin conexión con el perfil guardado
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
      schedulePrefetch('employees',  () => base44.entities.Employee.list('-updated_date', 200));
      schedulePrefetch('pendientes', () => base44.entities.Pendiente.list('-updated_date', 300));

      // Vincular ficha de empleado y cargar permisos reales según su rol
      await linkEmployee(currentUser);
      setBootOk(true);
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

  // ── MODO SIN CONEXIÓN ───────────────────────────────────────────────────
  // Devuelve el usuario de auth.me(), o null si se entró en modo sin conexión.
  // SIN perfil offline guardado (interruptor apagado) es exactamente el
  // `await base44.auth.me()` de siempre: misma llamada, mismos errores.
  const resolveCurrentUser = async () => {
    const mePromise = base44.auth.me();
    mePromise.catch(() => {}); // el error real se maneja más abajo
    const profile = await loadOfflineProfile(); // lectura local, en paralelo a auth.me()
    if (!profile) return mePromise;

    if (navigator.onLine === false) {
      enterOfflineMode(profile);
      return null;
    }

    // Con red: se espera auth.me() el tiempo que tarde (mismo spinner de siempre).
    // La lentitud NUNCA activa el modo sin conexión.
    try {
      const result = await mePromise;
      // La sesión es de otro usuario: el perfil guardado ya no corresponde.
      if (result?.id !== profile.id) clearOfflineProfile();
      return result;
    } catch (error) {
      if (isSessionInvalid(error)) {
        clearOfflineSession(profile.id);
        throw error; // login normal
      }
      if (isNetworkError(error)) {
        enterOfflineMode(profile); // sin respuesta del servidor
        return null;
      }
      throw error; // 5xx u otros: mismo camino que sin perfil offline
    }
  };

  const enterOfflineMode = (profile) => {
    setUser(profile.user);
    setUserPermissions(profile.userPermissions);
    setHasEmployeeRecord(profile.hasEmployeeRecord ?? null);
    setVinculationFailed(false);
    setIsAuthenticated(true);
    setOfflineSavedAt(profile.savedAt);
    setOfflineMode(true);
  };

  // Recarga permisos al volver la red. Si falla, se conservan los guardados
  // (a diferencia de linkEmployee, no degrada a acceso mínimo).
  const refreshPermissions = async (liveUser) => {
    if (liveUser?.role === 'admin') {
      await loadAdminEmployeeMetadata(liveUser);
      return;
    }
    let loaded = false;
    try { loaded = await loadPermissionsDirectly(liveUser); } catch (_) {}
    if (!loaded) {
      try { await loadPermissionsViaFunction(); } catch (_) {}
    }
  };

  // Reintento en segundo plano mientras dura el modo sin conexión.
  const tryReconnect = async () => {
    if (reconnectingRef.current) return;
    reconnectingRef.current = true;
    let timer;
    try {
      const mePromise = base44.auth.me();
      mePromise.catch(() => {});
      const liveUser = await Promise.race([
        mePromise,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('timeout')), RECONNECT_ATTEMPT_TIMEOUT_MS);
        }),
      ]);
      // Volvió la red: salir del modo offline y refrescar datos en vivo,
      // sin recargar la página ni cambiar de pantalla.
      setUser(liveUser);
      await refreshPermissions(liveUser);
      setBootOk(true);
      setOfflineMode(false);
      setReconnected(true);
      queryClientInstance.invalidateQueries();
      setTimeout(() => setReconnected(false), 4000);
    } catch (error) {
      if (isSessionInvalid(error)) {
        // La sesión ya no es válida: cerrar el modo offline y volver al login.
        clearOfflineSession(user?.id);
        setOfflineMode(false);
        setUser(null);
        setIsAuthenticated(false);
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
      }
      // Cualquier otro error: seguimos sin conexión y se reintenta luego.
    } finally {
      clearTimeout(timer);
      reconnectingRef.current = false;
    }
  };

  useEffect(() => {
    if (!offlineMode) return;
    // Reintentos con espera creciente (20 s, 40 s, 60 s…). Un reintento fallido
    // no cambia de estado ni refresca nada: se sigue en modo sin conexión.
    // La salida (y la única invalidación de consultas) ocurre en tryReconnect
    // cuando auth.me() responde; ahí este efecto se desmonta y deja de reintentar.
    let timer;
    let attempt = 0;
    let cancelled = false;
    const schedule = () => {
      const delay = RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)];
      timer = setTimeout(async () => {
        attempt += 1;
        await tryReconnect();
        if (!cancelled) schedule();
      }, delay);
    };
    const onOnline = () => { tryReconnect(); };
    schedule();
    window.addEventListener('online', onOnline);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener('online', onOnline);
    };
  }, [offlineMode]);

  // Guardar / borrar el perfil offline cuando el arranque con red terminó bien.
  // Interruptor apagado → no se guarda nada y se borra cualquier perfil previo.
  useEffect(() => {
    if (!bootOk || offlineMode || !user?.id || offlineEnabled === null) return;
    if (!offlineEnabled) {
      clearOfflineProfile();
      return;
    }
    if (!userPermissions || userPermissions._minimalAccess) return;
    const sectorId = user.data?.sector_id || user.sector_id || userPermissions._employeeSector || null;
    saveOfflineProfile({
      id: user.id,
      full_name: user.full_name || null,
      email: user.email || null,
      role: user.role || null,
      sector_id: sectorId,
      employee: {
        full_name: userPermissions._employeeName || null,
        role: userPermissions._employeeRole || null,
        sector_id: userPermissions._employeeSector || null,
      },
      // Solo los campos necesarios para reconstruir la sesión. Sin tokens.
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        sector_id: user.sector_id,
        data: { sector_id: user.data?.sector_id, sector_base: user.data?.sector_base },
      },
      userPermissions,
      hasEmployeeRecord,
      savedAt: Date.now(),
    });
    warmOfflineShell();
  }, [bootOk, offlineMode, offlineEnabled, user, userPermissions, hasEmployeeRecord]);

  // Vincula al usuario con su ficha de empleado y carga permisos.
  // ESTRATEGIA DE DEGRADACIÓN GRACEFUL (3 capas):
  //   1) SDK directo (Employee + RolePermission) — más rápido
  //   2) Backend function vincularEmpleado (service role, bypassa RLS)
  //   3) Acceso mínimo al Dashboard — NUNCA bloquear a un usuario autenticado
  const linkEmployee = async (currentUser) => {
    // Los admins siempre tienen acceso total a todos los módulos.
    // PERO necesitan cargar su ficha de empleado (firma_url, nombre, sector)
    // para que los modales de firma funcionen correctamente. Sin esto,
    // employeeFirmaUrl queda null y el modal cae a una query local que puede
    // fallar por RLS (Employee.read exige sector_id match, que puede estar
    // stale si nunca se sincronizó).
    if (currentUser?.role === 'admin') {
      await loadAdminEmployeeMetadata(currentUser);
      return;
    }

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
        _employeeSector: currentUser?.data?.sector_id || currentUser?.sector_id || null,
        _minimalAccess: true,
      });
      setVinculationFailed(networkError);
      setHasEmployeeRecord(false);
      base44.functions.invoke('vincularEmpleado', {}).catch(() => {});
      return;
    }

    setVinculationFailed(false);
  };

  // Carga metadata del empleado para admins via backend function (bypassa RLS).
  // NO aplica restricciones de RolePermission — los admins tienen acceso total.
  const loadAdminEmployeeMetadata = async (currentUser) => {
    try {
      const result = await base44.functions.invoke('vincularEmpleado', {});
      const data = result?.data || result;
      if (data?.linked && data.fallback !== true) {
        setHasEmployeeRecord(true);
        setOfflineEnabled(data.employee_offline_habilitado === true);
        // Sincronizar sector_id en el objeto user para que las queries
        // dependientes de RLS funcionen correctamente.
        if (data.employee_sector && data.employee_sector !== currentUser?.data?.sector_id) {
          setUser(prev => ({
            ...prev,
            data: { ...(prev?.data || {}), sector_id: data.employee_sector },
          }));
        }
        setUserPermissions({
          _employeeRole: data.employee_role || null,
          _employeeName: data.employee_name || null,
          _employeeSector: data.employee_sector || null,
          _employeeFirmaUrl: data.employee_firma_url || null,
        });
      } else {
        // Admin de plataforma sin ficha Employee: el interruptor vive en User.
        setOfflineEnabled(currentUser?.offline_habilitado === true);
        setHasEmployeeRecord(false);
        setUserPermissions({
          _employeeSector: currentUser?.data?.sector_id || currentUser?.sector_id || null,
        });
      }
    } catch (e) {
      console.warn('[AuthContext] Admin metadata load failed:', e?.message);
      setUserPermissions({
        _employeeSector: currentUser?.data?.sector_id || currentUser?.sector_id || null,
      });
      setHasEmployeeRecord(null);
    }
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
    // Sincronizar sector_id en el objeto user para que las queries
    // dependientes de RLS (como la query local del modal de firma) funcionen.
    setOfflineEnabled(emp.offline_habilitado === true);
    if (emp.sector_id && emp.sector_id !== currentUser?.data?.sector_id) {
      setUser(prev => ({
        ...prev,
        data: { ...(prev?.data || {}), sector_id: emp.sector_id },
      }));
    }
    setUserPermissions({
      ...perms,
      _employeeRole: emp.role || null,
      _employeeName: emp.full_name || null,
      _employeeSector: emp.sector_id || null,
      _employeeFirmaUrl: emp.firma_url || null,
    });
    return true;
  };

  // Capa 2: Carga permisos vía backend function (service role, bypassa RLS)
  const loadPermissionsViaFunction = async () => {
    const result = await base44.functions.invoke('vincularEmpleado', {});
    const data = result?.data || result;
    if (!data || data.linked !== true) return false;
    if (data.fallback === true) return false;
    setOfflineEnabled(data.employee_offline_habilitado === true);

    setHasEmployeeRecord(true);
    // Sincronizar sector_id en el objeto user para que las queries
    // dependientes de RLS funcionen correctamente.
    if (data.employee_sector) {
      setUser(prev => ({
        ...prev,
        data: { ...(prev?.data || {}), sector_id: data.employee_sector },
      }));
    }
    setUserPermissions({
      ...(data.employee_permissions || {}),
      _employeeRole: data.employee_role || null,
      _employeeName: data.employee_name || null,
      _employeeSector: data.employee_sector || null,
      _employeeFirmaUrl: data.employee_firma_url || null,
    });
    return true;
  };

  const retryVinculation = async () => {
    if (!user) return;
    setIsLoadingAuth(true);
    await linkEmployee(user);
    setIsLoadingAuth(false);
  };

  const logout = async () => {
    // Con perfil offline guardado: borrarlo junto con la caché local antes de salir.
    if (hasOfflineProfileFor(user?.id)) await clearOfflineSession(user.id);
    setUser(null);
    setIsAuthenticated(false);
    base44.auth.logout(window.location.href);
  };

  // Interruptor propio del modo sin conexión — solo para admins de plataforma
  // sin ficha Employee. Al apagarlo, el efecto de arriba borra el perfil local.
  const setOwnOfflineEnabled = async (value) => {
    if (user?.role !== 'admin' || hasEmployeeRecord !== false || offlineMode) return;
    await base44.auth.updateMe({ offline_habilitado: value });
    setUser(prev => ({ ...prev, offline_habilitado: value }));
    setOfflineEnabled(value);
  };

  const navigateToLogin = () => {
    base44.auth.redirectToLogin(window.location.href);
  };

  // Cambio de sector persistente e inmediato (Modelo B):
  // 1) valida rol server-side y persiste via cambiarSectorActivo (service-role)
  // 2) actualiza el estado en memoria solo si la función confirma
  // 3) invalida todas las queries para que refetch con el nuevo sector
  const switchSector = async (sectorId) => {
    try {
      const res = await base44.functions.invoke('cambiarSectorActivo', { sector_destino: sectorId });
      const data = res?.data || res;
      if (!data?.ok) throw new Error(data?.error || 'No se pudo cambiar de sector');
      const nuevoSector = data.sector_activo || sectorId;
      const nuevoBase = data.sector_base || null;
      setUser(prev => ({
        ...prev,
        sector_id: nuevoSector,
        data: {
          ...(prev?.data || {}),
          sector_id: nuevoSector,
          ...(nuevoBase ? { sector_base: nuevoBase } : prev?.data?.sector_base ? { sector_base: prev.data.sector_base } : {}),
        },
      }));
      setUserPermissions(prev => ({ ...prev, _employeeSector: nuevoSector }));
      await queryClientInstance.cancelQueries();
      queryClientInstance.removeQueries();
      // Recarga completa para purgar state local stale y forzar sincronización de
      // todos los módulos con el nuevo sector (RLS hard-AND exige sector exacto).
      if (typeof window !== 'undefined') {
        setTimeout(() => window.location.reload(), 500);
      }
      return nuevoSector;
    } catch (e) {
      throw new Error(e?.response?.data?.error || e?.data?.error || e?.message || 'Error al cambiar de sector');
    }
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
      offlineMode,
      offlineSavedAt,
      reconnected,
      offlineEnabled,
      setOwnOfflineEnabled,
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