import React, { useState } from 'react';
import { WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/lib/AuthContext';

// Interruptor "Modo sin conexión (beta)" — solo para administradores de
// plataforma SIN ficha de Employee. Quien tiene ficha lo gestiona desde Empleados.
export default function OfflineModeSwitch() {
  const { user, hasEmployeeRecord, offlineMode, offlineEnabled, setOwnOfflineEnabled } = useAuth();
  const [saving, setSaving] = useState(false);

  if (user?.role !== 'admin' || hasEmployeeRecord !== false || offlineMode) return null;

  const handleChange = async (value) => {
    setSaving(true);
    try {
      await setOwnOfflineEnabled(value);
      toast.success(value ? 'Modo sin conexión activado' : 'Modo sin conexión desactivado');
    } catch (_) {
      toast.error('No se pudo guardar el modo sin conexión');
    } finally {
      setSaving(false);
    }
  };

  return (
    <label className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-popover-foreground cursor-pointer">
      <WifiOff className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <span className="flex-1 leading-tight">Modo sin conexión (beta)</span>
      <Switch checked={offlineEnabled === true} disabled={saving} onCheckedChange={handleChange} />
    </label>
  );
}