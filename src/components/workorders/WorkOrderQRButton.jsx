import React from 'react';
import { QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Botón puro — NO monta QRCodeModal.
 * Llama onShowQR(order) para que el padre gestione el único modal compartido.
 */
export default function WorkOrderQRButton({ order, onShowQR, variant = 'ghost', size = 'icon' }) {
  return (
    <Button
      variant={variant}
      size={size}
      onClick={(e) => { e.stopPropagation(); onShowQR(order); }}
      title="Ver QR de la orden"
      className={size === 'icon' ? 'h-7 w-7 text-primary hover:bg-primary/10' : 'gap-2'}
    >
      <QrCode className="h-3.5 w-3.5" />
      {size !== 'icon' && 'Ver QR'}
    </Button>
  );
}