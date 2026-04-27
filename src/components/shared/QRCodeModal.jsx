import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Printer, Copy, Check } from 'lucide-react';

export default function QRCodeModal({ open, onClose, title, subtitle, value, logoText }) {
  const canvasRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [qrReady, setQrReady] = useState(false);

  // Use a ref callback so we render as soon as the canvas node is in the DOM
  const canvasCallbackRef = (node) => {
    if (!node) return;
    canvasRef.current = node;
    if (open && value) {
      setQrReady(false);
      QRCode.toCanvas(node, value, {
        width: 280,
        margin: 2,
        color: { dark: '#0a1628', light: '#ffffff' },
        errorCorrectionLevel: 'H',
      }).then(() => setQrReady(true)).catch(() => {});
    }
  };

  // Also re-render if value changes while dialog is already open
  useEffect(() => {
    if (!open || !value || !canvasRef.current) return;
    setQrReady(false);
    QRCode.toCanvas(canvasRef.current, value, {
      width: 280,
      margin: 2,
      color: { dark: '#0a1628', light: '#ffffff' },
      errorCorrectionLevel: 'H',
    }).then(() => setQrReady(true)).catch(() => {});
  }, [open, value]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create a larger canvas with label
    const exportCanvas = document.createElement('canvas');
    const padding = 24;
    const labelH = 80;
    exportCanvas.width = canvas.width + padding * 2;
    exportCanvas.height = canvas.height + padding * 2 + labelH;
    const ctx = exportCanvas.getContext('2d');

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // Border
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.roundRect(4, 4, exportCanvas.width - 8, exportCanvas.height - 8, 12);
    ctx.stroke();

    // Title
    ctx.fillStyle = '#0a1628';
    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title || '', exportCanvas.width / 2, padding + 20);

    // Subtitle
    if (subtitle) {
      ctx.fillStyle = '#64748b';
      ctx.font = '12px Inter, sans-serif';
      ctx.fillText(subtitle, exportCanvas.width / 2, padding + 40);
    }

    // QR
    ctx.drawImage(canvas, padding, padding + labelH / 2);

    // Bottom label
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px Inter, sans-serif';
    ctx.fillText('DH1 Software · Sistema de Gestión', exportCanvas.width / 2, exportCanvas.height - 10);

    const link = document.createElement('a');
    link.download = `QR_${(title || 'codigo').replace(/\s+/g, '_')}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
  };

  const handlePrint = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>QR - ${title}</title>
      <style>
        body { margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: Inter, sans-serif; background: #fff; }
        .card { border: 2px solid #e2e8f0; border-radius: 16px; padding: 24px; text-align: center; max-width: 320px; }
        h2 { margin: 0 0 4px; color: #0a1628; font-size: 18px; }
        p { margin: 0 0 16px; color: #64748b; font-size: 13px; }
        img { width: 240px; height: 240px; }
        .footer { margin-top: 12px; font-size: 10px; color: #94a3b8; }
      </style></head>
      <body><div class="card">
        <h2>${title || ''}</h2>
        ${subtitle ? `<p>${subtitle}</p>` : ''}
        <img src="${canvas.toDataURL()}" />
        <div class="footer">DH1 Software · Sistema de Gestión</div>
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
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Código QR</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          {/* QR Card */}
          <div className="bg-white border-2 border-border rounded-2xl p-5 shadow-sm flex flex-col items-center gap-2 w-full">
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
            <p className="text-[10px] text-muted-foreground/60 font-mono break-all text-center">{value}</p>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-3 gap-2 w-full">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleDownload}>
              <Download className="h-3.5 w-3.5" /> Descargar
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handlePrint}>
              <Printer className="h-3.5 w-3.5" /> Imprimir
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleCopy}>
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}