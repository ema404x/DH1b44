import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import QRScannerModal from '@/components/operario/QRScannerModal';
import { EVENTO_FICHAR_OPERARIO } from '@/lib/modoOperario';
import { useAbrirFichajeQR } from '@/hooks/useAbrirFichajeQR';
import FichajesPendientesAviso from '@/components/fichar-cuenta/FichajesPendientesAviso';
import JornadaAbiertaCard from '@/components/operario-home/JornadaAbiertaCard';

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

/**
 * Tarjeta "Fichaje" del Inicio operario. Si ya hay una entrada abierta muestra
 * la salida directa; si no, el escáner. "Fichar" de la barra inferior hace lo mismo.
 */
export default function FichajeCard() {
  const [scannerOpen, setScannerOpen] = useState(false);
  const abrirFichajeQR = useAbrirFichajeQR();
  const navigate = useNavigate();
  const online = useOnline();

  const { data } = useQuery({
    queryKey: ['fichar-cuenta', 'mi_estado'],
    queryFn: async () => (await base44.functions.invoke('ficharConCuenta', { action: 'mi_estado' })).data || {},
    enabled: online,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 60000,
    retry: false,
  });
  const conEstado = online && data?.ok === true;
  const abierta = conEstado ? data.abierta : null;

  const irASalida = () => navigate(`/fichar-cuenta?loc=${encodeURIComponent(abierta.location_qr_id)}`);
  const accionRef = useRef(null);
  accionRef.current = abierta ? irASalida : () => setScannerOpen(true);

  useEffect(() => {
    const abrir = () => accionRef.current();
    window.addEventListener(EVENTO_FICHAR_OPERARIO, abrir);
    return () => window.removeEventListener(EVENTO_FICHAR_OPERARIO, abrir);
  }, []);

  const handleResult = (result) => {
    if (result.type === 'fichaje') {
      abrirFichajeQR(result.value);
      return;
    }
    toast.error('Ese código no es de fichaje. Escaneá el QR de fichaje de la ubicación.');
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-lg shadow-black/10 acero-rise">
      {abierta ? (
        <JornadaAbiertaCard abierta={abierta} onSalida={irASalida} onEscanear={() => setScannerOpen(true)} />
      ) : (
        <>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15">
              <Clock className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-card-foreground">Fichaje</h2>
              <p className="text-sm text-muted-foreground">
                {conEstado ? 'Todavía no registraste tu entrada' : 'Escaneá el QR del lugar al llegar y al irte.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setScannerOpen(true)}
            className="mt-5 flex h-20 w-full items-center justify-center gap-3 rounded-2xl bg-primary text-xl font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-transform active:scale-[0.97]"
          >
            <ScanLine className="h-7 w-7" />
            {conEstado ? 'Escanear para fichar entrada' : 'Escanear para fichar'}
          </button>
        </>
      )}
      <div className="mt-4 empty:hidden"><FichajesPendientesAviso /></div>
      <QRScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onResult={handleResult} />
    </section>
  );
}