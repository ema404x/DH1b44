/**
 * Configuración central de la experiencia móvil.
 *
 * Fuente única de verdad para:
 *  1. Qué módulos están optimizados para mobile (MOBILE_OPTIMIZED).
 *  2. Qué destinos primarios muestra la barra inferior según el rol (getRolePrimaries).
 *  3. En qué sección del drawer mobile cae cada módulo (getMobileSection).
 *  4. Metadatos de los módulos desktop-only para el aviso (DESKTOP_ONLY_META).
 *
 * Usado por MobileBottomNav, Sidebar (drawer mobile), AppLayout (slide/PTR
 * condicional) y DesktopOnlyGate. Mantener aquí para que los cuatro puntos
 * de control sean consistentes.
 */
import {
  LayoutDashboard, HardHat, ClipboardList, RefreshCw, AlertTriangle,
  BarChart2, FileCheck2, FileText, Building2,
} from 'lucide-react';
import { isFieldRole, isAdminLevelRole, normalizeRole } from '@/lib/roles';

/**
 * Mapa de optimización mobile por ruta.
 * true  = módulo mobile-optimized (slide + pull-to-refresh activos, se promueve en drawer).
 * false = módulo desktop-only (aviso "Optimizado para escritorio", sin slide/PTR).
 *
 * Basado en el PRD: Presupuestos, Inventario, Seguridad, Permisos,
 * Importar Datos, Calendario Informes son desktop-only. El resto mobile-optimized.
 */
export const MOBILE_OPTIMIZED = {
  '/': true,
  '/mis-ots': true,
  '/ordenes': true,
  '/rutinas': true,
  '/proyectos': true,
  '/emergencias': true,
  '/mapa': true,
  '/mapa-jefes': true,
  '/calendario': true,
  '/activos': true,
  '/informes': true,
  '/inspeccion-colegio': true,
  '/calefaccion': true,
  '/foro': true,
  '/sectores': true,
  '/reportes': true,
  '/auditoria': true,
  '/aprobacion-certificados': true,
  '/certificacion-obras': true,
  '/certificados': true,
  '/informacion-general': true,
  '/empleados': true,
  '/clientes': true,
  '/automatizaciones': true,
  '/alertas': true,
  '/control-riesgo': true,
  // Desktop-only:
  '/presupuestos-obra': false,
  '/inventario': false,
  '/seguridad': false,
  '/permisos': false,
  '/importar': false,
  '/calendario-informes': false,
};

/**
 * Metadatos de los módulos desktop-only para la pantalla de aviso.
 * path → { label, description }
 */
export const DESKTOP_ONLY_META = {
  '/presupuestos-obra': {
    label: 'Presupuestos de Obra',
    description: 'Editor de planilla PCP/PAPORC con grillas extensas y exportación Excel. Requiere pantalla amplia para una edición precisa.',
  },
  '/inventario': {
    label: 'Inventario',
    description: 'Gestión de materiales, movimientos y requerimientos con tablas densas. Optimizado para gestión de escritorio.',
  },
  '/seguridad': {
    label: 'Centro de Seguridad',
    description: 'Auditoría de sistema, backups encriptados y configuración avanzada. Operación administrativa de escritorio.',
  },
  '/permisos': {
    label: 'Control de Acceso',
    description: 'Matriz de permisos por rol y módulo. Edición detallada que requiere pantalla amplia.',
  },
  '/importar': {
    label: 'Importar Datos',
    description: 'Asistente de importación con mapeo de columnas y previsualización. Diseñado para escritorio.',
  },
  '/calendario-informes': {
    label: 'Calendario de Informes',
    description: 'Planificación de informes con vista de calendario extendida. Mejor experiencia en pantalla amplia.',
  },
  '/control-riesgo': {
    label: 'Control de Riesgos',
    description: 'Matriz de riesgos y controles con tablas detalladas. Optimizado para escritorio.',
  },
};

/**
 * Determina si una ruta está optimizada para mobile.
 * Maneja rutas dinámicas (/activos/:id) por prefijo.
 */
export function isMobileOptimized(path) {
  if (!path) return true;
  if (MOBILE_OPTIMIZED.hasOwnProperty(path)) return MOBILE_OPTIMIZED[path];
  // Rutas dinámicas: buscar el prefijo más largo que matchee.
  const prefixes = Object.keys(MOBILE_OPTIMIZED)
    .filter(k => k !== '/' && path.startsWith(k))
    .sort((a, b) => b.length - a.length);
  if (prefixes.length) return MOBILE_OPTIMIZED[prefixes[0]];
  // Default: mobile-optimized (no rompe la experiencia).
  return true;
}

/**
 * Clasifica al usuario en un perfil móvil para resolver su barra inferior.
 *   'admin'    → platform admin puro (sin ficha de empleado de campo/gerencia).
 *   'gerente'  → empleado con rol gerencia/gerente/administrativo.
 *   'operario' → empleado de campo (jefe_sitio, operario, inspector, etc.).
 *
 * Distingue gerente de admin: un gerente tiene employeeRole de gerencia;
 * un admin puro no tiene ficha de empleado (o tiene rol no-campo no-gerencia).
 */
export function getMobileRole(currentUser, employeeRole) {
  const empRole = normalizeRole(employeeRole);
  const platformAdmin = currentUser?.role === 'admin';

  // Campo → operario (incluso si platformRole=admin, ej: jefe_sitio con admin de plataforma).
  if (isFieldRole(empRole)) return 'operario';
  // Gerencia → gerente.
  if (empRole && ['gerente', 'gerencia', 'administrativo', 'gerente_general'].includes(empRole)) return 'gerente';
  if (currentUser?.role === 'gerente') return 'gerente';
  // Admin puro de plataforma sin rol de campo/gerencia.
  if (platformAdmin || isAdminLevelRole(empRole)) return 'admin';
  // Fallback: tratar como operario (acceso mínimo).
  return 'operario';
}

/**
 * Destinos primarios por rol para la barra inferior móvil (Material 3).
 * Máx 4 + botón "Más". El orden = prioridad visual.
 */
const PRIMARIES = {
  operario: [
    { label: 'Mis Órdenes', icon: HardHat, path: '/mis-ots', module: 'MisOrdenes', nonAdmin: true },
    { label: 'Órdenes', icon: ClipboardList, path: '/ordenes', module: 'WorkOrder' },
    { label: 'Rutinas', icon: RefreshCw, path: '/rutinas', module: 'Rutinas' },
    { label: 'Emergencias', icon: AlertTriangle, path: '/emergencias', module: 'Emergencias' },
  ],
  gerente: [
    { label: 'Órdenes', icon: ClipboardList, path: '/ordenes', module: 'WorkOrder' },
    { label: 'Reportes', icon: BarChart2, path: '/reportes', module: 'Reportes' },
    { label: 'Aprobación', icon: FileCheck2, path: '/aprobacion-certificados', module: 'AprobacionCertificados' },
    { label: 'Certificación', icon: FileCheck2, path: '/certificacion-obras', module: 'CertificacionObras' },
  ],
  admin: [
    { label: 'Órdenes', icon: ClipboardList, path: '/ordenes', module: 'WorkOrder' },
    { label: 'Reportes', icon: BarChart2, path: '/reportes', module: 'Reportes' },
    { label: 'Auditoría', icon: FileText, path: '/auditoria', module: 'AuditLog' },
    { label: 'Sectores', icon: Building2, path: '/sectores', module: 'Sectores' },
  ],
};

export function getRolePrimaries(role) {
  return PRIMARIES[role] || PRIMARIES.operario;
}

/**
 * Sección del drawer mobile en que cae un módulo.
 *   'operativos'  → módulos mobile-optimized operativos (arriba, íconos normales).
 *   'administracion' → módulos admin mobile-optimized (colapsable al medio).
 *   'desktop'     → módulos desktop-only (al final, ícono monitor, texto gris).
 */
const ADMIN_MOBILE_MODULES = new Set([
  '/auditoria', '/sectores', '/alertas', '/automatizaciones',
]);

export function getMobileSection(path) {
  if (!isMobileOptimized(path)) return 'desktop';
  if (ADMIN_MOBILE_MODULES.has(path)) return 'administracion';
  return 'operativos';
}