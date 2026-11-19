import React, { useEffect, useState } from 'react';
import { Clock, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import QRScannerModal from '@/components/operario/QRScannerModal';
import { irAFichajePublico, EVENTO_FICHAR_OPERARIO } from '@/lib/modoOperario';

/**
 * Tarjeta "Fichaje" del Inicio operario. Abre el escáner y, con un QR de
 * fichaje, lleva al fichaje actual (sin cambios de comportamiento).
 * "Fichar" de la barra inferior abre este mismo escáner.
 */
export default function FichajeCard() {
  const [scannerOpen, setScannerOpen] = useState(false);

  useEffect(() => {
    const abrir = () => setScannerOpen(true);
    window.addEventListener(EVENTO_FICHAR_OPERARIO, abrir);
    return () => window.removeEventListener(EVENTO_FICHAR_OPERARIO, abrir);
  }, []);

  const handleResult = (result) => {
    if (result.type === 'fichaje') {
      irAFichajePublico(result.value);
      return;
    }
    toast.error('Ese código no es de fichaje. Escaneá el QR de fichaje de la ubicación.');
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-lg shadow-black/10 acero-rise">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15">
          <Clock className="h-6 w-6 text-primary" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-card-foreground">Fichaje</h2>
          <p className="text-sm text-muted-foreground">Escaneá el QR del lugar al llegar y al irte.</p>
        </div>
      </div>
      <button
        onClick={() => setScannerOpen(true)}
        className="mt-5 flex h-20 w-full items-center justify-center gap-3 rounded-2xl bg-primary text-xl font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-transform active:scale-[0.97]"
      >
        <ScanLine className="h-7 w-7" />
        Escanear para fichar
      </button>
      <QRScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onResult={handleResult} />
    </section>
  );
}