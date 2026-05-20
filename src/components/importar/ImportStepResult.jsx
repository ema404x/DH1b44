import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, RefreshCw, ArrowRight, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';

const ENTITY_ROUTES = {
   InformePlaneacion: '/informe-planeacion', Client: '/clientes', Employee: '/empleados', Material: '/inventario',
   Project: '/proyectos', WorkOrder: '/ordenes', Asset: '/activos',
   PrecarioMinisterio: '/presupuestos-obra', Quote: '/presupuestos', Invoice: '/facturacion',
   LocationData: '/informacion-general',
 };

export default function ImportStepResult({ result, onReset }) {
  const [expandedErrors, setExpandedErrors] = useState(null);

  const totalImported = (result.results || []).reduce((acc, r) => acc + (r.imported || 0), 0);
  const totalErrors = (result.results || []).reduce((acc, r) => acc + (r.errors || 0), 0);
  const success = totalErrors === 0;
  const partial = totalImported > 0 && totalErrors > 0;

  const downloadErrors = () => {
    const lines = ['Entidad,Fila,Error'];
    (result.results || []).forEach(r => {
      (r.error_details || []).forEach(err => {
        lines.push(`"${r.entity}","","${err.replace(/"/g, '""')}"`);
      });
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'errores_importacion.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
       {/* Hero result with gradient */}
       <div className={`p-6 rounded-2xl border-2 relative overflow-hidden ${
         success ? 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200' :
         partial ? 'bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200' :
         'bg-gradient-to-br from-red-50 to-red-100/50 border-red-200'
       }`}>
        <div className="flex items-start gap-4">
          <div className={`h-14 w-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${
            success ? 'bg-emerald-100' : partial ? 'bg-amber-100' : 'bg-red-100'
          }`}>
            {success
              ? <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              : <AlertCircle className={`h-7 w-7 ${partial ? 'text-amber-600' : 'text-red-600'}`} />
            }
          </div>
          <div className="flex-1">
            <p className={`font-bold text-xl ${
              success ? 'text-emerald-800' : partial ? 'text-amber-800' : 'text-red-800'
            }`}>
              {success ? '¡Importación exitosa!' : partial ? 'Importación con advertencias' : 'Importación fallida'}
            </p>
            <div className="flex flex-wrap gap-4 mt-3">
              <div className="text-center">
                <div className={`text-3xl font-bold ${success ? 'text-emerald-700' : 'text-amber-700'}`}>{totalImported.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">registros importados</div>
              </div>
              {totalErrors > 0 && (
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">{totalErrors.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">registros con error</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Overall progress bar */}
        {(totalImported + totalErrors) > 0 && (
          <div className="mt-4">
            <div className="h-2 bg-white/60 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${Math.round((totalImported / (totalImported + totalErrors)) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {Math.round((totalImported / (totalImported + totalErrors)) * 100)}% de éxito
            </p>
          </div>
        )}
      </div>

      {/* Per-entity results */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Detalle por entidad</p>
          {totalErrors > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={downloadErrors}>
              <Download className="h-3 w-3" /> Exportar errores
            </Button>
          )}
        </div>
        {(result.results || []).map((r, i) => (
          <Card key={i}>
            <CardHeader
              className={`py-3 px-4 ${r.errors > 0 ? 'cursor-pointer hover:bg-muted/20' : ''}`}
              onClick={() => r.errors > 0 && setExpandedErrors(expandedErrors === i ? null : i)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    r.errors === 0 ? 'bg-emerald-100' : r.imported > 0 ? 'bg-amber-100' : 'bg-red-100'
                  }`}>
                    {r.errors === 0
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      : <AlertCircle className={`h-4 w-4 ${r.imported > 0 ? 'text-amber-600' : 'text-red-600'}`} />
                    }
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{r.entity}</p>
                    <div className="flex gap-3 mt-0.5">
                      {r.imported > 0 && <span className="text-xs text-emerald-600 font-medium">✓ {r.imported.toLocaleString()} importados</span>}
                      {r.errors > 0 && <span className="text-xs text-red-500 font-medium">✗ {r.errors} errores</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {ENTITY_ROUTES[r.entity_key] && (
                    <Link to={ENTITY_ROUTES[r.entity_key]} onClick={(e) => e.stopPropagation()}>
                      <Button variant="outline" size="sm" className="gap-1 text-xs h-7">
                        Ver <ArrowRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  )}
                  {r.errors > 0 && (
                    expandedErrors === i ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CardHeader>
            {expandedErrors === i && r.error_details?.length > 0 && (
              <CardContent className="pt-0 pb-3 px-4 border-t border-border">
                <div className="space-y-1 mt-2">
                  {r.error_details.slice(0, 5).map((err, ei) => (
                    <p key={ei} className="text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded-lg font-mono">{err}</p>
                  ))}
                  {r.error_details.length > 5 && (
                    <p className="text-xs text-muted-foreground pl-1">+{r.error_details.length - 5} errores más (exportá el CSV para verlos todos)</p>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {/* Bottom CTA */}
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-slate-700/50">
         <Button onClick={onReset} variant="outline" className="gap-2">
           <RefreshCw className="h-4 w-4" /> Nueva importación
         </Button>
         {success && (
           <Link to="/reportes">
             <Button className="w-full gap-2 bg-primary hover:bg-primary/90">
               <ArrowRight className="h-4 w-4" /> Ver reportes
             </Button>
           </Link>
         )}
       </div>
    </div>
  );
}