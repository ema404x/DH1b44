import React from 'react';
import { usePermission } from '@/hooks/usePermission';
import { ShieldOff } from 'lucide-react';

/**
 * Envuelve una página protegiendo su acceso según permisos de rol.
 * Si el usuario no tiene permiso 'read' en el módulo, muestra pantalla de acceso denegado.
 *
 * @param {string} moduleKey - Clave del módulo en RolePermission
 * @param {React.ReactNode} children - Contenido de la página
 */
export default function ProtectedPage({ moduleKey, children }) {
  const { allowed, loading } = usePermission(moduleKey, 'read');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-7 h-7 border-4 border-border border-t-primary rounded-full animate-spin" />
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