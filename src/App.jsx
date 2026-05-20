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
import ProtectedPage from '@/components/shared/ProtectedPage';

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
        <Route path="/" element={<ProtectedPage moduleKey="Dashboard"><Dashboard /></ProtectedPage>} />
        <Route path="/proyectos" element={<ProtectedPage moduleKey="Project"><Projects /></ProtectedPage>} />
        <Route path="/ordenes" element={<ProtectedPage moduleKey="WorkOrder"><WorkOrders /></ProtectedPage>} />
        <Route path="/clientes" element={<ProtectedPage moduleKey="Client"><Clients /></ProtectedPage>} />
        <Route path="/empleados" element={<ProtectedPage moduleKey="Employee"><Employees /></ProtectedPage>} />
        <Route path="/inventario" element={<ProtectedPage moduleKey="Inventory"><Inventory /></ProtectedPage>} />
        <Route path="/presupuestos" element={<ProtectedPage moduleKey="Quote"><Quotes /></ProtectedPage>} />
        <Route path="/presupuestos-obra" element={<ProtectedPage moduleKey="PresupuestosObra"><Presupuestos /></ProtectedPage>} />
        <Route path="/facturacion" element={<ProtectedPage moduleKey="Invoice"><Invoices /></ProtectedPage>} />
        <Route path="/finanzas" element={<ProtectedPage moduleKey="Finanzas"><Finanzas /></ProtectedPage>} />
        <Route path="/informes" element={<ProtectedPage moduleKey="Informes"><Informes /></ProtectedPage>} />
        <Route path="/activos" element={<ProtectedPage moduleKey="Asset"><Assets /></ProtectedPage>} />
        <Route path="/calendario" element={<ProtectedPage moduleKey="Calendario"><Calendario /></ProtectedPage>} />
        <Route path="/reportes" element={<ProtectedPage moduleKey="Reportes"><Reportes /></ProtectedPage>} />
        <Route path="/automatizaciones" element={<ProtectedPage moduleKey="Automatizaciones"><Automatizaciones /></ProtectedPage>} />
        <Route path="/certificados" element={<ProtectedPage moduleKey="Certificado"><Certificados /></ProtectedPage>} />
        <Route path="/auditoria" element={<ProtectedPage moduleKey="AuditLog"><Auditoria /></ProtectedPage>} />
        <Route path="/permisos" element={<ProtectedPage moduleKey="Permisos"><Permisos /></ProtectedPage>} />
        <Route path="/seguridad" element={<ProtectedPage moduleKey="Seguridad"><Seguridad /></ProtectedPage>} />
        <Route path="/mapa" element={<ProtectedPage moduleKey="Mapa"><Mapa /></ProtectedPage>} />
        <Route path="/tutorial" element={<Tutorial />} />
        <Route path="/importar" element={<ProtectedPage moduleKey="ImportarDatos"><ImportarDatos /></ProtectedPage>} />
        <Route path="/alertas" element={<ProtectedPage moduleKey="Alertas"><ConfigAlertas /></ProtectedPage>} />
        <Route path="/informacion-general" element={<ProtectedPage moduleKey="InformacionGeneral"><InformacionGeneral /></ProtectedPage>} />
        <Route path="/emergencias" element={<ProtectedPage moduleKey="Emergencias"><Emergencias /></ProtectedPage>} />
        <Route path="/mapa-jefes" element={<ProtectedPage moduleKey="MapaJefes"><MapaJefes /></ProtectedPage>} />
        <Route path="/inspeccion-colegio" element={<ProtectedPage moduleKey="InspeccionColegio"><InspeccionColegio /></ProtectedPage>} />
        <Route path="/aprobacion-certificados" element={<ProtectedPage moduleKey="AprobacionCertificados"><AprobacionCertificados /></ProtectedPage>} />
        <Route path="/control-riesgo" element={<ProtectedPage moduleKey="ControlRiesgo"><ControlRiesgo /></ProtectedPage>} />
        <Route path="/certificacion-obras" element={<ProtectedPage moduleKey="CertificacionObras"><CertificacionObras /></ProtectedPage>} />
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