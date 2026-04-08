import React from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import Projects from '@/pages/Projects';
import WorkOrders from '@/pages/WorkOrders';
import Clients from '@/pages/Clients';
import Employees from '@/pages/Employees';
import Inventory from '@/pages/Inventory';
import Quotes from '@/pages/Quotes';
import Invoices from '@/pages/Invoices';
import Finanzas from '@/pages/Finanzas';
import Presupuestos from '@/pages/Presupuestos.jsx';
import Informes from '@/pages/Informes';
import Assets from '@/pages/Assets';
import Calendario from '@/pages/Calendario';
import Reportes from '@/pages/Reportes';
import Automatizaciones from '@/pages/Automatizaciones';
import Certificados from '@/pages/Certificados';
import Auditoria from '@/pages/Auditoria';
import Permisos from '@/pages/Permisos';
import Seguridad from '@/pages/Seguridad';
import Fichar from '@/pages/Fichar';
import FicharUbicacion from '@/pages/FicharUbicacion';
import Asistencia from '@/pages/Asistencia';

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
        <Route path="/asistencia" element={<Asistencia />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
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