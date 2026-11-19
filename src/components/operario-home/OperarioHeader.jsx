import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useSectorConfig } from '@/hooks/useSectorConfig';

function saludo() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

export default function OperarioHeader() {
  const navigate = useNavigate();
  const { user, offlineMode, setModoOperario } = useAuth();
  const { displayName } = useCurrentUser();
  const { sector, sectorId } = useSectorConfig();
  const [online, setOnline] = useState(navigator.onLine);
  const [saliendo, setSaliendo] = useState(false);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const conectado = online && !offlineMode;

  const salir = async () => {
    setSaliendo(true);
    try {
      await setModoOperario(false);
      navigate('/');
    } catch {
      toast.error('No se pudo salir del modo operario');
      setSaliendo(false);
    }
  };

  return (
    <header className="flex flex-col gap-4 pt-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {sector?.nombre || sectorId}
          </p>
          <h1 className="mt-1.5 text-[26px] leading-tight font-light tracking-tight text-foreground">
            {saludo()},
            <span className="block font-semibold truncate">{displayName}</span>
          </h1>
        </div>
        <span
          className={`mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
            conectado
              ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
              : 'border-amber-400/30 bg-amber-400/10 text-amber-300'
          }`}
        >
          {conectado ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {conectado ? 'En línea' : 'Sin conexión'}
        </span>
      </div>

      {user?.role === 'admin' && (
        <button
          onClick={salir}
          disabled={saliendo || offlineMode}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card/60 text-sm font-medium text-foreground transition-colors active:bg-accent disabled:opacity-50"
        >
          <LogOut className="h-4 w-4 text-muted-foreground" />
          Salir del modo operario
        </button>
      )}
    </header>
  );
}