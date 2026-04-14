import React from 'react';
import { CheckCircle2, AlertCircle, RefreshCw, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';

const ENTITY_ROUTES = {
  Client: '/clientes',
  Employee: '/empleados',
  Material: '/inventario',
  Project: '/proyectos',
  WorkOrder: '/ordenes',
  Asset: '/activos',
  PrecarioMinisterio: '/presupuestos-obra',
  Quote: '/presupuestos',
  Invoice: '/facturacion',
};

export default function ImportStepResult({ result, onReset }) {
  const totalImported = (result.results || []).reduce((acc, r) => acc + (r.imported || 0), 0);
  const totalErrors = (result.results || []).reduce((acc, r) => acc + (r.errors || 0), 0);
  const success = totalErrors === 0;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className={`flex items-center gap-4 p-6 rounded-2xl border ${
        success ? 'bg-emerald-50 border-emerald-200' : 'bg-yellow-50 border-yellow-200'
      }`}>
        {success
          ? <CheckCircle2 className="h-10 w-10 text-emerald-600 flex-shrink-0" />
          : <AlertCircle className="h-10 w-10 text-yellow-600 flex-shrink-0" />
        }
        <div>
          <p className={`font-bold text-xl ${success ? 'text-emerald-800' : 'text-yellow-800'}`}>
            {success ? '¡Importación exitosa!' : 'Importación con advertencias'}
          </p>
          <p className={`text-sm mt-1 ${success ? 'text-emerald-700' : 'text-yellow-700'}`}>
            {totalImported} registros importados correctamente
            {totalErrors > 0 && ` · ${totalErrors} registros con errores`}
          </p>
        </div>
      </div>

      {/* Per-entity results */}
      <div className="space-y-3">
        {(result.results || []).map((r, i) => (
          <Card key={i}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="font-semibold text-sm">{r.entity}</p>
                <div className="flex gap-3 mt-1">
                  <span className="text-xs text-emerald-600 font-medium">✓ {r.imported} importados</span>
                  {r.errors > 0 && <span className="text-xs text-red-500 font-medium">✗ {r.errors} errores</span>}
                </div>
                {r.error_details && r.error_details.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {r.error_details.slice(0, 3).map((err, ei) => (
                      <p key={ei} className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded">{err}</p>
                    ))}
                    {r.error_details.length > 3 && (
                      <p className="text-xs text-muted-foreground">+{r.error_details.length - 3} más...</p>
                    )}
                  </div>
                )}
              </div>
              {ENTITY_ROUTES[r.entity_key] && (
                <Link to={ENTITY_ROUTES[r.entity_key]}>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                    Ver datos <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Button onClick={onReset} variant="outline" className="w-full gap-2">
        <RefreshCw className="h-4 w-4" /> Nueva importación
      </Button>
    </div>
  );
}