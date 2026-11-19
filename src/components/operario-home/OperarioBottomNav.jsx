import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, HardHat, ScanLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import UserMenu from '@/components/layout/UserMenu';
import { abrirEscanerOperario } from '@/lib/modoOperario';

const ITEM = 'relative flex flex-1 flex-col items-center justify-center gap-1.5 py-2.5 min-h-[56px] select-none active:bg-muted/40 transition-colors';
const LABEL = 'text-[11px] leading-none tracking-wide';

const LINKS = [
  { label: 'Inicio', icon: Home, path: '/operario' },
  { label: 'Mis OT', icon: HardHat, path: '/mis-ots' },
];

/** Barra inferior del Modo operario: Inicio, Mis OT, Escanear y Perfil. */
export default function OperarioBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  // El escáner vive en el portal del operario: si no está en pantalla, se abre desde Inicio.
  const escanear = () => {
    if (location.pathname === '/operario' || location.pathname === '/mis-ots') abrirEscanerOperario();
    else navigate('/operario', { state: { escanear: true } });
  };

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card shadow-[0_-4px_20px_rgba(0,0,0,0.25)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navegación del operario"
    >
      <div className="mx-auto flex max-w-3xl items-stretch">
        {LINKS.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} aria-current={active ? 'page' : undefined} className={ITEM}>
              <span className={cn('flex h-8 w-16 items-center justify-center rounded-full transition-colors', active && 'bg-primary/15')}>
                <item.icon className={cn('h-5 w-5', active ? 'text-primary' : 'text-muted-foreground')} />
              </span>
              <span className={cn(LABEL, active ? 'text-primary font-semibold' : 'text-muted-foreground')}>{item.label}</span>
            </Link>
          );
        })}
        <button onClick={escanear} className={ITEM}>
          <span className="flex h-8 w-16 items-center justify-center rounded-full">
            <ScanLine className="h-5 w-5 text-muted-foreground" />
          </span>
          <span className={cn(LABEL, 'text-muted-foreground')}>Escanear</span>
        </button>
        <UserMenu variant="nav" />
      </div>
    </nav>
  );
}