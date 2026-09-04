import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ClipboardList, AlertTriangle, HardHat, LayoutGrid } from 'lucide-react';
import { motion, MotionConfig } from 'framer-motion';
import { useAuth } from '@/lib/AuthContext';
import { hasModulePermission } from '@/lib/roles';
import { cn } from '@/lib/utils';

/**
 * Barra inferior minimalista — estilo Upkeep/Google.
 * 3 destinos operativos fijos (Órdenes, Emergencias, Mis Órdenes) + botón "Más"
 * que abre el drawer simplificado con General, Emergencias y Operaciones.
 */
const NAV_ITEMS = [
  { label: 'Órdenes', icon: ClipboardList, path: '/ordenes', module: 'WorkOrder' },
  { label: 'Emergencias', icon: AlertTriangle, path: '/emergencias', module: 'Emergencias' },
  { label: 'Mis Órdenes', icon: HardHat, path: '/mis-ots', module: 'MisOrdenes' },
];

export default function MobileBottomNav({ onMore }) {
  const location = useLocation();
  const { user, userPermissions } = useAuth();

  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const canSee = (moduleKey) =>
    user?.role === 'admin' ||
    !userPermissions ||
    hasModulePermission(userPermissions[moduleKey], 'read', moduleKey);

  const visibleItems = NAV_ITEMS.filter(item => canSee(item.module));

  return (
    <MotionConfig reducedMotion="user">
      <nav
        className="lg:hidden fixed inset-x-0 bottom-0 z-40"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Navegación principal"
      >
        <div className="flex items-stretch border-t border-border/60 bg-card/95 backdrop-blur-xl shadow-[0_-4px_20px_rgba(0,0,0,0.25)]">
          {visibleItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={active ? 'page' : undefined}
                className="relative flex flex-1 flex-col items-center justify-center gap-1.5 py-2.5 min-h-[56px] select-none active:bg-muted/40 transition-colors"
              >
                <span className="relative flex h-9 w-16 items-center justify-center rounded-full">
                  {active && (
                    <motion.span
                      layoutId="bottom-nav-pill"
                      className="absolute inset-0 rounded-full bg-primary/15"
                      transition={{ type: 'spring', stiffness: 480, damping: 32 }}
                    />
                  )}
                  <item.icon
                    className={cn(
                      'relative h-5 w-5 transition-all duration-200',
                      active ? 'text-primary scale-105' : 'text-muted-foreground'
                    )}
                  />
                </span>
                <span
                  className={cn(
                    'text-[10px] leading-none tracking-wide transition-colors truncate max-w-full px-1',
                    active ? 'text-primary font-semibold' : 'text-muted-foreground'
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}

          {/* Botón Más → abre el drawer con General, Emergencias y Operaciones */}
          <button
            onClick={onMore}
            aria-label="Más módulos"
            className="relative flex flex-1 flex-col items-center justify-center gap-1.5 py-2.5 min-h-[56px] select-none active:bg-muted/40 transition-colors"
          >
            <span className="relative flex h-9 w-16 items-center justify-center rounded-full">
              <LayoutGrid className="h-5 w-5 text-muted-foreground" />
            </span>
            <span className="text-[10px] leading-none tracking-wide text-muted-foreground">Más</span>
          </button>
        </div>
      </nav>
    </MotionConfig>
  );
}