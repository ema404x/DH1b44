import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Zap, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function SyncEmployeesButton({ onSyncComplete }) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await base44.functions.invoke('sincronizarEmpleados', {});
      setResult(response.data);
      if (onSyncComplete) onSyncComplete();
    } catch (error) {
      setResult({ error: error.message });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-3">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button className="gap-2 w-full sm:w-auto bg-gradient-to-r from-violet-500 to-purple-600 hover:shadow-lg shadow-violet-500/50 transition-all" disabled={syncing}>
            <Zap className="h-4 w-4" />
            {syncing ? 'Sincronizando...' : 'Sincronizar Empleados'}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sincronizar Empleados</AlertDialogTitle>
            <AlertDialogDescription>
              Esto vinculará correctamente a todos los empleados con sus cuentas de usuario, resolviendo conflictos de emails duplicados. ¿Continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSync} disabled={syncing}>
              {syncing ? 'Sincronizando...' : 'Sincronizar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {result && (
        <Card className={`p-4 border-l-4 ${result.error ? 'border-l-red-500 bg-red-50' : 'border-l-green-500 bg-green-50'}`}>
          <div className="flex items-start gap-3">
            {result.error ? (
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="text-sm">
              {result.error ? (
                <p className="font-semibold text-red-900">Error: {result.error}</p>
              ) : (
                <>
                  <p className="font-semibold text-green-900">Sincronización completada</p>
                  <p className="text-green-800 mt-1">
                    {result.synced} empleados vinculados de {result.total_users} usuarios
                  </p>
                  {result.errors && result.errors.length > 0 && (
                    <div className="mt-2 text-yellow-700 text-xs">
                      <p className="font-semibold">Advertencias:</p>
                      <ul className="list-disc list-inside mt-1">
                        {result.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}