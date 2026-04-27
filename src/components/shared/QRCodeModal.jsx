import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Printer, Copy, Check } from 'lucide-react';

export default function QRCodeModal({ open, onClose, title, subtitle, value }) {
  const canvasRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [qrReady, setQrReady] = useState(false);

  const renderQR = (node) => {
    if (!node || !value) return;
    setQrReady(false);
    QRCode.toCanvas(node, value, {
      width: 220,
      margin: 2,
      color: { dark: '#0a1628', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).then(() => setQrReady(true)).catch(() => {});
  };

  // Ref callback — fires when canvas mounts inside the dialog
  const canvasCallbackRef = (node) => {
    if (!node) return;
    canvasRef.current = node;
    renderQR(node);
  };

  // Re-render if value changes while dialog stays open
  useEffect(() => {
    if (open && value && canvasRef.current) {
      renderQR(canvasRef.current);
    }
  }, [open, value]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `QR_${(title || 'codigo').replace(/\s+/g, '_')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handlePrint = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>QR - ${title}</title>
      <style>
        body { margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: sans-serif; background: #fff; }
        .card { border: 2px solid #e2e8f0; border-radius: 16px; padding: 24px; text-align: center; max-width: 300px; }
        h2 { margin: 0 0 4px; color: #0a1628; font-size: 18px; }
        p { margin: 0 0 16px; color: #64748b; font-size: 13px; }
        img { width: 200px; height: 200px; }
        .footer { margin-top: 12px; font-size: 10px; color: #94a3b8; }
      </style></head>
      <body><div class="card">
        <h2>${title || ''}</h2>
        ${subtitle ? `<p>${subtitle}</p>` : ''}
        <img src="${canvas.toDataURL()}" />
        <div class="footer">DH1 Software</div>
      </div></body></html>
    `);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-base">Código QR</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <div className="bg-white border-2 border-border rounded-2xl p-4 shadow-sm flex flex-col items-center gap-2 w-full">
            <p className="font-bold text-sm text-center text-foreground leading-tight">{title}</p>
            {subtitle && <p className="text-xs text-muted-foreground text-center">{subtitle}</p>}
            <div className="relative">
              <canvas ref={canvasCallbackRef} className="rounded-lg" />
              {!qrReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-white rounded-lg">
                  <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 w-full">
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={handleDownload}>
              <Download className="h-3.5 w-3.5" /> Bajar
            </Button>
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={handlePrint}>
              <Printer className="h-3.5 w-3.5" /> Imprimir
            </Button>
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={handleCopy}>
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Listo' : 'Copiar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}