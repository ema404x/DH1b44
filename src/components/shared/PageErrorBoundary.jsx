import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

// ErrorBoundary a nivel de página/ruta — aisla el fallo de UNA página para que
// un error en un módulo no blancoee toda la app. Muestra un panel de reintento
// con reload suave del estado de error. A diferencia del ErrorBoundary raíz
// (que recarga la app entera en chunk-stale), éste se enfoca en la sección
// afectada y permite al usuario reintentar sin perder el resto de la UI.
//
// Auto-recarga en errores de chunk stale (redeploy) igual que el raíz.
class PageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error) {
    if (error?.message?.includes('Failed to fetch dynamically imported module') ||
        error?.message?.includes('Importing a module script failed')) {
      window.location.reload();
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-4 bg-card border border-border rounded-2xl p-8 shadow-lg">
            <div className="mx-auto w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-7 w-7 text-destructive" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-foreground">Sección no disponible</h2>
              <p className="text-sm text-muted-foreground">
                {this.state.error?.message || 'Ocurrió un error inesperado en este módulo.'}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={this.handleRetry}
                className="inline-flex items-center gap-1.5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Reintentar
              </button>
              <button
                onClick={() => window.location.reload()}
                className="text-sm text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg border border-border hover:border-foreground/20 transition-colors"
              >
                Recargar página
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// HOC que envuelve un componente de página con el ErrorBoundary.
// Uso en App.jsx:  element={<ProtectedPage ...><PageErrorBoundary><Page /></PageErrorBoundary></ProtectedPage>}
export function withPageErrorBoundary(Component) {
  const Wrapped = (props) => (
    <PageErrorBoundary>
      <Component {...props} />
    </PageErrorBoundary>
  );
  Wrapped.displayName = `withPageErrorBoundary(${Component.displayName || Component.name || 'Component'})`;
  return Wrapped;
}

export default PageErrorBoundary;