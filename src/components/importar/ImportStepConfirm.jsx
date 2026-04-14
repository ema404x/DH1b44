import React from 'react';
import { AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function ImportStepConfirm({ mappingResult, onConfirm, onBack, isLoading }) {
  const validSheets = (mappingResult.sheets || []).filter(s => s.target_entity && s.target_entity !== 'skip');
  const totalRows = validSheets.reduce((acc, s) => acc + (s.row_count || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-800">
        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Revisá antes de importar</p>
          <p className="text-xs mt-1 text-yellow-700">Esta acción creará registros nuevos en la base de datos. Los registros existentes no serán modificados.</p>
        </div>
      </div>

      <div className="space-y-3">
        {validSheets.map((sheet, i) => (
          <Card key={i}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="font-semibold text-sm">{sheet.sheet_name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {sheet.row_count} registros → <span className="font-medium text-foreground">{sheet.target_entity}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{Object.entries(sheet.field_mapping || {}).filter(([, v]) => v).length} campos mapeados</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} disabled={isLoading}>Volver a editar</Button>
        <Button
          onClick={() => onConfirm(mappingResult)}
          disabled={isLoading}
          className="flex-1 gap-2"
        >
          {isLoading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Importando {totalRows} registros...</>
          ) : (
            <><CheckCircle2 className="h-4 w-4" /> Importar {totalRows} registros</>
          )}
        </Button>
      </div>
    </div>
  );
}