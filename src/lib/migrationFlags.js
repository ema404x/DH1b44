/**
 * Feature flags centralizados para migraciones y switches seguros.
 * Lee desde localStorage (vía app-params pattern) con override por URL para QA.
 * Permite togglear comportamiento sin redeploy.
 *
 * Uso:
 *   import { isFlagEnabled, setFlag } from '@/lib/migrationFlags';
 *   if (isFlagEnabled('use_get_dashboard_metrics_v2')) { ... }
 *   setFlag('use_get_dashboard_metrics_v2', true);  // desde panel admin
 */

const PREFIX = 'base44_mflag_';

const toSnakeCase = (str) => str.replace(/([A-Z])/g, '_$1').toLowerCase();

const readUrlOverride = (flagName) => {
  if (typeof window === 'undefined') return null;
  const urlParams = new URLSearchParams(window.location.search);
  const raw = urlParams.get(`flag_${flagName}`);
  if (raw === '1' || raw === 'true') return 'true';
  if (raw === '0' || raw === 'false') return 'false';
  return null;
};

/**
 * Devuelve true si el flag está habilitado. Prioridad: URL override > localStorage > defaultValue.
 */
export function isFlagEnabled(flagName, defaultValue = false) {
  if (typeof window === 'undefined') return defaultValue;
  const urlOverride = readUrlOverride(toSnakeCase(flagName));
  if (urlOverride !== null) return urlOverride === 'true';
  const stored = window.localStorage.getItem(PREFIX + toSnakeCase(flagName));
  if (stored !== null) return stored === 'true';
  return defaultValue;
}

/**
 * Persiste el flag en localStorage. Toma efecto inmediato — el próximo render lo lee.
 */
export function setFlag(flagName, enabled) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PREFIX + toSnakeCase(flagName), enabled ? 'true' : 'false');
  // Notifica a los componentes suscritos para que re-rendericen
  window.dispatchEvent(new CustomEvent('migration-flag-changed', { detail: { flagName, enabled } }));
}

/**
 * Lista de flags conocidos con metadata para el panel admin.
 * Agregá acá cada flag nuevo al introducirlo.
 */
export const KNOWN_FLAGS = [
  {
    name: 'use_load_telemetry',
    label: 'Telemetría de carga de módulos',
    description: 'Trackea tiempos de carga vía analytics.track. 100% aditivo, no afecta lógica.',
    default: true,
  },
  {
    name: 'use_get_dashboard_metrics_v2',
    label: 'Dashboard Metrics V2 (agregación backend)',
    description: 'Usa la versión agregada de getDashboardMetrics cuando esté disponible. OFF por defecto hasta validar paridad.',
    default: false,
  },
  {
    name: 'use_ot_permissions_canonical',
    label: 'Permisos OT canónicos (unificado)',
    description: 'Que transicionEstadoOT use el módulo canónico de permisos. OFF hasta validar paridad.',
    default: false,
  },
];