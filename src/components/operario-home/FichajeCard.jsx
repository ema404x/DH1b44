import React, { useState } from 'react';
import { Clock, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import QRScannerModal from '@/components/operario/QRScannerModal';
import { irAFichajePublico } from '@/lib/modoOperario';

/**
 * Tarjeta "Fichaje" del Inicio operario.
 * Toda la lógica del botón vive acá: hoy abre el escáner y, con un QR de fichaje,
 * lleva al fichaje actual. Para pasar al fichaje con cuenta alcanza con
 * reemplazar handleResult.
 */
export default function FichajeCard() {
  const [scannerOpen, setScannerOpen] = useState(false);

  const handleResult = (result) => {
    if (result.type === 'fichaje') {
      irAFichajePublico(result.value);
      return;
    }
    toast.error('Ese código no es de fichaje. Escaneá el QR de fichaje de la ubicación.');
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-lg shadow-black/10">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15">
          <Clock className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-card-foreground">Fichaje</h2>
          <p className="text-sm text-muted-foreground">Escaneá el QR de la ubicación para registrar entrada o salida.</p>
        </div>
      </div>
      <button
        onClick={() => setScannerOpen(true)}
        className="mt-5 flex h-16 w-full items-center justify-center gap-3 rounded-xl bg-primary text-lg font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-transform active:scale-[0.98]"
      >
        <ScanLine className="h-6 w-6" />
        Fichar
      </button>
      <QRScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onResult={handleResult} />
    </section>
  );
}