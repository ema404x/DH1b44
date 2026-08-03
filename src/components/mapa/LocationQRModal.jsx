import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { Download, Copy, Check, ClipboardList, Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

/**
 * Deriva la URL base de la app desde el pathname actual.
 * Ej: /apps/myapp/mapa → /apps/myapp  |  /mapa → (vacío)
 */
function getAppBaseUrl() {
  const path = window.location.pathname.replace(/\/$/, '');
  const segments = path.split('/').filter(Boolean);
  segments.pop(); // quitar el último segmento (ruta actual)
  return segments.length > 0 ? '/' + segments.join('/') : '';
}

const STATUS_CONFIG = {
  pendiente: { label: 'Pendiente', cls: 'bg-slate-500/15 text-slate-400 border-slate-500/30', icon: Clock },
  asignada: { label: 'Asignada', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30', icon: ClipboardList },
  en_progreso: { label: 'En Progreso', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30', icon: Loader2 },
  obra: { label: 'En Obra', cls: 'bg-orange-500/15 text-orange-400 border-orange-500/30', icon: AlertCircle },
  pendiente_validacion: { label: 'Pend. Validación', cls: 'bg-purple-500/15 text-purple-400 border-purple-500/30', icon: Clock },
  completada: { label: 'Completada', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 },
  cancelada: { label: 'Cancelada', cls: 'bg-red-500/15 text-red-400 border-red-500/30', icon: AlertCircle },
};

export default function LocationQRModal({ open, onClose, location }) {
  const canvasRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [qrReady, setQrReady] = useState(false);
  const [workOrders, setWorkOrders] = useState([]);
  const [isLoadingOTs, setIsLoadingOTs] = useState(false);

  const qrValue = location ? `${window.location.origin}${getAppBaseUrl()}/portal-operario?loc=${location.id}` : '';

  // Cargar OTs de la ubicación via backend (service role, sin RLS)
  useEffect(() => {
    if (!open || !location) return;
    let cancelled = false;
    setIsLoadingOTs(true);
    setWorkOrders([]);
    base44.functions.invoke('publicFichar', {
      action: 'getWorkOrderForLocation',
      locationId: location.id,
    }).then(res => {
      if (cancelled) return;
      setWorkOrders(res.data?.workOrders || []);
    }).catch(() => {
      if (!cancelled) setWorkOrders([]);
    }).finally(() => {
      if (!cancelled) setIsLoadingOTs(false);
    });
    return () => { cancelled = true; };
  }, [open, location]);

  useEffect(() => {
    if (!open || !qrValue) return;
    setQrReady(false);
    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      QRCode.toCanvas(canvas, qrValue, {
        width: 200, margin: 2,
        color: { dark: '#0a1628', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      }).then(() => setQrReady(true)).catch(() => {});
    }, 100);
    return () => clearTimeout(timer);
  }, [open, qrValue]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `QR_${(location?.name || 'codigo').replace(/\s+/g, '_')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(qrValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!open || !location) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            QR · {location.name}
          </DialogTitle>
        </DialogHeader>

        {/* QR code section */}
        <div className="flex flex-col items-center gap-3 py-1">
          <div className="bg-white border-2 border-border rounded-2xl p-4 shadow-sm flex flex-col items-center gap-2">
            <p className="font-bold text-sm text-center text-foreground leading-tight">{location.name}</p>
            {location.address && <p className="text-xs text-muted-foreground text-center">{location.address}</p>}
            <div className="relative" style={{ minWidth: 200, minHeight: 200 }}>
              <canvas ref={canvasRef} className="rounded-lg" />
              {!qrReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-white rounded-lg">
                  <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 w-full">
            <Button variant="outline" size="sm" className="gap-1 text-xs flex-1" onClick={handleDownload}>
              <Download className="h-3.5 w-3.5" /> Descargar
            </Button>
            <Button variant="outline" size="sm" className="gap-1 text-xs flex-1" onClick={handleCopy}>
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Listo' : 'Copiar URL'}
            </Button>
          </div>
        </div>

        {/* OTs list section */}
        <div className="border-t border-border pt-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold flex items-center gap-1.5">
              <ClipboardList className="h-3.5 w-3.5 text-primary" />
              OTs de esta ubicación
            </h4>
            <Badge variant="secondary" className="text-[10px]">
              {isLoadingOTs ? '…' : `${workOrders.length} total`}
            </Badge>
          </div>

          {isLoadingOTs ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : workOrders.length === 0 ? (
            <div className="text-center py-6 text-xs text-muted-foreground">
              No hay OTs generadas para esta ubicación
            </div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {workOrders.map(ot => {
                const cfg = STATUS_CONFIG[ot.status] || STATUS_CONFIG.pendiente;
                const Icon = cfg.icon;
                return (
                  <div key={ot.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 border border-border/50">
                    <div className={`flex-shrink-0 h-7 w-7 rounded-md flex items-center justify-center ${cfg.cls}`}>
                      <Icon className={`h-3.5 w-3.5 ${ot.status === 'en_progreso' ? 'animate-spin' : ''}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{ot.title}</p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        {ot.code && <span className="font-mono">{ot.code}</span>}
                        {ot.assigned_name && <span>· {ot.assigned_name}</span>}
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 border ${cfg.cls}`}>
                      {cfg.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}