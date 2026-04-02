import React, { useRef, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PenTool, Trash2, Check, Loader2 } from 'lucide-react';

export default function WorkOrderSignature({ signatureUrl, signatureName, onChange }) {
  const canvasRef = useRef();
  const [drawing, setDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [name, setName] = useState(signatureName || '');
  const [saving, setSaving] = useState(false);
  const lastPos = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
  }, []);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };

  const startDraw = (e) => {
    e.preventDefault();
    setDrawing(true);
    lastPos.current = getPos(e, canvasRef.current);
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
    ctx.stroke();
    lastPos.current = pos;
    setHasDrawn(true);
  };

  const stopDraw = () => setDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onChange({ signatureUrl: null, signatureName: name });
  };

  const saveSignature = async () => {
    if (!hasDrawn) return;
    setSaving(true);
    const canvas = canvasRef.current;
    canvas.toBlob(async (blob) => {
      const file = new File([blob], 'firma.png', { type: 'image/png' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onChange({ signatureUrl: file_url, signatureName: name });
      setSaving(false);
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <PenTool className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Firma Digital</span>
      </div>

      {signatureUrl ? (
        <div className="space-y-2">
          <div className="border border-border rounded-lg p-3 bg-muted/20">
            <img src={signatureUrl} alt="Firma" className="max-h-24 object-contain" />
            {signatureName && <p className="text-xs text-muted-foreground mt-1">Firmado por: {signatureName}</p>}
          </div>
          <Button variant="outline" size="sm" className="gap-2 text-destructive" onClick={() => onChange({ signatureUrl: null, signatureName: '' })}>
            <Trash2 className="h-3.5 w-3.5" /> Borrar firma
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Input placeholder="Nombre del firmante" value={name} onChange={e => setName(e.target.value)} className="text-sm" />
          <div className="border-2 border-dashed border-border rounded-lg overflow-hidden">
            <canvas
              ref={canvasRef}
              width={400}
              height={120}
              className="w-full touch-none cursor-crosshair"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={stopDraw}
            />
          </div>
          <p className="text-xs text-muted-foreground text-center">Dibujá la firma en el área de arriba</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1" onClick={clearCanvas}>
              <Trash2 className="h-3.5 w-3.5" /> Limpiar
            </Button>
            <Button size="sm" className="flex-1 gap-1" onClick={saveSignature} disabled={!hasDrawn || saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Guardar Firma
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}