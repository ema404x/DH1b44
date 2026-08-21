import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, Trash2 } from 'lucide-react';
import SignaturePad from '@/components/fichar/SignaturePad';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

/**
 * EmployeeSignatureDialog — permite cargar/reemplazar/quitar la firma digital
 * de un empleado directo desde el módulo de Empleados. Persiste en Employee.firma_url
 * (RLS aísla por sector — no requiere lógica extra).
 */
export default function EmployeeSignatureDialog({ emp, open, onOpenChange, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  if (!emp) return null;

  const handleSign = async (dataUrl) => {
    setSaving(true);
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `firma_${emp.id}.png`, { type: 'image/png' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Employee.update(emp.id, { firma_url: file_url });
      setDone(true);
      onSaved?.(file_url);
      toast.success('Firma guardada correctamente');
      setTimeout(() => { onOpenChange(false); setDone(false); }, 800);
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

        {emp.firma_url && !done ? (
          <div className="space-y-3">
            <img src={emp.firma_url} alt="firma actual" className="w-full rounded-xl border border-border bg-white" />
            <p className="text-xs text-muted-foreground">Ya tiene una firma guardada. Volvé a firmar para reemplazarla.</p>
            <SignaturePad onSign={handleSign} signed={saving} />
            <Button variant="outline" size="sm" onClick={handleClear} disabled={saving} className="gap-1 text-destructive hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" /> Quitar firma
            </Button>
          </div>
        ) : (
          <SignaturePad onSign={handleSign} signed={saving || done} />
        )}

        {(saving || done) && (
          <div className="flex items-center gap-2 text-sm">
            {done
              ? <span className="text-emerald-500 flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> Firma guardada</span>
              : <span className="text-muted-foreground flex items-center gap-1"><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</span>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}