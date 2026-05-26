import React, { useRef, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, PenTool, Trash2, CheckCircle2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function FirmaGerenteModal({ open, onClose, onFirmada, user }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [hasFirma, setHasFirma] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [redibujar, setRedibujar] = useState(false);
  const lastPos = useRef(null);

  // Cargar firma guardada del empleado
  const { data: empleados = [], isLoading: loadingFirma } = useQuery({
    queryKey: ['employee-firma', user?.email],
    queryFn: () => base44.entities.Employee.filter({ email: user?.email }),
    enabled: !!user?.email && open,
  });

  const empleado = empleados[0];
  const firmaGuardada = empleado?.firma_url;
  const mostrarCanvas = !firmaGuardada || redibujar;

  // Limpiar canvas al abrir
  useEffect(() => {
    if (!open) { setRedibujar(false); return; }
    if (!mostrarCanvas) return;
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      setHasFirma(false);
    }, 100);
  }, [open, mostrarCanvas]);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e) => { e.preventDefault(); setDrawing(true); lastPos.current = getPos(e, canvasRef.current); };
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
    setUploading(true);
    try {
      let firmaUrl = firmaGuardada;

      if (mostrarCanvas) {
        if (!hasFirma) { toast.error('Dibujá tu firma antes de confirmar'); setUploading(false); return; }
        const canvas = canvasRef.current;
        const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
        const file = new File([blob], 'firma_gerente.png', { type: 'image/png' });
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        firmaUrl = file_url;

        // Guardar la nueva firma en el empleado para la próxima vez
        if (empleado?.id) {
          await base44.entities.Employee.update(empleado.id, { firma_url: firmaUrl });
        }
      }

      onFirmada(firmaUrl, user?.full_name || user?.email);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenTool className="h-4 w-4 text-primary" /> Confirmar aprobación
          </DialogTitle>
        </DialogHeader>

        {loadingFirma ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Firma guardada */}
            {firmaGuardada && !redibujar ? (
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase">Tu firma registrada</p>
                <div className="border rounded-lg bg-white p-3 flex items-center justify-center">
                  <img src={firmaGuardada} alt="Firma guardada" className="h-20 object-contain" />
                </div>
                <button
                  onClick={() => setRedibujar(true)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <RefreshCw className="h-3 w-3" /> Usar una firma diferente
                </button>
              </div>
            ) : (
              /* Canvas para dibujar */
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground uppercase">
                    {firmaGuardada ? 'Dibujá una nueva firma' : 'Dibujá tu firma'}
                  </label>
                  <div className="flex items-center gap-2">
                    {hasFirma && (
                      <button onClick={clearCanvas} className="flex items-center gap-1 text-destructive hover:opacity-80 text-xs">
                        <Trash2 className="h-3 w-3" /> Limpiar
                      </button>
                    )}
                    {firmaGuardada && (
                      <button onClick={() => setRedibujar(false)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                        ← Usar firma guardada
                      </button>
                    )}
                  </div>
                </div>
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
                <p className="text-[10px] text-muted-foreground">
                  {firmaGuardada ? 'Esta nueva firma reemplazará la guardada.' : 'Esta firma quedará guardada para futuras aprobaciones.'}
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={uploading}>Cancelar</Button>
          <Button
            onClick={handleConfirm}
            disabled={uploading || loadingFirma || (mostrarCanvas && !hasFirma)}
            className="gap-2"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Aprobar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}