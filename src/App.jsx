import React, { Suspense, lazy } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AppLayout from '@/components/layout/AppLayout';

// Páginas públicas — se cargan inmediatamente (no requieren auth)
import Fichar from '@/pages/Fichar';
import FicharUbicacion from '@/pages/FicharUbicacion';
import OrdenTrabajoPublica from '@/pages/OrdenTrabajoPublica';
import EjecutarOrdenPublica from '@/pages/EjecutarOrdenPublica';

// Páginas autenticadas — lazy loading (se cargan solo cuando el usuario navega a ellas)
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Projects = lazy(() => import('@/pages/Projects'));
const WorkOrders = lazy(() => import('@/pages/WorkOrders'));
const Clients = lazy(() => import('@/pages/Clients'));
const Employees = lazy(() => import('@/pages/Employees'));
const Inventory = lazy(() => import('@/pages/Inventory'));
const Quotes = lazy(() => import('@/pages/Quotes'));
const Invoices = lazy(() => import('@/pages/Invoices'));
const Finanzas = lazy(() => import('@/pages/Finanzas'));
const Presupuestos = lazy(() => import('@/pages/Presupuestos'));
const Informes = lazy(() => import('@/pages/Informes'));
const Assets = lazy(() => import('@/pages/Assets'));
const Calendario = lazy(() => import('@/pages/Calendario'));
const Reportes = lazy(() => import('@/pages/Reportes'));
const Automatizaciones = lazy(() => import('@/pages/Automatizaciones'));
const Certificados = lazy(() => import('@/pages/Certificados'));
const Auditoria = lazy(() => import('@/pages/Auditoria'));
const Permisos = lazy(() => import('@/pages/Permisos'));
const Seguridad = lazy(() => import('@/pages/Seguridad'));
const Mapa = lazy(() => import('@/pages/Mapa'));
const Tutorial = lazy(() => import('@/pages/Tutorial'));
const ImportarDatos = lazy(() => import('@/pages/ImportarDatos'));
const ConfigAlertas = lazy(() => import('@/pages/ConfigAlertas'));
const InformacionGeneral = lazy(() => import('@/pages/InformacionGeneral'));
const Emergencias = lazy(() => import('@/pages/Emergencias'));
const MapaJefes = lazy(() => import('@/pages/MapaJefes'));
const InspeccionColegio = lazy(() => import('@/pages/InspeccionColegio'));
const AprobacionCertificados = lazy(() => import('@/pages/AprobacionCertificados'));
const ControlRiesgo = lazy(() => import('@/pages/ControlRiesgo'));
const CertificacionObras = lazy(() => import('@/pages/CertificacionObras'));

// Spinner de carga mientras se descarga la página lazy
const PageLoader = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm z-50">
    <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
  </div>
);

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="text-5xl">⚠️</div>
            <h1 className="text-xl font-bold">Ocurrió un error</h1>
            <p className="text-sm text-muted-foreground">{this.state.error?.message || 'Error inesperado'}</p>
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium">
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
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
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
        <Route path="/" element={<Dashboard />} />
        <Route path="/proyectos" element={<Projects />} />
        <Route path="/ordenes" element={<WorkOrders />} />
        <Route path="/clientes" element={<Clients />} />
        <Route path="/empleados" element={<Employees />} />
        <Route path="/inventario" element={<Inventory />} />
        <Route path="/presupuestos" element={<Quotes />} />
        <Route path="/presupuestos-obra" element={<Presupuestos />} />
        <Route path="/facturacion" element={<Invoices />} />
        <Route path="/finanzas" element={<Finanzas />} />
        <Route path="/informes" element={<Informes />} />
        <Route path="/activos" element={<Assets />} />
        <Route path="/calendario" element={<Calendario />} />
        <Route path="/reportes" element={<Reportes />} />
        <Route path="/automatizaciones" element={<Automatizaciones />} />
        <Route path="/certificados" element={<Certificados />} />
        <Route path="/auditoria" element={<Auditoria />} />
        <Route path="/permisos" element={<Permisos />} />
        <Route path="/seguridad" element={<Seguridad />} />
        <Route path="/mapa" element={<Mapa />} />
        <Route path="/tutorial" element={<Tutorial />} />
        <Route path="/importar" element={<ImportarDatos />} />
        <Route path="/alertas" element={<ConfigAlertas />} />
        <Route path="/informacion-general" element={<InformacionGeneral />} />
        <Route path="/emergencias" element={<Emergencias />} />
        <Route path="/mapa-jefes" element={<MapaJefes />} />
        <Route path="/inspeccion-colegio" element={<InspeccionColegio />} />
        <Route path="/aprobacion-certificados" element={<AprobacionCertificados />} />
        <Route path="/control-riesgo" element={<ControlRiesgo />} />
        <Route path="/certificacion-obras" element={<CertificacionObras />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </Suspense>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <Routes>
            {/* Rutas públicas — sin autenticación */}
            <Route path="/fichar" element={<Fichar />} />
            <Route path="/fichar-ubicacion" element={<FicharUbicacion />} />
            <Route path="/orden-trabajo" element={<OrdenTrabajoPublica />} />
            <Route path="/ejecutar-ot" element={<EjecutarOrdenPublica />} />
            {/* Rutas autenticadas */}
            <Route path="/*" element={
              <AuthProvider>
                <AuthenticatedApp />
                <Toaster />
              </AuthProvider>
            } />
          </Routes>
        </Router>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;