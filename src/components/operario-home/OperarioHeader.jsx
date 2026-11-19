import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useSectorConfig } from '@/hooks/useSectorConfig';

function resumenTexto(r) {
  if (!r) return 'Cargando tus OT…';
  const { paraHacer, enCurso } = r;
  if (!paraHacer && !enCurso) return 'No tenés OT pendientes';
  const partes = [];
  if (paraHacer) partes.push(`${paraHacer} OT para hacer`);
  if (enCurso) partes.push(`${enCurso} en curso`);
  return `Tenés ${partes.join(' y ')}`;
}

/** Tarjeta de saludo del Inicio operario. resumen: { paraHacer, enCurso } */
export default function OperarioHeader({ resumen }) {
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
  const nombre = (displayName || '').split(' ')[0] || displayName;

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
    <header className="flex flex-col gap-3 pt-1">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-cyan-600 to-blue-700 p-5 text-white shadow-xl shadow-primary/20">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 acero-drift" />
        <div className="relative flex items-start justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/80 truncate">{sector?.nombre || sectorId}</p>
          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${conectado ? 'bg-white/20 text-white' : 'bg-amber-300 text-amber-950'}`}>
            {conectado ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {conectado ? 'En línea' : 'Sin conexión'}
          </span>
        </div>
        <h1 className="relative mt-3 text-3xl font-bold leading-tight tracking-tight truncate">Hola, {nombre}</h1>
        <p className="relative mt-1 text-base font-medium text-white/90">{resumenTexto(resumen)}</p>
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