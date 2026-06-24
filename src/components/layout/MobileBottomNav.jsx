import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, RefreshCw, FolderKanban, LayoutGrid } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';

// Destinos primarios que siempre viven en la barra inferior (mobile-first, Material 3).
// El resto de módulos queda accesible vía el botón "Más" que abre el drawer.
const PRIMARY = [
  { label: 'Inicio', icon: LayoutDashboard, path: '/', module: 'Dashboard' },
  { label: 'Órdenes', icon: ClipboardList, path: '/ordenes', module: 'WorkOrder' },
  { label: 'Rutinas', icon: RefreshCw, path: '/rutinas', module: 'Rutinas' },
  { label: 'Proyectos', icon: FolderKanban, path: '/proyectos', module: 'Project' },
];

export default function MobileBottomNav({ onMore }) {
  const location = useLocation();
  const { user, userPermissions } = useAuth();

  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const allowed = (item) => {
    if (user?.role === 'admin') return true;
    if (!userPermissions) return item.path === '/';
    if (!item.module) return true;
    return userPermissions[item.module]?.read === true;
  };

  const items = PRIMARY.filter(allowed);

  return (
    <nav
      className="lg:hidden fixed inset-x-0 bottom-0 z-40"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navegación principal"
    >
      <div className="mx-auto max-w-md flex items-stretch border-t border-border bg-card/95 backdrop-blur-xl shadow-[0_-4px_20px_rgba(0,0,0,0.25)]">
        {items.map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-current={active ? 'page' : undefined}
              className="relative flex flex-1 flex-col items-center justify-center gap-1 py-1.5 min-h-[56px] select-none active:bg-muted/40 transition-colors"
            >
              <span
                className={cn(
                  'relative flex h-8 w-16 items-center justify-center rounded-full transition-colors',
                  active ? 'bg-primary/15' : 'bg-transparent'
                )}
              >
                <item.icon className={cn('h-5 w-5 transition-colors', active ? 'text-primary' : 'text-muted-foreground')} />
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
          className="relative flex flex-1 flex-col items-center justify-center gap-1 py-1.5 min-h-[56px] select-none active:bg-muted/40 transition-colors"
        >
          <span className="relative flex h-8 w-16 items-center justify-center rounded-full">
            <LayoutGrid className="h-5 w-5 text-muted-foreground" />
          </span>
          <span className="text-[10px] leading-none text-muted-foreground">Más</span>
        </button>
      </div>
    </nav>
  );
}