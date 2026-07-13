import { ArrowLeft } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const ROUTE_TITLES = {
  '/': 'Inicio',
  '/proyectos': 'Proyectos',
  '/ordenes': 'Órdenes',
  '/empleados': 'Empleados',
  '/inventario': 'Inventario',
  '/facturacion': 'Centro Financiero',
  '/finanzas': 'Finanzas',
  '/informes': 'Informes',
  '/activos': 'Pendientes',
  '/calendario': 'Calendario',
  '/reportes': 'Reportes & KPIs',
  '/certificados': 'Certificados',
  '/auditoria': 'Auditoría',
  '/permisos': 'Permisos',
  '/seguridad': 'Seguridad',
  '/mapa': 'Mapa de Ubicaciones',
  '/emergencias': 'Emergencias',
  '/foro': 'Foro',
  '/rutinas': 'Rutinas',
  '/sectores': 'Sectores',
  '/presupuestos-obra': 'Presupuestos Obra',
  '/crear-ot': 'Crear OT',
  '/mis-ots': 'Mis Órdenes',
  '/mapa-jefes': 'Mapa Jefes',
  '/inspeccion-colegio': 'Inspección',
  '/aprobacion-certificados': 'Aprobación',
  '/control-riesgo': 'Control de Riesgos',
  '/certificacion-obras': 'Certificación',
  '/calefaccion': 'Plan de Infraestructura',
  '/calendario-informes': 'Calendario Informes',
  '/importar': 'Importar Datos',
  '/alertas': 'Alertas',
  '/informacion-general': 'Información General',
  '/automatizaciones': 'Automatizaciones',
  '/tutorial': 'Tutorial',
  '/clientes': 'Proveedores',
};

function getPageTitle(pathname) {
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];
  const sortedRoutes = Object.keys(ROUTE_TITLES)
    .filter((r) => r !== '/')
    .sort((a, b) => b.length - a.length);
  for (const route of sortedRoutes) {
    if (pathname.startsWith(route)) return ROUTE_TITLES[route];
  }
  return 'DH1';
}

/**
 * MobileHeader — fixed top bar visible only on mobile.
 * Shows a Back button when not on the root path, with the
 * current page title centered.
 */
export default function MobileHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const isRoot = location.pathname === '/';
  const title = getPageTitle(location.pathname);

  return (
    <header
      className="lg:hidden relative flex items-center px-3 border-b border-border bg-card/95 backdrop-blur-xl flex-shrink-0 z-30"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        height: 'calc(2.75rem + env(safe-area-inset-top))',
      }}
    >
      {!isRoot ? (
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 h-11 px-2 -ml-2 rounded-lg active:bg-muted transition-colors z-10"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm font-medium">Atrás</span>
        </button>
      ) : (
        <div className="flex items-center h-11 px-2 z-10">
          <span className="text-sm font-semibold text-foreground">DH1</span>
        </div>
      )}
      <span className="absolute left-1/2 -translate-x-1/2 text-sm font-semibold text-foreground truncate max-w-[55%] pointer-events-none">
        {title}
      </span>
    </header>
  );
}