import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Loader2, Settings2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AsignacionAutomatica({ employees, locations, onSyncComplete }) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);

  const syncAsignaciones = async () => {
    setSyncing(true);
    setResult(null);

    try {
      let updates = 0;
      let skipped = 0;

      // Agrupar ubicaciones por jefe de sitio
      const ubicacionesPorJefe = {};
      locations.forEach(loc => {
        const jefe = loc.jefe_sitio || 'Sin asignar';
        if (!ubicacionesPorJefe[jefe]) {
          ubicacionesPorJefe[jefe] = [];
        }
        ubicacionesPorJefe[jefe].push({
          establecimiento: loc.establecimiento,
          direccion: loc.direccion,
          comuna: loc.comuna,
        });
      });

      // Sincronizar empleados jefes de sitio con sus ubicaciones
      for (const emp of employees) {
        if (emp.role === 'jefe_sitio' && emp.full_name) {
          const ubicaciones = ubicacionesPorJefe[emp.full_name] || [];
          if (ubicaciones.length > 0) {
            await base44.entities.Employee.update(emp.id, {
              assigned_location: ubicaciones.map(u => u.establecimiento).join(', '),
              assigned_comuna: ubicaciones[0]?.comuna || '',
              assigned_jefe_sitio: emp.full_name,
            });
            updates++;
          } else {
            skipped++;
          }
        }
      }

      setResult({ updates, skipped, total: employees.length });
      toast.success(`✅ ${updates} empleados actualizados`);
      if (onSyncComplete) onSyncComplete();
    } catch (error) {
      toast.error('Error: ' + error.message);
      setResult({ error: true, message: error.message });
    }

    setSyncing(false);
  };

  return (
    <div className="space-y-4">
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-orange-600" />
            Sincronización Automática
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-700">
            Sincroniza automáticamente los empleados jefes de sitio con sus ubicaciones, direcciones y comunas asignadas desde el módulo de Información General.
          </p>

          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="bg-white rounded-lg p-3 border border-orange-200">
              <p className="text-muted-foreground text-xs">Empleados</p>
              <p className="text-xl font-bold">{employees.length}</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-orange-200">
              <p className="text-muted-foreground text-xs">Jefes de Sitio</p>
              <p className="text-xl font-bold">{employees.filter(e => e.role === 'jefe_sitio').length}</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-orange-200">
              <p className="text-muted-foreground text-xs">Ubicaciones</p>
              <p className="text-xl font-bold">{locations.length}</p>
            </div>
          </div>

          {result && !result.error && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold text-emerald-900">Sincronización completada</p>
                  <p className="text-emerald-700 mt-1">
                    {result.updates} empleados actualizados · {result.skipped} sin ubicaciones asignadas
                  </p>
                </div>
              </div>
            </div>
          )}

          {result?.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold text-red-900">Error en la sincronización</p>
                  <p className="text-red-700 mt-1">{result.message}</p>
                </div>
              </div>
            </div>
          )}

          <Button
            onClick={syncAsignaciones}
            disabled={syncing || employees.length === 0 || locations.length === 0}
            className="w-full gap-2"
          >
            {syncing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                <Settings2 className="h-4 w-4" />
                Sincronizar Ahora
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Muestra ubicaciones sin jefe de sitio asignado */}
      {locations.filter(l => !l.jefe_sitio).length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              Ubicaciones sin Jefe de Sitio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-yellow-700 mb-3">
              {locations.filter(l => !l.jefe_sitio).length} escuelas no tienen jefe de sitio asignado
            </p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {locations.filter(l => !l.jefe_sitio).map((loc, idx) => (
                <div key={idx} className="text-xs bg-white rounded p-2 border border-yellow-100">
                  <p className="font-medium">{loc.establecimiento}</p>
                  <p className="text-muted-foreground">{loc.direccion}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}