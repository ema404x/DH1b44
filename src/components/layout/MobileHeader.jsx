import { ArrowLeft } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import GlobalSearch from './GlobalSearch';
import NotificationBell from './NotificationBell';
import UserMenu from './UserMenu';
import SectorSwitcher from './SectorSwitcher';

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
 * MobileHeader — única barra superior en móvil/tablet (<lg).
 * - Izquierda: marca en root, "Atrás" en subpáginas (único punto de toque arriba-izq,
 *   sin solapamiento con el drawer).
 * - Centro: título de la página (solo en subpáginas).
 * - Derecha: cambio de sector (admin), buscador, notificaciones y usuario — compactos.
 * El drawer de navegación se abre desde el botón "Más" de la barra inferior.
 */
export default function MobileHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const isRoot = location.pathname === '/';
  const title = getPageTitle(location.pathname);

  // Volver robusto: si hay historial previo en la app, retrocede; si no, va al inicio.
  const handleBack = () => {
    const st = window.history.state;
    if (st && typeof st.idx === 'number' && st.idx > 0) navigate(-1);
    else navigate('/');
  };

  return (
    <header
      className="lg:hidden relative flex items-center px-2 border-b border-border bg-card/95 backdrop-blur-xl flex-shrink-0 z-30"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        height: 'calc(2.75rem + env(safe-area-inset-top))',
      }}
    >
      {isRoot ? (
        <div className="flex items-center h-11 px-2 z-10">
          <span className="text-sm font-semibold text-foreground">DH1</span>
        </div>
      ) : (
        <button
          onClick={handleBack}
          aria-label="Volver"
          className="flex items-center gap-1.5 h-11 px-2 -ml-1 rounded-lg active:bg-muted transition-colors z-10"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm font-medium">Atrás</span>
        </button>
      )}

      {!isRoot && (
        <span className="absolute left-1/2 -translate-x-1/2 text-sm font-semibold text-foreground truncate max-w-[42%] pointer-events-none">
          {title}
        </span>
      )}

      <div className="flex items-center gap-0.5 ml-auto">
        <SectorSwitcher />
        <GlobalSearch variant="icon" />
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}