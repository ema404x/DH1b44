import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, HardHat, ScanLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import UserMenu from '@/components/layout/UserMenu';
import { abrirFicharOperario } from '@/lib/modoOperario';

const ITEM = 'relative flex flex-1 flex-col items-center justify-center gap-1.5 py-2.5 min-h-[56px] select-none active:bg-muted/40 transition-colors';
const LABEL = 'text-[11px] leading-none tracking-wide';

function NavLink({ label, icon: Icon, path, active }) {
  return (
    <Link to={path} aria-current={active ? 'page' : undefined} className={ITEM}>
      <span className={cn('flex h-8 w-16 items-center justify-center rounded-full transition-colors', active && 'bg-primary/15')}>
        <Icon className={cn('h-5 w-5', active ? 'text-primary' : 'text-muted-foreground')} />
      </span>
      <span className={cn(LABEL, active ? 'text-primary font-semibold' : 'text-muted-foreground')}>{label}</span>
    </Link>
  );
}

/** Barra inferior del Modo operario: Inicio, Fichar, Mis OT y Perfil. */
export default function OperarioBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  // El escáner de fichaje vive en la tarjeta de Fichaje del Inicio.
  const fichar = () => {
    if (location.pathname === '/operario') abrirFicharOperario();
    else navigate('/operario', { state: { fichar: true } });
  };

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card shadow-[0_-4px_20px_rgba(0,0,0,0.25)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navegación del operario"
    >
      <div className="mx-auto flex max-w-3xl items-stretch">
        <NavLink label="Inicio" icon={Home} path="/operario" active={location.pathname === '/operario'} />
        <button onClick={fichar} className={ITEM}>
          <span className="flex h-8 w-16 items-center justify-center rounded-full">
            <ScanLine className="h-5 w-5 text-muted-foreground" />
          </span>
          <span className={cn(LABEL, 'text-muted-foreground')}>Fichar</span>
        </button>
        <NavLink label="Mis OT" icon={HardHat} path="/mis-ots" active={location.pathname === '/mis-ots'} />
        <UserMenu variant="nav" />
      </div>
    </nav>
  );
}