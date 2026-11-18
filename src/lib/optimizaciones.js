// Despliegue de Panel rápido, Órdenes rápidas y Arranque rápido.
//
// INTERRUPTOR GENERAL: con true, las tres mejoras quedan activas para todos
// los usuarios. Con false, todo vuelve a como estaba: cada mejora solo para
// quien tenga su campo (panel_rapido / ordenes_rapidas / arranque_rapido) en
// true. En ambos casos, optimizaciones_desactivadas = true en un usuario se
// las apaga a esa persona.
import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

export const OPTIMIZACIONES_PARA_TODOS = true;

const CAMPOS = { panel: 'panel_rapido', ordenes: 'ordenes_rapidas', arranque: 'arranque_rapido' };
export const NOMBRES_MEJORA = { panel: 'Panel rápido', ordenes: 'Órdenes rápidas', arranque: 'Arranque rápido' };

const campo = (user, k) => user?.[k] === true || user?.data?.[k] === true;

const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const clave = (tipo, userId, mejora) => `dh1-opt-${tipo}:${userId}:${mejora}`;
const esHoy = (tipo, userId, mejora) => {
  try { return localStorage.getItem(clave(tipo, userId, mejora)) === hoy(); } catch { return false; }
};
const marcarHoy = (tipo, userId, mejora) => {
  try { localStorage.setItem(clave(tipo, userId, mejora), hoy()); return true; } catch { return false; }
};

// ¿La mejora le corresponde a este usuario? (interruptor general o su campo)
export const mejoraHabilitada = (user, mejora) =>
  !!user && !campo(user, 'optimizaciones_desactivadas') &&
  (OPTIMIZACIONES_PARA_TODOS || campo(user, CAMPOS[mejora]));

// Habilitada y sin diferencias detectadas hoy en este dispositivo (la marca
// de "camino de siempre por hoy" solo la escribe la verificación silenciosa).
export const mejoraActiva = (user, mejora) =>
  mejoraHabilitada(user, mejora) && !esHoy('fallback', user.id, mejora);

export const datosUsuario = (user, employeeRole, employeeSector) => ({
  id: user?.id,
  email: user?.email || '',
  rol: employeeRole || user?.role || '',
  sector: user?.data?.sector_id || employeeSector || user?.sector_id || '',
});

// ── Verificación silenciosa (usuarios que no son admin) ─────────────────────
export const buenaConexion = () =>
  typeof navigator !== 'undefined' && navigator.onLine !== false && !navigator.connection?.saveData;

// Toma el turno del día para (usuario, mejora). false si ya se verificó hoy o
// si no se puede guardar la fecha (sin guardado no se verifica).
export const tomarTurnoHoy = (userId, mejora) =>
  !!userId && !esHoy('verif', userId, mejora) && marcarHoy('verif', userId, mejora);

// true a los 20 s de cargar, si hoy todavía no se verificó y la conexión es buena.
export function useTurnoVerificacion(userId, mejora, activo) {
  const [turno, setTurno] = useState(false);
  useEffect(() => {
    if (!activo || !userId) return undefined;
    const t = setTimeout(() => {
      if (!esHoy('verif', userId, mejora) && buenaConexion()) setTurno(true);
    }, 20000);
    return () => clearTimeout(t);
  }, [activo, userId, mejora]);
  return turno;
}

const texto = (v) => {
  if (v === null || v === undefined) return '';
  return (typeof v === 'object' ? JSON.stringify(v) : String(v)).slice(0, 300);
};

// Con diferencias: camino de siempre por el resto del día para ese usuario y
// esa mejora, y registro para que lo vea un administrador. Sin avisos.
export function reportarDiferencias(usuario, mejora, diferencias, filtro = '') {
  if (!usuario?.id || !diferencias?.length) return;
  marcarHoy('fallback', usuario.id, mejora);
  try {
    base44.entities.VerificacionOptimizacion.create({
      usuario_email: usuario.email,
      rol: usuario.rol,
      sector: usuario.sector,
      mejora,
      filtro,
      cantidad_diferencias: diferencias.length,
      detalle: diferencias.slice(0, 20).map((d) => ({
        campo: [d.item, d.id, d.valor ?? d.campo].filter(Boolean).join(' · '),
        valor_viejo: texto(d.viejo),
        valor_nuevo: texto(d.nuevo),
      })),
      fecha: new Date().toISOString(),
    }).catch(() => {});
  } catch { /* silencioso */ }
}

export const desdeHace7Dias = () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();