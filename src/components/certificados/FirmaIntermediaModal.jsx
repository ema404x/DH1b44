import React, { useRef, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, PenTool, Trash2, CheckCircle2, RefreshCw, XCircle, FileText, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { exportCertificadoPDF } from '@/utils/exportCertificadoPDF';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

export default function FirmaIntermediaModal({ open, onClose, cert, user, displayName }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [hasFirma, setHasFirma] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [redibujar, setRedibujar] = useState(false);
  const [mode, setMode] = useState('confirm'); // 'confirm' | 'rejecting'
  const [motivo, setMotivo] = useState('');
  const lastPos = useRef(null);
  const queryClient = useQueryClient();

  const { data: empleados = [], isLoading: loadingFirma } = useQuery({
    queryKey: ['employee-firma-intermedia', user?.email],
    queryFn: () => base44.entities.Employee.filter({ email: user?.email }),
    enabled: !!user?.email && open,
  });

  const empleado = empleados[0];
  const nombreFirmante = displayName || empleado?.full_name || user?.full_name || user?.email || 'Firmante';
  const firmaGuardada = empleado?.firma_url;
  const mostrarCanvas = !firmaGuardada || redibujar;

  // Reset al abrir
  useEffect(() => {
    if (open) { setRedibujar(false); setMode('confirm'); setMotivo(''); }
  }, [open]);

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

  const handleFirmar = async () => {
    setUploading(true);
    try {
      let firmaUrl = firmaGuardada;

      if (mostrarCanvas) {
        if (!hasFirma) { toast.error('Dibujá tu firma antes de confirmar'); setUploading(false); return; }
        const canvas = canvasRef.current;
        const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
        const file = new File([blob], 'firma_intermedia.png', { type: 'image/png' });
        const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
        firmaUrl = file_url;

        // Guardar en la ficha del empleado para futuras veces
        if (empleado?.id) {
          await base44.entities.Employee.update(empleado.id, { firma_url: firmaUrl });
        }
      }

      const res = await base44.functions.invoke('firmarCertificadoIntermedio', {
        cert_id: cert.id,
        accion: 'firmar',
        firma_url: firmaUrl,
      });
      if (res.data?.error) throw new Error(res.data.error);

      queryClient.invalidateQueries({ queryKey: ['certificados'] });
      toast.success(res.data?.mensaje || 'Certificado firmado');
      onClose();
    } catch (err) {
      toast.error('Error al firmar: ' + (err?.message || 'Error desconocido'));
    } finally {
      setUploading(false);
    }
  };

  const handleRechazar = async () => {
    if (!motivo.trim()) { toast.error('Ingresá el motivo del rechazo'); return; }
    setUploading(true);
    try {
      const res = await base44.functions.invoke('firmarCertificadoIntermedio', {
        cert_id: cert.id,
        accion: 'rechazar',
        motivo: motivo.trim(),
      });
      if (res.data?.error) throw new Error(res.data.error);

      queryClient.invalidateQueries({ queryKey: ['certificados'] });
      toast.success(res.data?.mensaje || 'Certificado rechazado y devuelto al creador');
      onClose();
    } catch (err) {
      toast.error('Error al rechazar: ' + (err?.message || 'Error desconocido'));
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadPDF = async () => {
    try { await exportCertificadoPDF(cert); } catch (e) { toast.error('No se pudo generar el PDF'); }
  };

  if (!cert) return null;

  const cadena = cert.cadena_firmas || [];
  const idxActual = cadena.findIndex(f => f.estado === 'pendiente');
  const firmanteActual = idxActual >= 0 ? cadena[idxActual] : null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenTool className="h-4 w-4 text-primary" /> Firma de Certificado
          </DialogTitle>
        </DialogHeader>

        {/* Resumen del certificado */}
        <div className="bg-muted/40 border border-border rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">Certificado N° {cert.numero}</span>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={handleDownloadPDF}>
              <FileText className="h-3.5 w-3.5" /> Ver PDF
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{cert.contratista || '—'}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {cert.emprendimiento && <span>{cert.emprendimiento}</span>}
            {cert.ada_numero && <span>ADA: {cert.ada_numero}</span>}
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-border/40">
            <span className="text-xs text-muted-foreground">Monto</span>
            <span className="text-sm font-bold text-primary">{fmt(cert.subtotal || cert.monto_contratado)}</span>
          </div>
        </div>

        {/* Progreso de la cadena */}
        {cadena.length > 0 && (
          <div className="flex items-center gap-2 text-xs">
            {cadena.map((f, i) => (
              <React.Fragment key={i}>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full border ${f.estado === 'firmado' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : i === idxActual ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'bg-muted text-muted-foreground border-border'}`}>
                  {f.estado === 'firmado' ? <CheckCircle2 className="h-3 w-3" /> : i === idxActual ? <PenTool className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                  <span className="max-w-[80px] truncate">{f.full_name}</span>
                </div>
                {i < cadena.length - 1 && <span className="text-muted-foreground">→</span>}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Identidad del firmante */}
        <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-3">
          <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-primary">{nombreFirmante.charAt(0).toUpperCase()}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{nombreFirmante}</p>
            <p className="text-xs text-muted-foreground">
              {idxActual + 1}° de {cadena.length} · Te toca firmar
            </p>
          </div>
        </div>

        {loadingFirma ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : mode === 'rejecting' ? (
          <div className="space-y-3">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Motivo del rechazo (obligatorio)</label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Explicá por qué rechazás este certificado..."
              className="w-full h-20 rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setMode('confirm'); setMotivo(''); }} disabled={uploading}>Cancelar</Button>
              <Button variant="destructive" onClick={handleRechazar} disabled={uploading || !motivo.trim()} className="gap-2">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                Confirmar rechazo
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Firma */}
            {firmaGuardada && !redibujar ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Firma registrada</p>
                <div className="border border-border rounded-xl bg-white flex items-center justify-center p-4" style={{ minHeight: 80 }}>
                  <img src={firmaGuardada} alt="Firma guardada" className="max-h-16 object-contain" />
                </div>
                <div className="text-center border-t border-border/60 pt-1">
                  <p className="text-xs font-semibold text-foreground">{nombreFirmante}</p>
                </div>
                <button
                  onClick={() => setRedibujar(true)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <RefreshCw className="h-3 w-3" /> Usar una firma diferente
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {firmaGuardada ? 'Nueva firma' : 'Dibujá tu firma'}
                  </label>
                  <div className="flex items-center gap-2">
                    {hasFirma && (
                      <button onClick={clearCanvas} className="flex items-center gap-1 text-destructive hover:opacity-80 text-xs">
                        <Trash2 className="h-3 w-3" /> Limpiar
                      </button>
                    )}
                    {firmaGuardada && (
                      <button onClick={() => setRedibujar(false)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                        ← Usar guardada
                      </button>
                    )}
                  </div>
                </div>
                <div className="relative rounded-xl overflow-hidden" style={{ touchAction: 'none' }}>
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={160}
                    className="w-full cursor-crosshair border-2 border-dashed border-border rounded-xl bg-white"
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={stopDraw}
                    onMouseLeave={stopDraw}
                    onTouchStart={startDraw}
                    onTouchMove={draw}
                    onTouchEnd={stopDraw}
                  />
                  {!hasFirma && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <p className="text-xs text-slate-300 select-none">Firmá aquí →</p>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {firmaGuardada ? 'Esta nueva firma reemplazará la guardada.' : 'Esta firma quedará guardada para futuras veces.'}
                </p>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setMode('rejecting')} disabled={uploading} className="gap-2 text-destructive hover:text-destructive">
                <XCircle className="h-4 w-4" /> Rechazar
              </Button>
              <Button
                onClick={handleFirmar}
                disabled={uploading || (mostrarCanvas && !hasFirma)}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Firmar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}