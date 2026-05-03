import React, { useRef, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, PenTool, Trash2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function FirmaGerenteModal({ open, onClose, onFirmada, user }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [hasFirma, setHasFirma] = useState(false);
  const [nombre, setNombre] = useState(user?.full_name || '');
  const [uploading, setUploading] = useState(false);
  const lastPos = useRef(null);

  useEffect(() => {
    if (!open) return;
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      setHasFirma(false);
    }, 100);
  }, [open]);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    setDrawing(true);
    lastPos.current = getPos(e, canvas);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!drawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#1a3a6e';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPos.current = pos;
    setHasFirma(true);
  };

  const stopDraw = () => setDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasFirma(false);
  };

  const handleConfirm = async () => {
    if (!hasFirma) { toast.error('Dibujá tu firma antes de confirmar'); return; }
    if (!nombre.trim()) { toast.error('Ingresá tu nombre'); return; }
    setUploading(true);
    try {
      const canvas = canvasRef.current;
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
      const file = new File([blob], 'firma_gerente.png', { type: 'image/png' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onFirmada(file_url, nombre);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenTool className="h-4 w-4 text-primary" /> Firma Digital del Gerente
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase">Nombre del gerente</label>
            <Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre completo" />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase flex items-center justify-between">
              <span>Firma</span>
              {hasFirma && (
                <button onClick={clearCanvas} className="flex items-center gap-1 text-destructive hover:opacity-80 text-xs font-normal">
                  <Trash2 className="h-3 w-3" /> Limpiar
                </button>
              )}
            </label>
            <div className="border-2 border-dashed border-border rounded-lg overflow-hidden bg-white" style={{ touchAction: 'none' }}>
              <canvas
                ref={canvasRef}
                width={400}
                height={160}
                className="w-full cursor-crosshair"
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={stopDraw}
                onMouseLeave={stopDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={stopDraw}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">Dibujá tu firma con el mouse o con el dedo</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={uploading}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={uploading || !hasFirma} className="gap-2">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Confirmar y firmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}