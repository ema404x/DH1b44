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
  [VINCULO_KEY, ESTADO_KEY, PUSH_KEY].forEach(quitar);
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

// ── vincularEmpleado: una llamada real por sesión (el resultado vale 30 min) ─
let vinculoEnCurso = null;
let vinculoPedido = false;
let vinculoDeGuardado = false;

export const leerVinculo = (userId) => {
  const v = leer(VINCULO_KEY);
  return v && v.userId === userId && Date.now() - v.savedAt < VINCULO_MAX_MS ? v.data : null;
};
export const borrarVinculo = () => quitar(VINCULO_KEY);
// true si esta carga de página pintó con el resultado guardado (sin llamar).
export const vinculoVinoDeGuardado = () => vinculoDeGuardado;

export function obtenerVinculo(userId) {
  const guardado = leerVinculo(userId);
  if (guardado) {
    if (!vinculoPedido) vinculoDeGuardado = true;
    return Promise.resolve(guardado);
  }
  if (!vinculoEnCurso) {
    vinculoPedido = true;
    vinculoDeGuardado = false;
    vinculoEnCurso = base44.functions.invoke('vincularEmpleado', {})
      .then((r) => {
        const data = r?.data || null;
        if (data && data.linked !== undefined) guardar(VINCULO_KEY, { userId, data, savedAt: Date.now() });
        return data;
      })
      .finally(() => { vinculoEnCurso = null; });
  }
  return vinculoEnCurso;
}

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