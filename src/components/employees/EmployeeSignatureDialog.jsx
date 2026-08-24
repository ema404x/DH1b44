import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, Trash2, Upload, Image as ImageIcon } from 'lucide-react';
import SignaturePad from '@/components/fichar/SignaturePad';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

/**
 * EmployeeSignatureDialog — permite cargar/reemplazar/quitar la firma digital
 * de un empleado directo desde el módulo de Empleados. Persiste en Employee.firma_url
 * (RLS aísla por sector — no requiere lógica extra).
 *
 * Dos modos: dibujar en el pad o adjuntar un archivo de imagen con la firma.
 */
export default function EmployeeSignatureDialog({ emp, open, onOpenChange, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [mode, setMode] = useState('draw'); // 'draw' | 'upload'
  const [uploadedFile, setUploadedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileRef = useRef(null);

  if (!emp) return null;

  const persistFile = async (file) => {
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.Employee.update(emp.id, { firma_url: file_url });
    return file_url;
  };

  const handleSign = async (dataUrl) => {
    setSaving(true);
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `firma_${emp.id}.png`, { type: 'image/png' });
      const file_url = await persistFile(file);
      setDone(true);
      onSaved?.(file_url);
      toast.success('Firma guardada correctamente');
      setTimeout(() => { onOpenChange(false); setDone(false); resetUpload(); }, 800);
    } catch (e) {
      toast.error('No se pudo guardar la firma');
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('El archivo debe ser una imagen');
      e.target.value = '';
      return;
    }
    setUploadedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const resetUpload = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setUploadedFile(null);
    setPreviewUrl(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleUploadSave = async () => {
    if (!uploadedFile) return;
    setSaving(true);
    try {
      const ext = uploadedFile.name.split('.').pop() || 'png';
      const file = new File([uploadedFile], `firma_${emp.id}.${ext}`, { type: uploadedFile.type });
      const file_url = await persistFile(file);
      setDone(true);
      onSaved?.(file_url);
      toast.success('Firma guardada correctamente');
      setTimeout(() => { onOpenChange(false); setDone(false); resetUpload(); }, 800);
    } catch (e) {
      toast.error('No se pudo guardar la firma');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      await base44.entities.Employee.update(emp.id, { firma_url: null });
      onSaved?.(null);
      toast.success('Firma eliminada');
      onOpenChange(false);
      resetUpload();
    } catch (e) {
      toast.error('No se pudo eliminar la firma');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Firma — {emp.full_name}</DialogTitle>
        </DialogHeader>

        {emp.firma_url && !done && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Firma actual</p>
            <img src={emp.firma_url} alt="firma actual" className="w-full rounded-xl border border-border bg-white" />
          </div>
        )}

        {/* Toggle de modo */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          <button
            onClick={() => { setMode('draw'); resetUpload(); }}
            className={`flex-1 h-9 rounded-md text-sm font-medium transition-colors ${mode === 'draw' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
          >
            Dibujar
          </button>
          <button
            onClick={() => setMode('upload')}
            className={`flex-1 h-9 rounded-md text-sm font-medium transition-colors ${mode === 'upload' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
          >
            Adjuntar archivo
          </button>
        </div>

        {mode === 'draw' ? (
          <SignaturePad onSign={handleSign} signed={saving || done} />
        ) : (
          <div className="space-y-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            {previewUrl ? (
              <div className="space-y-2">
                <div className="relative rounded-xl overflow-hidden border border-border bg-white">
                  <img src={previewUrl} alt="vista previa firma" className="w-full max-h-48 object-contain" />
                </div>
                <p className="text-xs text-muted-foreground truncate">{uploadedFile?.name}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={resetUpload} disabled={saving} className="gap-1">
                    <Upload className="h-3.5 w-3.5" /> Cambiar
                  </Button>
                  <Button size="sm" onClick={handleUploadSave} disabled={saving} className="flex-1 gap-1">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Guardar firma
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={saving}
                className="w-full h-40 rounded-xl border-2 border-dashed border-border bg-muted/40 hover:bg-muted flex flex-col items-center justify-center gap-2 text-muted-foreground transition-colors active:scale-[0.99]"
              >
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <ImageIcon className="h-6 w-6" />
                </div>
                <p className="text-sm font-medium text-foreground">Tocá para adjuntar la firma</p>
                <p className="text-xs">PNG, JPG o cualquier imagen</p>
              </button>
            )}
          </div>
        )}

        {(saving || done) && (
          <div className="flex items-center gap-2 text-sm">
            {done
              ? <span className="text-emerald-500 flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> Firma guardada</span>
              : <span className="text-muted-foreground flex items-center gap-1"><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</span>}
          </div>
        )}

        <DialogFooter className="sm:justify-between">
          {emp.firma_url ? (
            <Button variant="outline" onClick={handleClear} disabled={saving} className="gap-1 text-destructive hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" /> Quitar firma
            </Button>
          ) : <span />}
          <Button variant="outline" onClick={() => { onOpenChange(false); resetUpload(); }}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}