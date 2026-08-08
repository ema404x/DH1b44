import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { KeyRound, Loader2, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function OperarioPasswordPanel() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const loadStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await base44.functions.invoke('gestionarOperarioPassword', { action: 'status' });
      setStatus(res.data);
    } catch {
      setStatus(null);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => { loadStatus(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) return;
    if (password.length < 4) { toast.error('La clave debe tener al menos 4 caracteres'); return; }
    if (password !== confirm) { toast.error('Las claves no coinciden'); return; }
    setSaving(true);
    try {
      const res = await base44.functions.invoke('gestionarOperarioPassword', { action: 'set', password });
      if (res.data?.error) { toast.error(res.data.error); return; }
      toast.success('Clave de operario actualizada');
      setPassword(''); setConfirm('');
      loadStatus();
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo actualizar la clave');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
          <KeyRound className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h3 className="font-bold">Clave de Operario (kiosko / tablet)</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Clave compartida que los operarios ingresan para fichar y completar órdenes desde los portales públicos y tablets.
          </p>
        </div>
      </div>

      {loadingStatus ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando estado…
        </div>
      ) : status?.configured ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-4">
          <ShieldCheck className="h-4 w-4" />
          <span className="font-medium">Clave configurada</span>
          {status.updated_by && <span className="text-muted-foreground">· actualizada por {status.updated_by}</span>}
          {status.updated_at && <span className="text-muted-foreground">· {new Date(status.updated_at).toLocaleString('es-AR')}</span>}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Sin clave configurada — se usa el secreto de plataforma como respaldo. Configurá una clave acá para gestionarla desde este módulo.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        <div className="space-y-1.5">
          <Label htmlFor="op-pwd">Nueva clave</Label>
          <Input
            id="op-pwd"
            type="text"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Mínimo 4 caracteres"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="op-pwd2">Repetir clave</Label>
          <Input
            id="op-pwd2"
            type="text"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={saving || !password.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Guardar clave
          </Button>
          <p className="text-xs text-muted-foreground">
            La clave se guarda hasheada (SHA-256). Al cambiarla, los operarios deberán ingresarla la próxima vez.
          </p>
        </div>
      </form>
    </Card>
  );
}