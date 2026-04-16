import React from 'react';
import { AlertTriangle, Loader2, CheckCircle2, Database, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const ENTITY_LABELS = {
  Client: 'Clientes', Employee: 'Empleados', Material: 'Materiales',
  Project: 'Proyectos', WorkOrder: 'Órdenes de Trabajo', Asset: 'Activos',
  PrecarioMinisterio: 'Preciario Ministerial', Quote: 'Presupuestos', Invoice: 'Facturas'
};

export default function ImportStepConfirm({ mappingResult, onConfirm, onBack, isLoading }) {
  const validSheets = (mappingResult.sheets || []).filter(s => s.target_entity && s.target_entity !== 'skip');
  const totalRows = validSheets.reduce((acc, s) => acc + (s.row_count || 0), 0);
  const totalMapped = validSheets.reduce((acc, s) => acc + Object.values(s.field_mapping || {}).filter(v => v).length, 0);
  const totalIgnored = validSheets.reduce((acc, s) => acc + Object.values(s.field_mapping || {}).filter(v => !v).length, 0);

  return (
    <div className="space-y-6">
      {/* Warning */}
      <div className="flex gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Revisá antes de importar</p>
          <p className="text-xs mt-1 text-amber-700">Esta acción creará <strong>{totalRows.toLocaleString()} registros nuevos</strong> en la base de datos. Los registros existentes no serán modificados.</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Registros a crear', value: totalRows.toLocaleString(), color: 'text-primary' },
          { label: 'Campos mapeados', value: totalMapped, color: 'text-emerald-600' },
          { label: 'Campos ignorados', value: totalIgnored, color: 'text-muted-foreground' },
        ].map(({ label, value, color }) => (
          <div key={label} className="p-4 bg-muted/30 rounded-xl text-center">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-muted-foreground mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Per-sheet breakdown */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Detalle por hoja</p>
        {validSheets.map((sheet, i) => {
          const mapped = Object.values(sheet.field_mapping || {}).filter(v => v).length;
          const total = Object.keys(sheet.field_mapping || {}).length;
          const pct = total > 0 ? Math.round((mapped / total) * 100) : 0;
          return (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Database className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{sheet.sheet_name}</p>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span>{sheet.row_count} filas</span>
                        <ArrowRight className="h-3 w-3" />
                        <span className="font-medium text-foreground">{ENTITY_LABELS[sheet.target_entity] || sheet.target_entity}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{mapped}/{total}</p>
                    <p className="text-xs text-muted-foreground">campos</p>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-400'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{pct}% de columnas mapeadas</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} disabled={isLoading}>Volver a editar</Button>
        <Button
          onClick={() => onConfirm(mappingResult)}
          disabled={isLoading}
          className="flex-1 gap-2"
        >
          {isLoading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Importando {totalRows.toLocaleString()} registros...</>
          ) : (
            <><CheckCircle2 className="h-4 w-4" /> Importar {totalRows.toLocaleString()} registros</>
          )}
        </Button>
      </div>
    </div>
  );
}