import React, { useState } from 'react';
import { QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import QRCodeModal from '@/components/shared/QRCodeModal';

export default function WorkOrderQRButton({ order, variant = 'ghost', size = 'icon' }) {
  const [open, setOpen] = useState(false);
  const url = `${window.location.origin}/orden-trabajo?ot=${order.id}`;

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        title="Ver QR de la orden"
        className={size === 'icon' ? 'h-7 w-7 text-primary hover:bg-primary/10' : 'gap-2'}
      >
        <QrCode className="h-3.5 w-3.5" />
        {size !== 'icon' && 'Ver QR'}
      </Button>

      <QRCodeModal
        open={open}
        onClose={() => setOpen(false)}
        title={order.title}
        subtitle={order.location || order.asset_name || `OT ${order.code || ''}`}
        value={url}
      />
    </>
  );
}