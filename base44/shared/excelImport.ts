// base44/shared/excelImport.ts
//
// Helpers compartidos para importers de Excel de Activos y similares.
// Extraídos de importarActivosExcel para reutilización en importarActivosBapro
// (y futuros importers) sin duplicar lógica.
//
// NUNCA re-implementar parseDate / mapEnum / findHeaderIndex en un importer:
// importar de aquí. normalizeName viene de locationSync.ts (canónico).

import { normalizeName } from './locationSync.ts';

// Mapeos de strings del Excel a enums del schema Asset.
export const TYPE_MAP = {
  'electrico': 'equipo_electrico', 'eléctrico': 'equipo_electrico', 'equipo_electrico': 'equipo_electrico',
  'mecanico': 'equipo_mecanico', 'mecánico': 'equipo_mecanico', 'equipo_mecanico': 'equipo_mecanico',
  'hvac': 'instalacion_hvac', 'climatizacion': 'instalacion_hvac', 'climatización': 'instalacion_hvac', 'instalacion_hvac': 'instalacion_hvac',
  'sanitario': 'instalacion_sanitaria', 'instalacion_sanitaria': 'instalacion_sanitaria', 'plomeria': 'instalacion_sanitaria',
  'estructura': 'estructura',
  'vehiculo': 'vehiculo', 'vehículo': 'vehiculo',
  'herramienta': 'herramienta',
  'informatico': 'sistemas_informaticos', 'informático': 'sistemas_informaticos', 'sistemas_informaticos': 'sistemas_informaticos', 'computacion': 'sistemas_informaticos',
  'mobiliario': 'mobiliario',
  'seguridad': 'seguridad',
  'otro': 'otro',
};
export const STATUS_MAP = {
  'operativo': 'operativo', 'operando': 'operativo', 'ok': 'operativo',
  'mantenimiento': 'en_mantenimiento', 'en_mantenimiento': 'en_mantenimiento', 'en mantenimiento': 'en_mantenimiento',
  'fuera_de_servicio': 'fuera_de_servicio', 'fuera de servicio': 'fuera_de_servicio', 'fuera servicio': 'fuera_de_servicio', 'roto': 'fuera_de_servicio',
  'baja': 'baja', 'dado de baja': 'baja',
};
export const CRIT_MAP = {
  'baja': 'baja', 'media': 'media', 'alta': 'alta', 'critica': 'critica', 'crítica': 'critica',
};
export const COMUNA_VALID = new Set(['8A', '8B', '10A']);

// Parsea fechas del Excel (Date JS, número serial Excel, ISO, DD/MM/YYYY).
export function parseDate(val) {
  if (!val || val === null) return null;
  if (val instanceof Date) return val.toISOString().split('T')[0];
  if (typeof val === 'number') {
    const daysOffset = val > 59 ? val - 1 : val;
    const date = new Date(Date.UTC(1899, 11, 31 + daysOffset));
    if (date.getTime() < 0) return null;
    return date.toISOString().split('T')[0];
  }
  const s = String(val).trim();
  if (!s) return null;
  const isoMatch = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  const dmyMatch = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10);
    const y = parseInt(dmyMatch[3], 10);
    if (d < 1 || d > 31 || m < 1 || m > 12 || y < 1900 || y > 2100) return null;
    return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
  return null;
}

// Mapea un valor del Excel a un enum via su map, con fallback.
export function mapEnum(value, map, fallback) {
  if (!value) return fallback;
  const k = normalizeName(value);
  if (map[k]) return map[k];
  const direct = String(value).toLowerCase().trim();
  return map[direct] || fallback;
}

// Encuentra el índice de columna por header normalizado (case/accent-insensitive).
export function findHeaderIndex(headers, candidates) {
  const norms = headers.map(h => normalizeName(h));
  for (const c of candidates) {
    const cn = normalizeName(c);
    const idx = norms.findIndex(n => n === cn);
    if (idx >= 0) return idx;
  }
  for (const c of candidates) {
    const cn = normalizeName(c);
    const idx = norms.findIndex(n => n && n.includes(cn));
    if (idx >= 0) return idx;
  }
  return -1;
}

// Localiza la fila de headers: la primera con varias celdas no vacías.
export function findHeaderRow(raw, maxScan = 5, minFilled = 3) {
  for (let i = 0; i < Math.min(raw.length, maxScan); i++) {
    const filled = (raw[i] || []).filter(c => c !== null && String(c).trim() !== '').length;
    if (filled >= minFilled) return i;
  }
  return 0;
}

// Re-export de normalizeName para que los importers lo resuelvan desde un
// solo módulo (el bundler no sigue re-exports transitivos implícitos).
export { normalizeName };

// Validación de host HTTPS para SSRF protection.
export function assertAllowedFileUrl(file_url) {
  const urlObj = new URL(file_url);
  if (urlObj.protocol !== 'https:') throw new Error('Solo HTTPS permitido');
  const ALLOWED_HOSTS = ['media.base44.com', 'storage.googleapis.com'];
  if (!ALLOWED_HOSTS.some(h => urlObj.hostname === h || urlObj.hostname.endsWith('.' + h))) {
    throw new Error('Dominio no permitido');
  }
}