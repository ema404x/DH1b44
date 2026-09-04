import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';
import { motion, MotionConfig } from 'framer-motion';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { cn } from '@/lib/utils';
import { hasModulePermission } from '@/lib/roles';
import { getMobileRole, getRolePrimaries } from '@/lib/mobileModuleConfig';

// Destinos primarios resueltos dinámicamente según el rol del usuario
// (operario / gerente / admin). El resto de módulos queda accesible vía el
// botón "Más" que abre el drawer reorganizado en 3 secciones.

export default function MobileBottomNav({ onMore }) {
  const location = useLocation();
  const { currentUser, isSuperAdmin, userPermissions, employeeRole } = useCurrentUser();

  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const mobileRole = getMobileRole(currentUser, employeeRole);

  const allowed = (item) => {
    // nonAdmin oculta el item a admins puros (usan el módulo admin completo),
    // pero para no-admins sigue sujeto al permiso del módulo.
    if (item.nonAdmin && mobileRole === 'admin') return false;
    if (isSuperAdmin) return true;
    if (!userPermissions) return item.path === '/' || !!item.nonAdmin;
    if (!item.module) return true;
    return hasModulePermission(userPermissions[item.module], 'read', item.module);
  };

  // Máx 4 destinos + "Más" para no comprimir en pantallas chicas.
  const items = getRolePrimaries(mobileRole).filter(allowed).slice(0, 4);

  return (
    <MotionConfig reducedMotion="user">
    <nav
      className="lg:hidden fixed inset-x-0 bottom-0 z-40"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navegación principal"
    >
      <div className="flex items-stretch border-t border-border bg-card/95 backdrop-blur-xl shadow-[0_-4px_20px_rgba(0,0,0,0.25)]">
        {items.map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-current={active ? 'page' : undefined}
              className="relative flex flex-1 flex-col items-center justify-center gap-1 py-2 min-h-[56px] select-none active:bg-muted/40 transition-colors"
            >
              <span className="relative flex h-9 w-16 items-center justify-center rounded-full">
                {active && (
                  <motion.span
                    layoutId="bottom-nav-pill"
                    className="absolute inset-0 rounded-full bg-primary/15"
                    transition={{ type: 'spring', stiffness: 480, damping: 32 }}
                  />
                )}
                <item.icon className={cn('relative h-5 w-5 transition-all duration-200', active ? 'text-primary scale-105' : 'text-muted-foreground')} />
              </span>
              <span
                className={cn(
                  'text-[10px] leading-none transition-colors',
                  active ? 'text-primary font-medium' : 'text-muted-foreground'
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* Botón Más → abre el drawer con todos los módulos */}
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