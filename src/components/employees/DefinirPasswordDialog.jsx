import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import PasswordField from '@/components/employees/PasswordField';

export default function DefinirPasswordDialog({ emp, open, onOpenChange }) {
  const { toast } = useToast();
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [saving, setSaving] = useState(false);

  const error = pass && pass.length < 8 ? 'Mínimo 8 caracteres'
    : pass2 && pass !== pass2 ? 'Las contraseñas no coinciden' : '';
  const valid = pass.length >= 8 && pass === pass2;

  const close = (o) => {
    if (!o) { setPass(''); setPass2(''); }
    onOpenChange(o);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.functions.invoke('adminSetOperarioPassword', { employeeId: emp.id, newPassword: pass });
      toast({ title: 'Contraseña definida', description: `${emp.full_name} ya puede ingresar con la nueva contraseña.` });
      close(false);
    } catch (err) {
      toast({ title: 'No se pudo definir la contraseña', description: err?.response?.data?.error || err?.message || 'Error inesperado', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Definir contraseña</DialogTitle>
          <DialogDescription>{emp?.full_name} · {emp?.email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nueva contraseña</Label>
            <PasswordField value={pass} onChange={setPass} />
          </div>
          <div className="space-y-1.5">
            <Label>Repetir contraseña</Label>
            <PasswordField value={pass2} onChange={setPass2} />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!valid || saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}