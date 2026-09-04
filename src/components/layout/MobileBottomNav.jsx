import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ClipboardList, LayoutGrid } from 'lucide-react';
import { motion, MotionConfig } from 'framer-motion';
import { useAuth } from '@/lib/AuthContext';
import { hasModulePermission } from '@/lib/roles';
import { cn } from '@/lib/utils';

/**
 * Barra inferior minimalista — estilo Upkeep/Google.
 * Un único destino operativo fijo (Órdenes) + botón "Más" que abre el drawer
 * simplificado con General, Emergencias y Operaciones.
 */
export default function MobileBottomNav({ onMore }) {
  const location = useLocation();
  const { user, userPermissions } = useAuth();

  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  // Órdenes es el destino operativo core. Si el usuario no tiene permiso de
  // lectura sobre WorkOrder, se oculta y queda solo el botón "Más".
  const canSeeOrdenes =
    user?.role === 'admin' ||
    !userPermissions ||
    hasModulePermission(userPermissions.WorkOrder, 'read', 'WorkOrder');

  const activeOrdenes = isActive('/ordenes');

  return (
    <MotionConfig reducedMotion="user">
      <nav
        className="lg:hidden fixed inset-x-0 bottom-0 z-40"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Navegación principal"
      >
        <div className="flex items-stretch border-t border-border bg-card/95 backdrop-blur-xl shadow-[0_-4px_20px_rgba(0,0,0,0.25)]">
          {canSeeOrdenes && (
            <Link
              to="/ordenes"
              aria-current={activeOrdenes ? 'page' : undefined}
              className="relative flex flex-1 flex-col items-center justify-center gap-1 py-2 min-h-[56px] select-none active:bg-muted/40 transition-colors"
            >
              <span className="relative flex h-9 w-16 items-center justify-center rounded-full">
                {activeOrdenes && (
                  <motion.span
                    layoutId="bottom-nav-pill"
                    className="absolute inset-0 rounded-full bg-primary/15"
                    transition={{ type: 'spring', stiffness: 480, damping: 32 }}
                  />
                )}
                <ClipboardList
                  className={cn(
                    'relative h-5 w-5 transition-all duration-200',
                    activeOrdenes ? 'text-primary scale-105' : 'text-muted-foreground'
                  )}
                />
              </span>
              <span
                className={cn(
                  'text-[10px] leading-none transition-colors',
                  activeOrdenes ? 'text-primary font-medium' : 'text-muted-foreground'
                )}
              >
                Órdenes
              </span>
            </Link>
          )}

          {/* Botón Más → abre el drawer con General, Emergencias y Operaciones */}
          <button
            onClick={onMore}
            aria-label="Más módulos"
            className="relative flex flex-1 flex-col items-center justify-center gap-1 py-2 min-h-[56px] select-none active:bg-muted/40 transition-colors"
          >
            <span className="relative flex h-9 w-16 items-center justify-center rounded-full">
              <LayoutGrid className="h-5 w-5 text-muted-foreground" />
            </span>
            <span className="text-[10px] leading-none text-muted-foreground">Más</span>
          </button>
        </div>
      </nav>
    </MotionConfig>
  );
}