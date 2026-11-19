import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { queryClientInstance } from '@/lib/query-client';
import { saveCacheEntry } from '@/lib/persistCache';
import {
  isOfflineEnabled, saveOfflineSession, readOfflineSession, clearOfflineSession, isNetworkError,
} from '@/lib/offlineSession';
import { scheduleOfflinePreload } from '@/lib/offlinePreload';
import {
  tieneArranqueRapido, usaRapido, compartirMe, borrarVinculo,
  leerVinculo, llamarVinculo, marcarVinculoPintado, vinculoCambio,
  precargarEmpleados, limpiarArranqueRapido,
} from '@/lib/arranqueRapido';

export const AuthContext = createContext();

// Modo sin conexión (beta): mientras dura, las consultas no piden nada al
// servidor ni reintentan (muestran el caché). Al salir se restauran los
// valores originales. Nunca se ejecuta si no se entra en modo sin conexión.
let onlineQueryDefaults = null;
const setQueriesOffline = (off) => {
  if (off) {
    if (!onlineQueryDefaults) onlineQueryDefaults = queryClientInstance.getDefaultOptions();
    queryClientInstance.setDefaultOptions({
      ...onlineQueryDefaults,
      queries: { ...onlineQueryDefaults.queries, enabled: false, retry: false },
    });
  } else if (onlineQueryDefaults) {
    queryClientInstance.setDefaultOptions(onlineQueryDefaults);
    onlineQueryDefaults = null;
  }
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
  const [isSlowConnection, setIsSlowConnection] = useState(false);
  const authBatchRef = useRef(null);
  const [offlineMode, setOfflineMode] = useState(false);
  const [offlineSavedAt, setOfflineSavedAt] = useState(null);
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    checkAppState();
  }, []);

  // Sesión guardada para el modo sin conexión: se guarda solo si el usuario
  // tiene offline_habilitado y hay red; si el campo es false, se borra.
  useEffect(() => {
    if (isLoadingAuth || offlineMode || !isAuthenticated || !user) return;
    if (!isOfflineEnabled(user)) { clearOfflineSession(); return; }
    if (navigator.onLine === false) return;
    saveOfflineSession({ user, userPermissions, hasEmployeeRecord });
    scheduleOfflinePreload({ user, userPermissions });
  }, [user, userPermissions, hasEmployeeRecord, isLoadingAuth, isAuthenticated, offlineMode]);

  // Entrada al modo sin conexión con la app YA abierta (solo offline_habilitado
  // true y con sesión guardada válida): (a) evento offline del navegador, o
  // (b) dos consultas seguidas fallan por error de red real en menos de 60 s.
  // No toca la sesión ni el usuario, no recarga ni redirige.
  const offlineEnabled = isOfflineEnabled(user);
  useEffect(() => {
    if (isLoadingAuth || offlineMode || !isAuthenticated || !offlineEnabled) return;
    const enterOffline = () => {
      const saved = readOfflineSession();
      if (!saved) return;
      setQueriesOffline(true);
      setOfflineSavedAt(saved.savedAt);
      setOfflineMode(true);
    };
    let lastFailAt = 0;
    const unsubscribe = queryClientInstance.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated') return;
      const action = event.action;
      // Una respuesta real del servidor corta la racha de fallos.
      if (action?.type === 'success' && !action.manual) { lastFailAt = 0; return; }
      if (action?.type !== 'error') return;
      const err = action.error;
      // Un TypeError que no viene de la red (error de código) no cuenta.
      const codeError = err instanceof TypeError && !/fetch|network|load failed/i.test(err.message || '');
      if (codeError || !isNetworkError(err)) { lastFailAt = 0; return; }
      const now = Date.now();
      if (lastFailAt && now - lastFailAt < 60000) enterOffline();
      else lastFailAt = now;
    });
    window.addEventListener('offline', enterOffline);
    return () => {
      unsubscribe();
      window.removeEventListener('offline', enterOffline);
    };
  }, [isLoadingAuth, offlineMode, isAuthenticated, offlineEnabled]);

  // Salida del modo sin conexión: al volver la red (evento online) o cada 30 s
  // se consulta la sesión en silencio. Un solo intervalo, sin recargar la página.
  useEffect(() => {
    if (!offlineMode) return;
    let busy = false;
    let cancelled = false;
    const tryReconnect = async () => {
      if (busy || cancelled) return;
      busy = true;
      try {
        const currentUser = await base44.auth.me();
        if (cancelled) return;
        setUser(currentUser);
        await linkEmployee(currentUser);
        setQueriesOffline(false);
        setIsAuthenticated(true);
        setOfflineMode(false);
        setJustReconnected(true);
        queryClientInstance.invalidateQueries();
        // Si el navegador nunca se declaró sin red, no hubo evento online real:
        // se avisa a las colas offline existentes para que sincronicen ahora.
        if (navigator.onLine !== false) window.dispatchEvent(new Event('online'));
      } catch (error) {
        if (cancelled) return;
        // 401/403: flujo normal de login. Cualquier otro error: seguimos sin conexión.
        if (error?.status === 401 || error?.status === 403) {
          clearOfflineSession();
          setQueriesOffline(false);
          setOfflineMode(false);
          setIsAuthenticated(false);
          setUser(null);
          setAuthError(
            error.status === 403 && error?.data?.extra_data?.reason === 'user_not_registered'
              ? { type: 'user_not_registered', message: 'User not registered for this app' }
              : { type: 'auth_required', message: 'Authentication required' }
          );
        }
      } finally {
        busy = false;
      }
    };
    window.addEventListener('online', tryReconnect);
    const interval = setInterval(tryReconnect, 30000);
    return () => {
      cancelled = true;
      window.removeEventListener('online', tryReconnect);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offlineMode]);

  // Aviso "Conectado · actualizando…" durante unos segundos tras reconectar.
  useEffect(() => {
    if (!justReconnected) return;
    const t = setTimeout(() => setJustReconnected(false), 4000);
    return () => clearTimeout(t);
  }, [justReconnected]);

  const checkAppState = async () => {
    // Intentos simultáneos (el original + "Reintentar") comparten un lote:
    // el primero que responde bien gana y los demás se ignoran; un fallo solo
    // cuenta si no queda ningún otro intento en curso.
    let batch = authBatchRef.current;
    if (!batch || batch.done) {
      batch = { done: false, pending: 0 };
      authBatchRef.current = batch;
    }
    batch.pending += 1;
    let owner = false;
    // Conexión lenta: a los 20 s solo se avisa en la pantalla de carga.
    // No se marca no autenticado ni se redirige; la petición sigue en curso.
    setIsSlowConnection(false);
    const slowTimer = setTimeout(() => {
      if (!batch.done) setIsSlowConnection(true);
    }, 20000);
    try {
      setIsLoadingAuth(true);
      setAuthError(null);
      const currentUser = await base44.auth.me();
      if (batch.done) return;
      batch.done = true;
      owner = true;
      setIsSlowConnection(false);
      setUser(currentUser);
      setIsAuthenticated(true);
      // Arranque rápido (beta): la respuesta queda compartida para el resto.
      if (tieneArranqueRapido(currentUser)) compartirMe(currentUser);

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
      schedulePrefetch('employees', usaRapido(currentUser, 'empleados')
        ? precargarEmpleados
        : () => base44.entities.Employee.list('-updated_date', 200));
      schedulePrefetch('pendientes', () => base44.entities.Pendiente.list('-updated_date', 300));

      // Vincular ficha de empleado y cargar permisos reales según su rol
      await linkEmployee(currentUser, true);
    } catch (error) {
      if (!owner) {
        // Otro intento ya resolvió o sigue en curso: este fallo no decide nada.
        if (batch.done || batch.pending > 1) return;
        batch.done = true;
        owner = true;
      }
      // Modo sin conexión (beta): SOLO si hay sesión guardada habilitada y con
      // menos de 7 días (readOfflineSession) Y el fallo fue un error de red real.
      // Nunca por timeout/lentitud ni con 401/403. Sin sesión guardada (interruptor
      // apagado) este bloque no hace nada y el flujo sigue igual que siempre.
      const savedSession = readOfflineSession();
      if (savedSession && isNetworkError(error)) {
        setQueriesOffline(true);
        setUser(savedSession.user);
        setUserPermissions(savedSession.userPermissions);
        setHasEmployeeRecord(savedSession.hasEmployeeRecord);
        setVinculationFailed(false);
        setIsAuthenticated(true);
        setOfflineSavedAt(savedSession.savedAt);
        setOfflineMode(true);
        return;
      }
      if (savedSession && (error?.status === 401 || error?.status === 403)) clearOfflineSession();
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
      clearTimeout(slowTimer);
      batch.pending -= 1;
      if (owner) {
        setIsSlowConnection(false);
        setIsLoadingAuth(false);
      }
    }
  };

  // Vincula al usuario con su ficha de empleado y carga permisos.
  // ESTRATEGIA DE DEGRADACIÓN GRACEFUL (3 capas):
  //   1) SDK directo (Employee + RolePermission) — más rápido
  //   2) Backend function vincularEmpleado (service role, bypassa RLS)
  //   3) Acceso mínimo al Dashboard — NUNCA bloquear a un usuario autenticado
  // usarGuardado: solo en la carga inicial. Con Arranque rápido encendido
  // permite pintar con el resultado guardado de esta sesión.
  const linkEmployee = async (currentUser, usarGuardado = false) => {
    // Los admins siempre tienen acceso total a todos los módulos.
    // PERO necesitan cargar su ficha de empleado (firma_url, nombre, sector)
    // para que los modales de firma funcionen correctamente. Sin esto,
    // employeeFirmaUrl queda null y el modal cae a una query local que puede
    // fallar por RLS (Employee.read exige sector_id match, que puede estar
    // stale si nunca se sincronizó).
    if (currentUser?.role === 'admin') {
      await loadAdminEmployeeMetadata(currentUser, usarGuardado);
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
  // Aplica a la sesión el resultado de vincularEmpleado (misma lógica de siempre).
  const aplicarVinculoAdmin = (currentUser, data) => {
      if (data?.linked && data.fallback !== true) {
        setHasEmployeeRecord(true);
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
        setHasEmployeeRecord(false);
        setUserPermissions({
          _employeeSector: currentUser?.data?.sector_id || currentUser?.sector_id || null,
        });
      }
  };

  // Arranque rápido (beta): después de pintar con lo guardado se espera la
  // llamada a vincularEmpleado de esta carga. Si cambió algo que se ve, la
  // sesión toma el resultado nuevo y se vuelven a pedir los datos, sin
  // recargar la página. Si la llamada falla, se sigue con lo guardado.
  const revalidarVinculo = async (currentUser, guardado) => {
    const nuevo = await llamarVinculo(currentUser.id).catch(() => null);
    if (!nuevo || !vinculoCambio(guardado, nuevo)) return;
    aplicarVinculoAdmin(currentUser, nuevo);
    const vinculado = nuevo.linked && nuevo.fallback !== true;
    const sector = (vinculado && nuevo.employee_sector) || currentUser?.data?.sector_id;
    setUser(prev => (prev && prev.data?.sector_id !== sector
      ? { ...prev, data: { ...(prev.data || {}), sector_id: sector } }
      : prev));
    if (guardado.employee_sector !== nuevo.employee_sector) {
      // Otro sector: se descartan los datos en memoria del sector anterior.
      await queryClientInstance.cancelQueries();
      queryClientInstance.resetQueries();
    } else {
      queryClientInstance.invalidateQueries();
    }
  };

  const loadAdminEmployeeMetadata = async (currentUser, usarGuardado = false) => {
    try {
      // Arranque rápido (beta): con resultado guardado en la sesión se pinta
      // al instante y la llamada de esta carga corre en segundo plano; sin
      // guardado se espera la llamada. Apagado: la llamada de siempre.
      const rapido = usarGuardado && usaRapido(currentUser, 'vinculo');
      const guardado = rapido ? leerVinculo(currentUser.id) : null;
      const result = rapido
        ? { data: guardado || await llamarVinculo(currentUser.id) }
        : await base44.functions.invoke('vincularEmpleado', {});
      const data = result?.data || result;
      aplicarVinculoAdmin(currentUser, data);
      if (guardado) {
        marcarVinculoPintado();
        revalidarVinculo(currentUser, guardado);
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

  // Interruptor "Modo sin conexión (beta)" de la propia cuenta.
  const setOfflineHabilitado = async (value) => {
    const v = !!value;
    await base44.auth.updateMe({ offline_habilitado: v });
    setUser(prev => prev ? {
      ...prev,
      offline_habilitado: v,
      ...(prev.data ? { data: { ...prev.data, offline_habilitado: v } } : {}),
    } : prev);
  };

  // Interruptor "Panel rápido (beta)" de la propia cuenta.
  const setPanelRapido = async (value) => {
    const v = !!value;
    await base44.auth.updateMe({ panel_rapido: v });
    setUser(prev => prev ? {
      ...prev,
      panel_rapido: v,
      ...(prev.data ? { data: { ...prev.data, panel_rapido: v } } : {}),
    } : prev);
  };

  // Interruptor "Órdenes rápidas (beta)" de la propia cuenta.
  const setOrdenesRapidas = async (value) => {
    const v = !!value;
    await base44.auth.updateMe({ ordenes_rapidas: v });
    setUser(prev => prev ? {
      ...prev,
      ordenes_rapidas: v,
      ...(prev.data ? { data: { ...prev.data, ordenes_rapidas: v } } : {}),
    } : prev);
  };

  // Interruptor "Arranque rápido (beta)" de la propia cuenta.
  const setArranqueRapido = async (value) => {
    const v = !!value;
    await base44.auth.updateMe({ arranque_rapido: v });
    limpiarArranqueRapido();
    setUser(prev => prev ? {
      ...prev,
      arranque_rapido: v,
      ...(prev.data ? { data: { ...prev.data, arranque_rapido: v } } : {}),
    } : prev);
  };

  // Interruptor "Modo operario (beta)" de la propia cuenta.
  const setModoOperario = async (value) => {
    const v = !!value;
    await base44.auth.updateMe({ modo_operario: v });
    setUser(prev => prev ? {
      ...prev,
      modo_operario: v,
      ...(prev.data ? { data: { ...prev.data, modo_operario: v } } : {}),
    } : prev);
  };

  const logout = () => {
    clearOfflineSession();
    setUser(null);
    setIsAuthenticated(false);
    base44.auth.logout(window.location.href);
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
      borrarVinculo();
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
      isSlowConnection,
      authError,
      vinculationFailed,
      hasEmployeeRecord,
      appPublicSettings: null,
      logout,
      navigateToLogin,
      retryVinculation,
      checkAppState,
      switchSector,
      offlineMode,
      offlineSavedAt,
      justReconnected,
      setOfflineHabilitado,
      setPanelRapido,
      setOrdenesRapidas,
      setArranqueRapido,
      setModoOperario
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