import React, { Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { lazyPages } from '@/lib/lazyPages';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AppLayout from '@/components/layout/AppLayout';

// Páginas públicas — se cargan inmediatamente (no requieren auth)
import FicharUbicacion from '@/pages/FicharUbicacion';
import OrdenTrabajoPublica from '@/pages/OrdenTrabajoPublica';
import EjecutarOrdenPublica from '@/pages/EjecutarOrdenPublica';
import EjecutarOTSimplePublic from '@/pages/EjecutarOTSimple';
import PortalOperario from '@/pages/PortalOperario';
import PortalTablet from '@/pages/PortalTablet';
import RevisionBapro from '@/pages/RevisionBapro';
import Privacidad from '@/pages/Privacidad';

// Páginas autenticadas — lazy loading con prefetch en idle
// El mapa de pantallas vive en lib/lazyPages.js (lo comparte la precarga offline).
const {
  Dashboard, Projects, WorkOrders, Clients, Employees, Inventory, Invoices,
  Presupuestos, Informes, Assets, ActivoFicha, Calendario, Reportes,
  Automatizaciones, Certificados, Auditoria, Permisos, Seguridad, Mapa,
  Tutorial, ImportarDatos, ConfigAlertas, InformacionGeneral, Emergencias,
  MapaJefes, InspeccionColegio, AprobacionCertificados, ControlRiesgo,
  CertificacionObras, CalendarioInformes, CrearOT, Foro, Calefaccion,
  Sectores, Rutinas, PortalOperarioApp,
} = lazyPages;
import ProtectedPage from '@/components/shared/ProtectedPage';
import DesktopOnlyGate from '@/components/shared/DesktopOnlyGate';
import { isChunkLoadError, tryChunkReload } from '@/lib/chunkReload';

// Spinner de carga mientras se descarga la página lazy
const PageLoader = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm z-50">
    <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
  </div>
);

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error) {
    // Auto-recargar SOLO en errores de "chunk stale" (redeploy con módulos que
    // ya no existen) y como máximo una vez cada 60 s. Si no se permite, queda
    // la pantalla de error con el botón manual. Otros errores nunca recargan solos.
    if (isChunkLoadError(error)) {
      tryChunkReload();
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="text-5xl">⚠️</div>
            <h1 className="text-xl font-bold">Ocurrió un error</h1>
            <p className="text-sm text-muted-foreground">{this.state.error?.message || 'Error inesperado'}</p>
            <button
              onClick={() => {
                // Limpieza explícita del flag anti-loop + cache-busting.
                // El query param ?t=timestamp fuerza al navegador a pedir
                // módulos frescos (bypassa chunks stale cacheados por el
                // dev server tras un redeploy).
                window.location.href = window.location.pathname + '?t=' + Date.now();
              }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium"
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, isSlowConnection, checkAppState } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
        {isSlowConnection && (
          <>
            <p className="text-sm text-muted-foreground">La conexión está lenta…</p>
            <button
              onClick={() => checkAppState()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium"
            >
              Reintentar
            </button>
          </>
        )}
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<ProtectedPage moduleKey="Dashboard"><Dashboard /></ProtectedPage>} />
        <Route path="/proyectos" element={<ProtectedPage moduleKey="Project"><Projects /></ProtectedPage>} />
        <Route path="/ordenes" element={<ProtectedPage moduleKey="WorkOrder"><WorkOrders /></ProtectedPage>} />
        <Route path="/clientes" element={<ProtectedPage moduleKey="Client"><Clients /></ProtectedPage>} />
        <Route path="/empleados" element={<ProtectedPage moduleKey="Employee"><Employees /></ProtectedPage>} />
        <Route path="/inventario" element={<ProtectedPage moduleKey="Inventory"><DesktopOnlyGate path="/inventario"><Inventory /></DesktopOnlyGate></ProtectedPage>} />
        <Route path="/presupuestos-obra" element={<ProtectedPage moduleKey="PresupuestosObra"><DesktopOnlyGate path="/presupuestos-obra"><Presupuestos /></DesktopOnlyGate></ProtectedPage>} />
        <Route path="/facturacion" element={<ProtectedPage moduleKey="Invoice"><Invoices /></ProtectedPage>} />
        <Route path="/finanzas" element={<ProtectedPage moduleKey="Invoice"><Invoices /></ProtectedPage>} />
        <Route path="/informes" element={<ProtectedPage moduleKey="Informes"><Informes /></ProtectedPage>} />
        <Route path="/activos" element={<ProtectedPage moduleKey="Asset"><Assets /></ProtectedPage>} />
        <Route path="/activos/:id" element={<ProtectedPage moduleKey="Asset"><ActivoFicha /></ProtectedPage>} />
        <Route path="/calendario" element={<ProtectedPage moduleKey="Calendario"><Calendario /></ProtectedPage>} />
        <Route path="/reportes" element={<ProtectedPage moduleKey="Reportes"><Reportes /></ProtectedPage>} />
        <Route path="/automatizaciones" element={<ProtectedPage moduleKey="Automatizaciones"><Automatizaciones /></ProtectedPage>} />
        <Route path="/certificados" element={<ProtectedPage moduleKey="Certificado"><Certificados /></ProtectedPage>} />
        <Route path="/auditoria" element={<ProtectedPage moduleKey="AuditLog"><Auditoria /></ProtectedPage>} />
        <Route path="/permisos" element={<ProtectedPage moduleKey="Permisos"><DesktopOnlyGate path="/permisos"><Permisos /></DesktopOnlyGate></ProtectedPage>} />
        <Route path="/seguridad" element={<ProtectedPage moduleKey="Seguridad"><DesktopOnlyGate path="/seguridad"><Seguridad /></DesktopOnlyGate></ProtectedPage>} />
        <Route path="/mapa" element={<ProtectedPage moduleKey="Mapa"><Mapa /></ProtectedPage>} />
        <Route path="/tutorial" element={<Tutorial />} />
        <Route path="/importar" element={<ProtectedPage moduleKey="ImportarDatos"><DesktopOnlyGate path="/importar"><ImportarDatos /></DesktopOnlyGate></ProtectedPage>} />
        <Route path="/alertas" element={<ProtectedPage moduleKey="Alertas"><ConfigAlertas /></ProtectedPage>} />
        <Route path="/informacion-general" element={<ProtectedPage moduleKey="InformacionGeneral"><InformacionGeneral /></ProtectedPage>} />
        <Route path="/emergencias" element={<ProtectedPage moduleKey="Emergencias"><Emergencias /></ProtectedPage>} />
        <Route path="/mapa-jefes" element={<ProtectedPage moduleKey="MapaJefes"><MapaJefes /></ProtectedPage>} />
        <Route path="/inspeccion-colegio" element={<ProtectedPage moduleKey="InspeccionColegio"><InspeccionColegio /></ProtectedPage>} />
        <Route path="/aprobacion-certificados" element={<ProtectedPage moduleKey="AprobacionCertificados"><AprobacionCertificados /></ProtectedPage>} />
        <Route path="/control-riesgo" element={<ProtectedPage moduleKey="ControlRiesgo"><DesktopOnlyGate path="/control-riesgo"><ControlRiesgo /></DesktopOnlyGate></ProtectedPage>} />
        <Route path="/certificacion-obras" element={<ProtectedPage moduleKey="CertificacionObras"><CertificacionObras /></ProtectedPage>} />

        <Route path="/calendario-informes" element={<ProtectedPage moduleKey="Informes"><DesktopOnlyGate path="/calendario-informes"><CalendarioInformes /></DesktopOnlyGate></ProtectedPage>} />
        <Route path="/crear-ot" element={<ProtectedPage moduleKey="WorkOrder"><CrearOT /></ProtectedPage>} />
        <Route path="/foro" element={<ProtectedPage moduleKey="Foro"><Foro /></ProtectedPage>} />
        <Route path="/calefaccion" element={<ProtectedPage moduleKey="Calefaccion"><Calefaccion /></ProtectedPage>} />
        <Route path="/rutinas" element={<ProtectedPage moduleKey="Rutinas"><Rutinas /></ProtectedPage>} />
        <Route path="/sectores" element={<ProtectedPage moduleKey="Sectores"><Sectores /></ProtectedPage>} />
        <Route path="/mis-ots" element={<ProtectedPage moduleKey="MisOrdenes"><PortalOperarioApp /></ProtectedPage>} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </Suspense>
  );
};

const PUBLIC_QR_PATHS = new Set([
  '/fichar-ubicacion',
  '/fichar',
  '/ficharubicacion',
  '/fichar_ubicacion',
  '/orden-trabajo',
  '/ordentrabajo',
  '/ordentrabajopublica',
  '/ejecutar-ot',
  '/ejecutarot',
  '/ejecutarordenpublica',
  '/ejecutar-ot-simple',
  '/ejecutarotsimple',
  '/portal-operario',
  '/portaloperario',
  '/tablet',
  '/portaltablet',
]);

function LegacyRouteRedirect({ to }) {
  const { search, hash } = useLocation();
  return <Navigate to={`${to}${search || ''}${hash || ''}`} replace />;
}

function CanonicalPublicDomainRedirect() {
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const host = window.location.hostname.toLowerCase();
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    const pathLower = path.toLowerCase();
    const params = new URLSearchParams(window.location.search);
    const hasQrParams = Boolean(
      params.get('loc') || params.get('ubicacion') || params.get('location') || params.get('locationId') ||
      params.get('asset') || params.get('assetId') ||
      params.get('ot') || params.get('workOrderId') || params.get('orderId')
    );
    const isPublicQrRoute = PUBLIC_QR_PATHS.has(pathLower) || pathLower.startsWith('/revision-bapro/') || hasQrParams;
    const isNonCanonicalHost =
      host === 'www.dh1m.com' ||
      host === 'dh1-mejores.base44.app' ||
      ((host.endsWith('.base44.app') || host.includes('preview') || host.includes('sandbox')) && window.self === window.top);

    if (isPublicQrRoute && isNonCanonicalHost && host !== 'dh1m.com') {
      window.location.replace(`https://dh1m.com${path}${window.location.search}${window.location.hash}`);
    }
  }, []);
  return null;
}

function App() {
  return (
    <ErrorBoundary>
      <CanonicalPublicDomainRedirect />
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <Routes>
            {/* Rutas públicas — sin autenticación */}
            <Route path="/fichar-ubicacion" element={<FicharUbicacion />} />
            <Route path="/fichar" element={<LegacyRouteRedirect to="/fichar-ubicacion" />} />
            <Route path="/Fichar" element={<LegacyRouteRedirect to="/fichar-ubicacion" />} />
            <Route path="/FicharUbicacion" element={<LegacyRouteRedirect to="/fichar-ubicacion" />} />
            <Route path="/fichar_ubicacion" element={<LegacyRouteRedirect to="/fichar-ubicacion" />} />

            <Route path="/orden-trabajo" element={<OrdenTrabajoPublica />} />
            <Route path="/OrdenTrabajo" element={<LegacyRouteRedirect to="/orden-trabajo" />} />
            <Route path="/OrdenTrabajoPublica" element={<LegacyRouteRedirect to="/orden-trabajo" />} />
            <Route path="/orden_trabajo" element={<LegacyRouteRedirect to="/orden-trabajo" />} />

            <Route path="/ejecutar-ot" element={<EjecutarOrdenPublica />} />
            <Route path="/EjecutarOT" element={<LegacyRouteRedirect to="/ejecutar-ot" />} />
            <Route path="/EjecutarOrdenPublica" element={<LegacyRouteRedirect to="/ejecutar-ot" />} />
            <Route path="/ejecutar_ot" element={<LegacyRouteRedirect to="/ejecutar-ot" />} />

            <Route path="/ejecutar-ot-simple" element={<EjecutarOTSimplePublic />} />
            <Route path="/EjecutarOTSimple" element={<LegacyRouteRedirect to="/ejecutar-ot-simple" />} />
            <Route path="/ejecutar_ot_simple" element={<LegacyRouteRedirect to="/ejecutar-ot-simple" />} />

            <Route path="/portal-operario" element={<PortalOperario />} />
            <Route path="/PortalOperario" element={<LegacyRouteRedirect to="/portal-operario" />} />
            <Route path="/portal_operario" element={<LegacyRouteRedirect to="/portal-operario" />} />

            <Route path="/tablet" element={<PortalTablet />} />
            <Route path="/PortalTablet" element={<LegacyRouteRedirect to="/tablet" />} />

            <Route path="/revision-bapro/:token" element={<RevisionBapro />} />
            <Route path="/privacidad" element={<Privacidad />} />
            {/* Rutas autenticadas */}
            <Route path="/*" element={
              <AuthProvider>
                <AuthenticatedApp />
                <Toaster />
              </AuthProvider>
            } />
          </Routes>
        </Router>
        {/* Toaster de sonner — usado por PortalOperarioApp, AppLayout y otros.
            Sin este, todos los toast.success/error/info son silenciosos y el
            operario ve "se sale todo y ya" sin feedback al clickear una OT
            no accionable (en_progreso de otro / pendiente_validacion). */}
        <SonnerToaster position="top-center" richColors closeButton />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;