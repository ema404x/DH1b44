import React from 'react';
import { usePermission } from '@/hooks/usePermission';
import { useAuth } from '@/lib/AuthContext';
import { ShieldOff, WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Envuelve una página protegiendo su acceso según permisos de rol.
 * Si el usuario no tiene permiso 'read' en el módulo, muestra pantalla de acceso denegado.
 *
 * @param {string} moduleKey - Clave del módulo en RolePermission (requerido)
 * @param {React.ReactNode} children - Contenido de la página
 */
export default function ProtectedPage({ moduleKey, children }) {
  const { allowed, loading, vinculationFailed } = usePermission(moduleKey, 'read');
  const { retryVinculation } = useAuth();

  // Validar que moduleKey sea proporcionado
  if (!moduleKey) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-6">
        <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <ShieldOff className="h-8 w-8 text-destructive" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Configuración incorrecta</h2>
          <p className="text-muted-foreground mt-1 text-sm max-w-sm">
            Esta página no está configurada correctamente. Contactá a un administrador.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-7 h-7 border-4 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (vinculationFailed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-6">
        <div className="h-16 w-16 rounded-2xl bg-amber-500/10 flex items-center justify-center">
          <WifiOff className="h-8 w-8 text-amber-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Error de conexión</h2>
          <p className="text-muted-foreground mt-1 text-sm max-w-sm">
            No se pudieron verificar tus permisos. Verificá tu conexión e intentá nuevamente.
          </p>
        </div>
        <Button onClick={retryVinculation} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" /> Reintentar
        </Button>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-6">
        <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <ShieldOff className="h-8 w-8 text-destructive" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Acceso denegado</h2>
          <p className="text-muted-foreground mt-1 text-sm max-w-sm">
            No tenés permiso para ver esta sección. Contactá a un administrador para solicitar acceso.
          </p>
        </div>
      </div>
    );
  }

  return children;
}