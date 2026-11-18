// Arranque rápido (beta): interruptor por usuario (arranque_rapido).
// Con el interruptor apagado nada de este archivo se usa y el arranque queda
// igual que siempre. Todo lo guardado vive en sessionStorage (una sesión =
// una pestaña abierta).
import { useSyncExternalStore } from 'react';
import { base44 } from '@/api/base44Client';
import { queryClientInstance } from '@/lib/query-client';
import { fetchAllList } from '@/lib/fetchAllList';

const VINCULO_KEY = 'dh1-arranque-vinculo';
const ESTADO_KEY = 'dh1-arranque-estado';
const PUSH_KEY = 'dh1-arranque-push';
const VINCULO_MAX_MS = 30 * 60 * 1000;

const leer = (k) => { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } };
const guardar = (k, v) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* sin espacio */ } };
const quitar = (k) => { try { sessionStorage.removeItem(k); } catch { /* nada */ } };

export const tieneArranqueRapido = (user) =>
  user?.arranque_rapido === true || user?.data?.arranque_rapido === true;

// ── Estado de la verificación y de los caminos que volvieron al de siempre ──
const VACIO = { userId: null, hechos: {}, diferencias: [], fallback: {} };
let estado = leer(ESTADO_KEY) || VACIO;
const oyentes = new Set();
const suscribir = (f) => { oyentes.add(f); return () => oyentes.delete(f); };

function actualizar(userId, cambio) {
  estado = cambio(estado.userId === userId ? estado : { ...VACIO, userId });
  guardar(ESTADO_KEY, estado);
  oyentes.forEach((f) => f());
}

export const estadoDe = (userId) => (estado.userId === userId ? estado : VACIO);
export const useArranqueEstado = () => useSyncExternalStore(suscribir, () => estado);

export const registrarVerificacion = (userId, item, diferencias) =>
  actualizar(userId, (e) => ({
    ...e,
    hechos: { ...e.hechos, [item]: true },
    diferencias: [...e.diferencias, ...diferencias],
    fallback: diferencias.length ? { ...e.fallback, [item]: true } : e.fallback,
  }));

export const marcarFallback = (userId, item) =>
  actualizar(userId, (e) => ({ ...e, fallback: { ...e.fallback, [item]: true } }));

// true = usar el camino rápido para ese punto (interruptor encendido y sin
// diferencias detectadas en esta sesión).
export const usaRapido = (user, item) =>
  tieneArranqueRapido(user) && !estadoDe(user?.id).fallback[item];

export const useUsaRapido = (user, item) => {
  useArranqueEstado();
  return usaRapido(user, item);
};

export function limpiarArranqueRapido() {
  borrarVinculo();
  [ESTADO_KEY, PUSH_KEY].forEach(quitar);
  estado = VACIO;
  oyentes.forEach((f) => f());
}

// ── Usuario (me): una sola respuesta compartida ─────────────────────────────
export const ME_KEY = ['arranque-me'];
export const compartirMe = (user) => queryClientInstance.setQueryData(ME_KEY, user);
export const obtenerMe = () =>
  queryClientInstance.fetchQuery({ queryKey: ME_KEY, queryFn: () => base44.auth.me(), staleTime: 5 * 60 * 1000 });

// ── Sectores: misma clave y misma consulta que useSectorConfig y Empleados ──
export const SECTORES_KEY = ['sectores'];
export const obtenerSectores = () =>
  queryClientInstance.fetchQuery({
    queryKey: SECTORES_KEY,
    queryFn: () => base44.entities.Sector.list('orden', 100),
    staleTime: 300000,
  });

// ── vincularEmpleado: una llamada real por carga de página, compartida ──────
// Las cargas siguientes de la sesión pintan con el resultado guardado (vale
// 30 min) y esa misma llamada lo revalida en segundo plano.
let vinculoLlamada = null;
let vinculoGen = 0;
let vinculoPintadoConGuardado = false;

export const leerVinculo = (userId) => {
  const v = leer(VINCULO_KEY);
  return v && v.userId === userId && Date.now() - v.savedAt < VINCULO_MAX_MS ? v.data : null;
};
// Borra lo guardado; una llamada que estaba en curso ya no lo vuelve a guardar.
export const borrarVinculo = () => { vinculoGen += 1; quitar(VINCULO_KEY); };
// true si esta carga de página pintó con el resultado guardado.
export const marcarVinculoPintado = () => { vinculoPintadoConGuardado = true; };
export const vinculoPintado = () => vinculoPintadoConGuardado;

// La llamada a vincularEmpleado de esta carga (una sola). Rechaza si falla.
export function llamarVinculo(userId) {
  if (!vinculoLlamada) {
    const gen = vinculoGen;
    vinculoLlamada = base44.functions.invoke('vincularEmpleado', {}).then((r) => {
      const data = r?.data || null;
      if (gen === vinculoGen && data && data.linked !== undefined) {
        guardar(VINCULO_KEY, { userId, data, savedAt: Date.now() });
      }
      return data;
    });
    vinculoLlamada.catch(() => {});
  }
  return vinculoLlamada;
}

// Para quien no pinta el arranque (Alice): el resultado de esa misma llamada;
// si falla, lo guardado.
export const obtenerVinculo = (userId) => llamarVinculo(userId).catch(() => leerVinculo(userId));

// ¿Cambió algo que se ve? Sector, rol, permisos (ver todo o solo lo propio
// sale de rol y permisos), nombre o firma.
const CAMPOS_VINCULO = [
  'linked', 'fallback', 'employee_name', 'employee_role',
  'employee_sector', 'employee_permissions', 'employee_firma_url',
];
export const vinculoCambio = (a, b) =>
  CAMPOS_VINCULO.some((k) => JSON.stringify(a?.[k] ?? null) !== JSON.stringify(b?.[k] ?? null));

// ── Empleados: en Órdenes, una sola consulta alimenta las dos listas ────────
let empleadosDerivados = null;
export const getEmpleadosDerivados = () => empleadosDerivados;

export async function precargarEmpleados() {
  const qc = queryClientInstance;
  // Una pantalla ya está pidiendo esta misma lista: no se repite.
  if (qc.getQueryState(['employees'])?.fetchStatus === 'fetching') return null;
  if (window.location.pathname === '/ordenes') {
    const todos = await qc.fetchQuery({
      queryKey: ['employees-filter-lookup'],
      queryFn: () => fetchAllList('Employee', '-updated_date'),
      staleTime: 5 * 60 * 1000,
    });
    if (todos?.length > 0) {
      empleadosDerivados = todos.slice(0, 200);
      return empleadosDerivados;
    }
  }
  return base44.entities.Employee.list('-updated_date', 200);
}

// ── Registro push: una vez por sesión ───────────────────────────────────────
export const pushYaRegistrado = (userId) => {
  try { return sessionStorage.getItem(PUSH_KEY) === userId; } catch { return false; }
};
export const marcarPushRegistrado = (userId) => {
  try { sessionStorage.setItem(PUSH_KEY, userId); } catch { /* nada */ }
};