import { ArrowLeft } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * MobileHeader — fixed top bar visible only on mobile.
 * Shows a Back button when not on the root path.
 */
export default function MobileHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const isRoot = location.pathname === '/';

  return (
    <header
      className="lg:hidden flex items-center px-3 border-b border-border bg-card/95 backdrop-blur-xl flex-shrink-0 z-30"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        height: 'calc(2.75rem + env(safe-area-inset-top))',
      }}
    >
      {!isRoot ? (
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 h-11 px-2 -ml-2 rounded-lg active:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm font-medium">Atrás</span>
        </button>
      ) : (
        <div className="flex items-center h-11 px-2">
          <span className="text-sm font-semibold text-foreground">DH1</span>
        </div>
      )}
    </header>
  );
}