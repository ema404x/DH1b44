import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Flag, RotateCcw, Info } from 'lucide-react';
import { KNOWN_FLAGS, isFlagEnabled, setFlag } from '@/lib/migrationFlags';

/**
 * Panel admin para togglear feature flags de migraciones sin redeploy.
 * Lee/escribe localStorage; los cambios toman efecto en el próximo render de los consumidores.
 */
export default function MigrationFlagsPanel() {
  const [flags, setFlags] = useState(() => KNOWN_FLAGS.map((f) => ({ ...f, enabled: isFlagEnabled(f.name, f.default) })));

  useEffect(() => {
    const handler = () => setFlags(KNOWN_FLAGS.map((f) => ({ ...f, enabled: isFlagEnabled(f.name, f.default) })));
    window.addEventListener('migration-flag-changed', handler);
    return () => window.removeEventListener('migration-flag-changed', handler);
  }, []);

  const toggle = (name, enabled) => {
    setFlag(name, enabled);
    setFlags((prev) => prev.map((f) => (f.name === name ? { ...f, enabled } : f)));
  };

  const resetAll = () => {
    flags.forEach((f) => setFlag(f.name, f.default));
    setFlags(KNOWN_FLAGS.map((f) => ({ ...f, enabled: f.default })));
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Flag className="h-5 w-5 text-blue-600" />
          <h3 className="font-bold">Feature Flags de Migración</h3>
        </div>
        <Button variant="outline" size="sm" onClick={resetAll} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Restaurar defaults
        </Button>
      </div>

      <div className="flex items-start gap-2 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
        <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800">
          Los flags se guardan en este navegador y toman efecto inmediatamente. Para QA, agregá
          <code className="mx-1 px-1 py-0.5 bg-blue-100 rounded">?flag_nombre=1</code>
          en la URL para forzar ON sin tocar el panel.
        </p>
      </div>

      <div className="space-y-3">
        {flags.map((f) => (
          <div key={f.name} className="flex items-start justify-between gap-4 p-3 border border-border rounded-md">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{f.label}</p>
              <p className="text-xs text-muted-foreground mt-1">{f.description}</p>
              <code className="text-xs text-muted-foreground mt-1 inline-block">{f.name}</code>
            </div>
            <Switch checked={f.enabled} onCheckedChange={(v) => toggle(f.name, v)} />
          </div>
        ))}
      </div>
    </Card>
  );
}